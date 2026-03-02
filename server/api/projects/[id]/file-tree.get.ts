import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";

export type FileTreeNode =
  | { type: "file"; name: string; path: string }
  | { type: "dir"; name: string; path: string; children: FileTreeNode[] };

const IGNORED = new Set([
  ".git", "node_modules", ".nuxt", ".output", "dist", ".cache",
  ".turbo", "coverage", ".next", ".svelte-kit", "__pycache__",
]);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "id is required" });

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) throw createError({ statusCode: 404, message: "Project not found" });

  const tree = await buildTree(project.path, project.path);
  return { tree };
});

async function buildTree(dir: string, root: string): Promise<FileTreeNode[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const dirs: FileTreeNode[] = [];
  const files: FileTreeNode[] = [];

  for (const name of entries.sort((a, b) => a.localeCompare(b))) {
    if (name.startsWith(".") || IGNORED.has(name)) continue;

    const abs = join(dir, name);
    const rel = relative(root, abs);

    let s: Awaited<ReturnType<typeof stat>>;
    try {
      s = await stat(abs);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      dirs.push({
        type: "dir",
        name,
        path: rel,
        children: await buildTree(abs, root),
      });
    } else {
      files.push({ type: "file", name, path: rel });
    }
  }

  return [...dirs, ...files];
}
