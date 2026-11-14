import { z } from "zod";

const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    APP_URL: z.string().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(16).default("dev-only-secret-change-me"),
    DB_PATH: z.string().default("./data/syncscribe.db"),
    SMTP_URL: z.string().optional(),
  })
  .parse(process.env);

export const config = env;
