-- Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" SERIAL PRIMARY KEY,
  "storageLimit" integer NOT NULL DEFAULT 1000,
  "allowedFileTypes" varchar NOT NULL DEFAULT '.pdf,.doc,.docx,.zip',
  "maxReviewDays" integer NOT NULL DEFAULT 30,
  "auditLogsEnabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Insert default settings if table is empty
INSERT INTO "system_settings" (id, "storageLimit", "allowedFileTypes", "maxReviewDays", "auditLogsEnabled")
SELECT 1, 1000, '.pdf,.doc,.docx,.zip', 30, true
WHERE NOT EXISTS (SELECT 1 FROM "system_settings" WHERE id = 1);
