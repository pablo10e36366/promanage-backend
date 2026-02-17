import { z } from 'zod';

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGIN: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const appConfig = appConfigSchema.parse(process.env);
