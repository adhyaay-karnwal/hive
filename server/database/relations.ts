import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  projects: {
    worktrees: r.many.worktrees(),
    sessions: r.many.sessions(),
    messages: r.many.messages(),
    changeComments: r.many.changeComments(),
  },
  worktrees: {
    project: r.one.projects({
      from: r.worktrees.projectId,
      to: r.projects.id,
    }),
    sessions: r.many.sessions(),
    reviews: r.many.reviews(),
  },
  sessions: {
    project: r.one.projects({
      from: r.sessions.projectId,
      to: r.projects.id,
    }),
    worktree: r.one.worktrees({
      from: r.sessions.worktreeId,
      to: r.worktrees.id,
    }),
    parentSession: r.one.sessions({
      from: r.sessions.parentSessionId,
      to: r.sessions.id,
    }),
    childSessions: r.many.sessions(),
    signals: r.many.signals(),
    messages: r.many.messages(),
  },
  signals: {
    session: r.one.sessions({
      from: r.signals.sessionId,
      to: r.sessions.id,
    }),
  },
  messages: {
    session: r.one.sessions({
      from: r.messages.sessionId,
      to: r.sessions.id,
    }),
    project: r.one.projects({
      from: r.messages.projectId,
      to: r.projects.id,
    }),
  },
  reviews: {
    worktree: r.one.worktrees({
      from: r.reviews.worktreeId,
      to: r.worktrees.id,
    }),
    comments: r.many.reviewComments(),
  },
  reviewComments: {
    review: r.one.reviews({
      from: r.reviewComments.reviewId,
      to: r.reviews.id,
    }),
  },
  changeComments: {
    project: r.one.projects({
      from: r.changeComments.projectId,
      to: r.projects.id,
    }),
  },
}));
