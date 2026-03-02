import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const git = simpleGit(project.path);

  try {
    // Get file status first — this always works
    const status = await git.status();
    const files = [
      ...status.modified.map((path) => ({ path, status: "M" as const })),
      ...status.created.map((path) => ({ path, status: "A" as const })),
      ...status.deleted.map((path) => ({ path, status: "D" as const })),
      ...status.renamed.map((r) => ({ path: r.to, status: "R" as const })),
      ...status.not_added.map((path) => ({ path, status: "?" as const })),
    ];

    // Try to get a diff
    let diff = "";

    // Check if repo has any commits
    let hasCommits = true;
    try {
      await git.log(["-1"]);
    } catch {
      hasCommits = false;
    }

    if (hasCommits) {
      // Normal case: diff against HEAD (shows both staged + unstaged vs last commit)
      diff = await git.diff(["HEAD"]);

      if (!diff) {
        // Maybe only staged changes
        diff = await git.diff(["--cached"]);
      }
      if (!diff) {
        // Maybe only unstaged changes
        diff = await git.diff();
      }
    } else {
      // No commits yet — diff staged files against empty tree
      diff = await git.diff(["--cached"]);
    }

    // Get branch name
    let branch = "";
    try {
      const branchResult = await git.revparse(["--abbrev-ref", "HEAD"]);
      branch = branchResult.trim();
    } catch {
      // May fail if no commits exist yet
    }

    // Get repo name from remote origin URL, fall back to directory basename
    let repoName = project.path.split("/").filter(Boolean).pop() || "";
    try {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");
      if (origin?.refs?.fetch) {
        const url = origin.refs.fetch;
        // Extract repo name from URL like git@github.com:user/repo.git or https://github.com/user/repo.git
        const match = url.match(/\/([^/]+?)(?:\.git)?$/) || url.match(/:([^/]+\/[^/]+?)(?:\.git)?$/);
        if (match) {
          repoName = match[1];
        }
      }
    } catch {
      // Ignore — fall back to directory name
    }

    return { diff: diff || "", files, branch, repoName };
  } catch (e: any) {
    console.error(`[changes] Error for project ${id}:`, e.message);
    return { diff: "", files: [], branch: "", repoName: "" };
  }
});
