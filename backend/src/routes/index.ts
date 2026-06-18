import { Router } from "express";
import { authRouter } from "./auth.js";
import { blogsRouter } from "./blogs.js";
import { chatRouter } from "./chat.js";
import { filesRouter } from "./files.js";
import { profileRouter } from "./profile.js";
import { projectsRouter } from "./projects.js";
import { resumesRouter } from "./resumes.js";
import { skillsRouter } from "./skills.js";
import { uploadsRouter } from "./uploads.js";
import { usersRouter } from "./users.js";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({ service: "portfolio-backend", version: "0.1.0" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/skills", skillsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/blogs", blogsRouter);
apiRouter.use("/resumes", resumesRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/chat", chatRouter);
