import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function list(name: string, fallback = ""): string[] {
  return required(name, fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: (process.env.NODE_ENV ?? "development") === "production",

  clientOrigins: list("CLIENT_ORIGINS", "http://localhost:3000,http://localhost:5173"),

  mongoUri: required("MONGO_URI", "mongodb://localhost:27017/portfolio"),
  mongoDb: required("MONGO_DB", "portfolio"),

  adminEmails: list("ADMIN_EMAILS", "").map((e) => e.toLowerCase()),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  // Leave COOKIE_DOMAIN unset for cross-site prod (Vercel + Render) so the
  // cookie binds to the backend host automatically.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",

  agentServiceUrl: required("AGENT_SERVICE_URL", "http://localhost:8001"),
  internalApiKey: required("INTERNAL_API_KEY", "change-me-shared-with-backend"),

  publicBaseUrl: required("PUBLIC_BASE_URL", "http://localhost:4000"),
};

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && env.adminEmails.includes(email.toLowerCase());
