import simpleGit from "simple-git";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";

/**
 * Create a git worktree for a branch.
 * Worktrees are placed in a sibling `.hive-worktrees/` directory
 * next to the main repo, keeping things clean.
 */
export async function createWorktree(
  projectPath: string,
  branchName: string,
): Promise<string> {
  const git = simpleGit(projectPath);

  // Worktree directory: ../.hive-worktrees/<repo-name>/<branch-slug>
  const repoName = projectPath.split("/").pop() || "project";
  const branchSlug = branchName.replace(/\//g, "-");
  const worktreeBase = join(dirname(projectPath), ".hive-worktrees", repoName);
  const worktreePath = join(worktreeBase, branchSlug);

  if (existsSync(worktreePath)) {
    // Worktree already exists, just return the path
    return worktreePath;
  }

  // Check if branch exists remotely or locally
  const branches = await git.branch();

  if (branches.all.includes(branchName)) {
    // Branch exists, create worktree from it
    await git.raw(["worktree", "add", worktreePath, branchName]);
  } else if (
    branches.all.includes(`remotes/origin/${branchName}`)
  ) {
    // Remote branch exists, track it
    await git.raw([
      "worktree",
      "add",
      "--track",
      "-b",
      branchName,
      worktreePath,
      `origin/${branchName}`,
    ]);
  } else {
    // New branch, create from current HEAD
    await git.raw([
      "worktree",
      "add",
      "-b",
      branchName,
      worktreePath,
    ]);
  }

  return worktreePath;
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(
  projectPath: string,
  worktreePath: string,
): Promise<void> {
  const git = simpleGit(projectPath);
  await git.raw(["worktree", "remove", worktreePath, "--force"]);
}

/**
 * Install dependencies in a worktree directory.
 */
export function installDeps(
  worktreePath: string,
  installCommand: string,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = installCommand.split(" ");
    let output = "";

    const child = spawn(cmd, args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.on("exit", (code) => {
      resolve({ success: code === 0, output });
    });
    child.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

/**
 * List existing worktrees for a repo.
 */
export async function listWorktrees(
  projectPath: string,
): Promise<{ path: string; branch: string }[]> {
  const git = simpleGit(projectPath);
  const result = await git.raw(["worktree", "list", "--porcelain"]);

  const worktrees: { path: string; branch: string }[] = [];
  let currentPath = "";
  let currentBranch = "";

  for (const line of result.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.replace("worktree ", "");
    } else if (line.startsWith("branch ")) {
      currentBranch = line.replace("branch refs/heads/", "");
    } else if (line === "") {
      if (currentPath && currentBranch) {
        worktrees.push({ path: currentPath, branch: currentBranch });
      }
      currentPath = "";
      currentBranch = "";
    }
  }

  return worktrees;
}
