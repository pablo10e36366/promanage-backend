-- Migration: Add User Security Columns and Project Archive Columns
-- Run this SQL directly in your PostgreSQL database

-- ====== USERS TABLE ======
-- Add isActive column with default true
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

-- Add blockedAt column (nullable)
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "blockedAt" timestamp NULL;

-- Add blockedBy column (nullable, references admin user ID)
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "blockedBy" integer NULL;

-- ====== PROJECTS TABLE ======
-- Add isArchived column with default false
ALTER TABLE "projects" 
ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false;

-- Add archivedAt column (nullable)
ALTER TABLE "projects" 
ADD COLUMN IF NOT EXISTS "archivedAt" timestamp NULL;

-- Add archivedBy column (nullable, references admin user ID)
ALTER TABLE "projects" 
ADD COLUMN IF NOT EXISTS "archivedBy" integer NULL;

-- Verify the changes
SELECT 'users columns:' as table_info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('isActive', 'blockedAt', 'blockedBy')
ORDER BY column_name;

SELECT 'projects columns:' as table_info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('isArchived', 'archivedAt', 'archivedBy')
ORDER BY column_name;
