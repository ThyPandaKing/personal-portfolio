import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openapiSpec } from "./docs/openapi.js";
import { attachUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "backend" }));

  // API docs (Swagger UI + raw OpenAPI JSON)
  app.get("/api/docs.json", (_req, res) => res.json(openapiSpec));
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: "Portfolio API Docs",
      swaggerOptions: { withCredentials: true, persistAuthorization: true },
    }),
  );

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
