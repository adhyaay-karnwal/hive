import { db } from "../../../database";
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
    const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    await git.push("origin", branch, ["--set-upstream"]);

    return { ok: true, branch };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message || "Failed to push" });
  }
});
