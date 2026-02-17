-- Drop table if exists (cascading)
DROP TABLE IF EXISTS assignments CASCADE;

-- Create assignments table
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidences(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'ENTREGADO', 'REVISADO')),
  submitted_at TIMESTAMP,
  deadline TIMESTAMP,
  is_late BOOLEAN DEFAULT FALSE,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Constraints
  UNIQUE(project_id, student_id, milestone_id) -- Un estudiante puede tener solo una entrega por milestone en un proyecto
);

-- Create indexes
CREATE INDEX idx_assignments_project ON assignments(project_id);
CREATE INDEX idx_assignments_student ON assignments(student_id);
CREATE INDEX idx_assignments_milestone ON assignments(milestone_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_submitted_at ON assignments(submitted_at);

SELECT 'assignments table created successfully!' as result;