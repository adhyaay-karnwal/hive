import { db } from "../database";
import { devProfile, sessions } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Build the full system prompt for the main agent, including
 * developer profile and active session info.
 */
export async function buildSystemPrompt(projectId: string): Promise<string> {
  const template = loadTemplate("main-agent.md");
  const profile = await loadDevProfile();
  const activeSessions = await getActiveSessionsSummary(projectId);

  return template
    .replace("{{dev_profile}}", profile)
    .replace("{{active_sessions}}", activeSessions);
}

/**
 * Build a prompt for the main orchestrator agent.
 */
export async function buildMainPrompt(
  projectId: string,
): Promise<string> {
  return buildSystemPrompt(projectId);
}

/**
 * Build a prompt for a worker agent by injecting:
 * - Developer profile preferences
 * - Skills (convention files)
 * - Task description
 */
export async function buildWorkerPrompt(opts: {
  taskDescription: string;
  worktreeId?: string;
}): Promise<string> {
  const template = loadTemplate("worker-agent.md");
  const profile = await loadDevProfile();
  const skills = loadSkills();

  return template
    .replace("{{task_description}}", opts.taskDescription)
    .replace("{{dev_profile}}", profile)
    .replace("{{skills}}", skills);
}

/**
 * Build a prompt for the review agent.
 */
export async function buildReviewerPrompt(diff: string): Promise<string> {
  const template = loadTemplate("reviewer-agent.md");
  const profile = await loadDevProfile();
  const skills = loadSkills();

  return template
    .replace("{{dev_profile}}", profile)
    .replace("{{skills}}", skills)
    .replace("{{diff}}", diff);
}

async function getActiveSessionsSummary(
  projectId: string,
): Promise<string> {
  const activeSessions = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.projectId, projectId),
        eq(sessions.status, "working"),
      ),
    );

  if (!activeSessions.length) {
    return "No active sub-agent sessions.";
  }

  return activeSessions
    .map(
      (s) =>
        `- Session ${s.id} (role: ${s.role}, model: ${s.modelPreference}, status: ${s.status})`,
    )
    .join("\n");
}

function loadTemplate(name: string): string {
  // Try multiple possible locations for prompts
  const paths = [
    join(process.cwd(), "prompts", name),
    join(process.cwd(), "..", "prompts", name),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  return `# ${name}\n\nTemplate not found.`;
}

function loadSkills(): string {
  const skillsDir = join(process.cwd(), "skills");
  const skillFiles = ["nuxt.md", "vue.md", "general.md"];
  const skills: string[] = [];

  for (const file of skillFiles) {
    const path = join(skillsDir, file);
    if (existsSync(path)) {
      skills.push(readFileSync(path, "utf-8"));
    }
  }

  return skills.join("\n\n---\n\n") || "No skills configured.";
}

async function loadDevProfile(): Promise<string> {
  const entries = await db.select().from(devProfile);

  if (!entries.length) {
    return "No developer profile configured yet.";
  }

  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(`- ${entry.key}: ${entry.value}`);
  }

  return Object.entries(grouped)
    .map(([cat, items]) => `### ${cat}\n${items.join("\n")}`)
    .join("\n\n");
}
