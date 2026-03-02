import { spawn, type ChildProcess } from "child_process";
import type { AnthropicProvider } from "@ai-sdk/anthropic";

const MAX_OUTPUT_BYTES = 50 * 1024; // 50KB
const DEFAULT_TIMEOUT_MS = 120_000; // 120s

interface BashSession {
  process: ChildProcess;
  cwd: string;
}

const sessions = new Map<string, BashSession>();

function getOrCreateSession(cwd: string): BashSession {
  const key = cwd;
  const existing = sessions.get(key);

  if (existing && existing.process.exitCode === null) {
    return existing;
  }

  // Clean up dead session
  if (existing) {
    sessions.delete(key);
  }

  const child = spawn("/bin/bash", ["--norc", "--noprofile", "-i"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      TERM: "dumb",
      // Prevent interactive prompts
      GIT_TERMINAL_PROMPT: "0",
      DEBIAN_FRONTEND: "noninteractive",
    },
  });

  const session: BashSession = { process: child, cwd };
  sessions.set(key, session);

  child.on("exit", () => {
    sessions.delete(key);
  });

  return session;
}

function destroySession(cwd: string): void {
  const key = cwd;
  const session = sessions.get(key);
  if (session) {
    session.process.kill("SIGTERM");
    sessions.delete(key);
  }
}

function executeCommand(
  cwd: string,
  command: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve) => {
    const session = getOrCreateSession(cwd);
    const { process: proc } = session;

    if (!proc.stdin || !proc.stdout || !proc.stderr) {
      resolve("Error: bash session has no stdio");
      return;
    }

    let output = "";
    let resolved = false;

    // Unique marker to detect command completion
    const marker = `__HIVE_DONE_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

    const onData = (data: Buffer) => {
      const text = data.toString();

      // Check for our completion marker
      const markerIdx = text.indexOf(marker);
      if (markerIdx !== -1) {
        // Add text before marker
        output += text.slice(0, markerIdx);
        cleanup();
        finalize();
        return;
      }

      output += text;

      // Truncate if too long
      if (output.length > MAX_OUTPUT_BYTES) {
        output =
          output.slice(0, MAX_OUTPUT_BYTES) +
          "\n\n[output truncated at 50KB]";
        cleanup();
        finalize();
      }
    };

    const cleanup = () => {
      proc.stdout!.removeListener("data", onData);
      proc.stderr!.removeListener("data", onData);
      clearTimeout(timer);
    };

    const finalize = () => {
      if (resolved) return;
      resolved = true;
      // Clean up trailing whitespace and the marker echo command
      resolve(output.trim());
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);

    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        // Send SIGINT to interrupt the running command
        proc.kill("SIGINT");
        output += `\n\n[command timed out after ${timeoutMs / 1000}s]`;
        finalize();
      }
    }, timeoutMs);

    // Write the command followed by an echo of our marker to stdout
    proc.stdin.write(`${command}\necho '${marker}'\n`);
  });
}

/**
 * Create a bash tool scoped to a working directory.
 * Returns the Anthropic provider-defined bash tool with execute implementation.
 */
export function createBashTool(
  anthropic: AnthropicProvider,
  cwd: string,
) {
  return anthropic.tools.bash_20250124({
    execute: async ({
      command,
      restart,
    }: {
      command?: string;
      restart?: boolean;
    }) => {
      if (restart) {
        destroySession(cwd);
        return "Bash session restarted.";
      }

      if (!command) {
        return "No command provided.";
      }

      // The model is trained on a /repo container convention.
      // Rewrite /repo references to the actual project path.
      const rewritten = command.replaceAll("/repo/", `${cwd}/`).replaceAll("/repo", cwd);

      const result = await executeCommand(cwd, rewritten);
      return result || "(no output)";
    },
  });
}

/**
 * Clean up all bash sessions. Call on shutdown.
 */
export function cleanupBashSessions(): void {
  for (const [, session] of sessions) {
    session.process.kill("SIGTERM");
  }
  sessions.clear();
}
