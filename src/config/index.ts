import { z } from 'zod';
import { appConfigSchema } from './app.config';
import { databaseConfigSchema } from './database.config';
import { authConfigSchema } from './auth.config';

// Esquema combinado para validación global
const configSchema = appConfigSchema
  .merge(databaseConfigSchema)
  .merge(authConfigSchema);

export type Config = z.infer<typeof configSchema>;

// Función de validación para ConfigModule
export function validateConfig(config: Record<string, unknown>): Config {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new Error(`Configuración inválida: ${errors}`);
    }
    throw error;
  }
}

// Exportar configuraciones individuales (opcional)
export { appConfigSchema, databaseConfigSchema, authConfigSchema };
