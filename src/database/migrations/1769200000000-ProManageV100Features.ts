import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProManageV100Features1769200000000 implements MigrationInterface {
  name = 'ProManageV100Features1769200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // 1. ACTUALIZAR ROLES
    // =============================================

    // Insertar nuevos roles si no existen
    await queryRunner.query(`
      INSERT INTO roles (name) 
      SELECT unnest(ARRAY['user', 'student', 'collaborator', 'mentor', 'professor'])
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'user')
      ON CONFLICT (name) DO NOTHING
    `);

    // Añadir columna description a roles si no existe
    await queryRunner.query(`
      ALTER TABLE roles 
      ADD COLUMN IF NOT EXISTS description VARCHAR(255)
    `);

    // =============================================
    // 2. ACTUALIZAR PROJECTS
    // =============================================

    // Añadir columna validatedBy
    await queryRunner.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS "validatedBy" INTEGER
    `);

    // Actualizar enum de status si es necesario (PostgreSQL)
    // Primero verificar si el valor 'draft' existe
    await queryRunner.query(`
      DO $$ 
      BEGIN
        -- Intentar añadir nuevos valores al enum
        BEGIN
          ALTER TYPE projects_status_enum ADD VALUE IF NOT EXISTS 'draft';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE projects_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE projects_status_enum ADD VALUE IF NOT EXISTS 'in_review';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE projects_status_enum ADD VALUE IF NOT EXISTS 'completed';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);

    // =============================================
    // 3. CREAR TABLA VERSIONS
    // =============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        title VARCHAR(255),
        "changeDescription" VARCHAR(500),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "evidenceId" UUID NOT NULL,
        "authorId" INTEGER NOT NULL,
        CONSTRAINT fk_versions_evidence 
          FOREIGN KEY ("evidenceId") 
          REFERENCES evidences(id) 
          ON DELETE CASCADE,
        CONSTRAINT fk_versions_author 
          FOREIGN KEY ("authorId") 
          REFERENCES users(id) 
          ON DELETE SET NULL
      )
    `);

    // Índices para versions
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_versions_evidence 
      ON versions("evidenceId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_versions_created 
      ON versions("createdAt" DESC)
    `);

    // =============================================
    // 4. CREAR TABLA MESSAGES
    // =============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "isEdited" BOOLEAN DEFAULT FALSE,
        "threadId" UUID,
        "projectId" UUID NOT NULL,
        "authorId" INTEGER NOT NULL,
        CONSTRAINT fk_messages_project 
          FOREIGN KEY ("projectId") 
          REFERENCES projects(id) 
          ON DELETE CASCADE,
        CONSTRAINT fk_messages_author 
          FOREIGN KEY ("authorId") 
          REFERENCES users(id) 
          ON DELETE SET NULL,
        CONSTRAINT fk_messages_thread 
          FOREIGN KEY ("threadId") 
          REFERENCES messages(id) 
          ON DELETE CASCADE
      )
    `);

    // Índices para messages
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_project 
      ON messages("projectId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_thread 
      ON messages("threadId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created 
      ON messages("createdAt" DESC)
    `);

    // =============================================
    // 5. ACTUALIZAR ACTIVITY_LOGS (Reactions)
    // =============================================

    // Añadir columna reactions (JSONB)
    await queryRunner.query(`
      ALTER TABLE activity_logs 
      ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'
    `);

    // Actualizar enum de action para nuevas acciones
    await queryRunner.query(`
      DO $$ 
      BEGIN
        BEGIN
          ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'PROJECT_STATUS_CHANGE';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'PROJECT_UPDATE';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'PROJECT_DELETE';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'MESSAGE_SENT';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);

    console.log('✅ Migración ProManage v1.0.0 completada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar tablas nuevas
    await queryRunner.query(`DROP TABLE IF EXISTS messages CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS versions CASCADE`);

    // Eliminar columnas añadidas
    await queryRunner.query(`
      ALTER TABLE activity_logs 
      DROP COLUMN IF EXISTS reactions
    `);

    await queryRunner.query(`
      ALTER TABLE projects 
      DROP COLUMN IF EXISTS "validatedBy"
    `);

    await queryRunner.query(`
      ALTER TABLE roles 
      DROP COLUMN IF EXISTS description
    `);

    console.log('⬇️ Rollback ProManage v1.0.0 completado');
  }
}
