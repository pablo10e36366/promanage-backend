-- Agregar columnas deadline e is_late a la tabla assignments (migración incremental)
-- Esta migración es compatible con datos existentes

-- Agregar columna deadline (puede ser NULL)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deadline TIMESTAMP;

-- Agregar columna is_late con valor por defecto FALSE
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE;

-- Actualizar is_late para entregas existentes que tengan deadline y submittedAt
UPDATE assignments 
SET is_late = TRUE 
WHERE deadline IS NOT NULL 
  AND submitted_at IS NOT NULL 
  AND submitted_at > deadline;

-- Crear índice para búsquedas por deadline
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);

-- Crear índice para búsquedas por is_late
CREATE INDEX IF NOT EXISTS idx_assignments_is_late ON assignments(is_late);

SELECT 'Columnas deadline e is_late agregadas exitosamente a la tabla assignments' as result;