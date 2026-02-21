import { z } from 'zod';

export const databaseConfigSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST es requerido'),
  DB_PORT: z.coerce.number().int().positive().max(65535).default(5432),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME es requerido'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD es requerido'),
  DB_NAME: z.string().min(1, 'DB_NAME es requerido'),
  DB_SSL: z
    .string()
    .optional()
    .default('false')
    .transform((val) => ['true', '1', 'yes'].includes(val.toLowerCase())),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

// La configuración se valida a través de validateConfig en ConfigModule.
// export const databaseConfig = databaseConfigSchema.parse(process.env);
