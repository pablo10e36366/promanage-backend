import { z } from 'zod';

export const authConfigSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']).default('HS256'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().max(20).default(10),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

// La configuración se valida a través de validateConfig en ConfigModule
// export const authConfig = authConfigSchema.parse(process.env);
