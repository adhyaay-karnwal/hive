import { db } from "../database";
import { devProfile, sessions } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { platform, release, homedir } from "os";

function getPlatformContext(): string {
  const os = platform();
  const osRelease = release();
  const home = homedir();

  if (os === "win32") {
    return [
      "## Platform",
      `- OS: Windows (${osRelease})`,
      `- Home directory: ${home}`,
      "- Default shell: PowerShell",
      "- Use PowerShell-compatible commands (e.g. `Get-ChildItem` instead of `ls`, `Remove-Item` instead of `rm`, `Select-String` instead of `grep`).",
      "- Use semicolons or separate lines to chain commands, not `&&`.",
      "- Path separators are backslashes (`\\`), but forward slashes (`/`) generally work too.",
      "- Use `$env:VAR` for environment variables, not `$VAR`.",
      "- Common tools like `git`, `node`, `npm`, `bun` work the same across platforms.",
      "- Do NOT use Unix-only commands like `chmod`, `chown`, `sed`, `awk`, `cat` (use `Get-Content`), `touch` (use `New-Item`), `which` (use `Get-Command`).",
    ].join("\n");
  }

  const osName = os === "darwin" ? "macOS" : "Linux";
  return [
    "## Platform",
    `- OS: ${osName} (${osRelease})`,
    `- Home directory: ${home}`,
    "- Default shell: bash",
    "- Use standard Unix/bash commands.",
  ].join("\n");
}

/**
 * Build the full system prompt for the main agent, including
 * developer profile and active session info.
 */
export async function buildSystemPrompt(projectId: string, mode: "build" | "plan" = "build"): Promise<string> {
  // Load the appropriate template based on mode
  const templateName = mode === "plan" ? "plan-agent.md" : "main-agent.md";
  const template = loadTemplate(templateName);
  
  // If plan mode template doesn't exist, fall back to main-agent with plan instructions
  const templateContent = template.includes("Template not found") 
    ? loadTemplate("main-agent.md") 
    : template;
    
  const profile = await loadDevProfile();
  const activeSessions = await getActiveSessionsSummary(projectId);
  const platformContext = getPlatformContext();

  // Add mode-specific instructions
  const modeInstructions = mode === "plan" 
    ? "\n\n## Mode: Planning\nYou are in PLANNING mode. Focus on analyzing the codebase, understanding the requirements, and creating a detailed plan before making any changes. Do not modify files unless explicitly requested."
    : "\n\n## Mode: Building\nYou are in BUILDING mode. You can make changes to the codebase as needed to complete tasks.";

  return templateContent
    .replace("{{dev_profile}}", profile)
    .replace("{{active_sessions}}", activeSessions)
    + "\n\n" + platformContext
    + modeInstructions;
}


/**
 * Build a prompt for the main orchestrator agent.
 */
export async function buildMainPrompt(
  projectId: string,
  mode: "build" | "plan" = "build",
): Promise<string> {
  return buildSystemPrompt(projectId, mode);
}


/**
 * Build a prompt for a worker agent by injecting:
 * - Developer profile preferences
 * - Skills (convention files)
 * - Task description
 * - Platform context
 */
export async function buildWorkerPrompt(opts: {
  taskDescription: string;
  worktreeId?: string;
}): Promise<string> {
  const template = loadTemplate("worker-agent.md");
  const profile = await loadDevProfile();
  const skills = loadSkills();
  const platformContext = getPlatformContext();

  return template
    .replace("{{task_description}}", opts.taskDescription)
    .replace("{{dev_profile}}", profile)
    .replace("{{skills}}", skills)
    + "\n\n" + platformContext;
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
