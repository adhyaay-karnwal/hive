import { EventEmitter } from "events";

/**
 * Subscribes to OpenCode server SSE event streams.
 *
 * Deduplicates by PORT - if multiple projects share the same OpenCode server,
 * they share one SSE connection and one emitter. This prevents duplicate
 * connections to the same server.
 */

type OpenCodeEvent = {
  type: string;
  properties: Record<string, any>;
};

type PortSubscription = {
  emitter: EventEmitter;
  controller: AbortController | null;
  port: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  refCount: number; // how many projects are using this connection
};

// Keyed by port number, not project ID
const subscriptionsByPort = new Map<number, PortSubscription>();
// Map project IDs to their port for cleanup
const projectPorts = new Map<string, number>();

/**
 * Get or create an event emitter for an OpenCode server on a given port.
 * Multiple projects can share the same port's emitter.
 */
export function getProjectEvents(projectId: string, port: number): EventEmitter {
  // If this project was on a different port before, unsubscribe from the old one
  const oldPort = projectPorts.get(projectId);
  if (oldPort !== undefined && oldPort !== port) {
    releasePort(oldPort);
  }

  projectPorts.set(projectId, port);

  const existing = subscriptionsByPort.get(port);
  if (existing) {
    existing.refCount++;
    return existing.emitter;
  }

  // Create new subscription for this port
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);

  const sub: PortSubscription = {
    emitter,
    controller: null,
    port,
    reconnectTimer: null,
    refCount: 1,
  };

  subscriptionsByPort.set(port, sub);
  connectSSE(port, sub);

  return emitter;
}

/**
 * Emit a custom event to a specific project's emitter (by project ID).
 */
export function emitProjectEvent(projectId: string, event: OpenCodeEvent) {
  const port = projectPorts.get(projectId);
  if (port !== undefined) {
    const sub = subscriptionsByPort.get(port);
    if (sub) {
      sub.emitter.emit("event", event);
    }
  }
}

/**
 * Unsubscribe a project from its port's event stream.
 */
export function unsubscribe(projectId: string) {
  const port = projectPorts.get(projectId);
  if (port !== undefined) {
    projectPorts.delete(projectId);
    releasePort(port);
  }
}

function releasePort(port: number) {
  const sub = subscriptionsByPort.get(port);
  if (!sub) return;

  sub.refCount--;
  if (sub.refCount <= 0) {
    // No more projects using this port - tear down the SSE connection
    sub.controller?.abort();
    if (sub.reconnectTimer) clearTimeout(sub.reconnectTimer);
    sub.emitter.removeAllListeners();
    subscriptionsByPort.delete(port);
  }
}

async function connectSSE(port: number, sub: PortSubscription) {
  const url = `http://localhost:${port}/event`;
  sub.controller = new AbortController();

  try {
    const res = await fetch(url, {
      signal: sub.controller.signal,
      headers: { Accept: "text/event-stream" },
    });

    if (!res.ok || !res.body) {
      throw new Error(`SSE connection failed: ${res.status}`);
    }

    console.log(`[sse:${port}] Connected`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        const dataLines: string[] = [];
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        if (!dataLines.length) continue;

        const rawData = dataLines.join("\n");
        try {
          const parsed = JSON.parse(rawData);
          const eventType = parsed.type;
          const properties = parsed.properties || {};

          if (!eventType) continue;
          if (eventType === "server.heartbeat" || eventType === "server.connected") continue;

          sub.emitter.emit("event", { type: eventType, properties });
        } catch (e) {
          console.warn(`[sse:${port}] Failed to parse event:`, rawData.slice(0, 200));
        }
      }
    }
  } catch (e: any) {
    if (e.name === "AbortError") return;
    console.warn(`[sse:${port}] Disconnected: ${e.message}`);
  }

  // Reconnect if still subscribed
  if (subscriptionsByPort.has(port)) {
    sub.reconnectTimer = setTimeout(() => {
      if (subscriptionsByPort.has(port)) {
        connectSSE(port, sub);
      }
    }, 3000);
  }
}
