import { db } from "../../../database";
import { projects } from "../../../database/schema";
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
    let diff = await git.diff(["HEAD"]);
    if (!diff) {
      diff = await git.diff(["--cached"]);
    }
    return { diff: diff || "" };
  } catch {
    return { diff: "" };
  }
});
