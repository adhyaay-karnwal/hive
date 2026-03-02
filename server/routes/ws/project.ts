import type { Peer, Message } from "crossws";
import { db } from "../../database";
import { signals } from "../../database/schema";
import { eq } from "drizzle-orm";

/**
 * WebSocket endpoint for real-time signal events.
 *
 * The main chat flow uses /api/chat via useChat (Vercel AI SDK).
 * This WS handler is only for sub-agent signal events (questions, blocked).
 */

const peerProjects = new Map<string, string>();

export default defineWebSocketHandler({
  async open(peer: Peer) {
    const url = new URL(peer.request?.url || "", "http://localhost");
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      peer.send(JSON.stringify({ type: "error", data: { message: "projectId required" } }));
      peer.close(1008, "Missing parameters");
      return;
    }

    peerProjects.set(peer.id, projectId);

    peer.send(JSON.stringify({ type: "connected", data: { projectId } }));

    // Send pending signals on connect
    await fetchAndSendSignals(peer);
  },

  async message(peer: Peer, message: Message) {
    const projectId = peerProjects.get(peer.id);
    if (!projectId) return;

    let msg: { type: string; data?: any };
    try {
      msg = JSON.parse(message.text());
    } catch {
      return;
    }

    switch (msg.type) {
      case "resolve_signal": {
        const { signalId, answer } = msg.data || {};
        if (!signalId || !answer) return;

        try {
          await db
            .update(signals)
            .set({ resolved: true, resolvedContent: answer })
            .where(eq(signals.id, signalId));

          peer.send(JSON.stringify({
            type: "signal.resolved",
            data: { signalId },
          }));
        } catch (e: any) {
          peer.send(JSON.stringify({
            type: "error",
            data: { message: `Failed to resolve signal: ${e.message}` },
          }));
        }
        break;
      }

      case "ping":
        break;
    }
  },

  close(peer: Peer) {
    peerProjects.delete(peer.id);
  },

  error(peer: Peer, error: Error) {
    console.error(`[ws:project] Error:`, error.message);
    peerProjects.delete(peer.id);
  },
});

async function fetchAndSendSignals(peer: Peer) {
  try {
    const pending = await db
      .select()
      .from(signals)
      .where(eq(signals.resolved, false));

    for (const q of pending.filter((s) => s.type === "question" || s.type === "blocked")) {
      peer.send(JSON.stringify({ type: "signal", data: q }));
    }
  } catch {
    // ignore
  }
}
