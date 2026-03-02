import { db } from "../database";
import {
  sessions,
  worktrees,
  reviews,
} from "../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { buildWorkerPrompt, buildReviewerPrompt } from "./prompt-builder";
import { createWorktree } from "./worktree";
import { installDeps } from "./worktree";
import { runAgent } from "./agent";

/**
 * Full lifecycle: create a worktree, start an agent, delegate a task.
 */
export async function delegateTask(opts: {
  projectId: string;
  branchName: string;
  taskDescription: string;
  linearIssueId?: string;
  linearIssueIdentifier?: string;
}): Promise<{
  worktreeId: string;
  sessionId: string;
}> {
  const project = await db.query.projects.findFirst({
    where: { id: opts.projectId },
  });

  if (!project) throw new Error("Project not found");

  // 1. Create worktree
  const worktreePath = await createWorktree(project.path, opts.branchName);
  const worktreeId = nanoid();

  await db.insert(worktrees).values({
    id: worktreeId,
    projectId: opts.projectId,
    branchName: opts.branchName,
    path: worktreePath,
    status: "active",
    linearIssueId: opts.linearIssueId,
    linearIssueIdentifier: opts.linearIssueIdentifier,
  });

  // 2. Install deps (background)
  if (project.installCommand) {
    installDeps(worktreePath, project.installCommand).then((result) => {
      if (!result.success) {
        console.error(`[orchestrator] Install failed for ${opts.branchName}`);
      }
    });
  }

  // 3. Create session record
  const sessionId = nanoid();
  await db.insert(sessions).values({
    id: sessionId,
    projectId: opts.projectId,
    worktreeId,
    role: "worker",
    status: "working",
  });

  // 4. Build and run the worker agent
  const prompt = await buildWorkerPrompt({
    taskDescription: opts.taskDescription,
    worktreeId,
  });

  // Run the agent in the background (non-blocking)
  runAgent({
    messages: [{ role: "user", content: prompt }],
    projectPath: worktreePath,
    modelPreference: "sonnet",
    systemPrompt: prompt,
  })
    .then(async (result) => {
      // Wait for the stream to complete
      await result.text;
      await db
        .update(sessions)
        .set({ status: "done" })
        .where(eq(sessions.id, sessionId));
    })
    .catch(async (e) => {
      console.error("[orchestrator] Agent failed:", e);
      await db
        .update(sessions)
        .set({ status: "error" })
        .where(eq(sessions.id, sessionId));
    });

  return { worktreeId, sessionId };
}

/**
 * Trigger the review loop for a worktree.
 * Creates a review, spawns a reviewer session, sends the diff.
 */
export async function triggerReview(worktreeId: string): Promise<string> {
  const worktree = await db.query.worktrees.findFirst({
    where: { id: worktreeId },
  });

  if (!worktree) {
    throw new Error("Worktree not found");
  }

  // Get the diff from the worktree
  const { default: simpleGit } = await import("simple-git");
  const git = simpleGit(worktree.path);
  let diff = "";

  try {
    diff = await git.diff(["HEAD"]);
    if (!diff) {
      diff = await git.diff(["--cached"]);
    }
  } catch {
    // no diff available
  }

  if (!diff) {
    throw new Error("No changes to review");
  }

  // Create review record
  const reviewId = nanoid();
  await db.insert(reviews).values({
    id: reviewId,
    worktreeId,
    status: "agent_review",
    iteration: 1,
  });

  // Create a reviewer session
  const reviewerSessionId = nanoid();
  await db.insert(sessions).values({
    id: reviewerSessionId,
    projectId: worktree.projectId,
    worktreeId,
    role: "reviewer",
    status: "working",
  });

  // Update review with session ID
  await db
    .update(reviews)
    .set({ reviewerSessionId })
    .where(eq(reviews.id, reviewId));

  // Build and run the reviewer agent
  const reviewPrompt = await buildReviewerPrompt(diff);

  runAgent({
    messages: [{ role: "user", content: reviewPrompt }],
    projectPath: worktree.path,
    modelPreference: "sonnet",
    systemPrompt: reviewPrompt,
  })
    .then(async (result) => {
      await result.text;
      await db
        .update(sessions)
        .set({ status: "done" })
        .where(eq(sessions.id, reviewerSessionId));
    })
    .catch(async (e) => {
      console.error("[orchestrator] Reviewer agent failed:", e);
      await db
        .update(sessions)
        .set({ status: "error" })
        .where(eq(sessions.id, reviewerSessionId));
    });

  return reviewId;
}
