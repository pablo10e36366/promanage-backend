-- Drop table if exists (cascading)
DROP TABLE IF EXISTS project_access CASCADE;

-- Create project_access table
CREATE TABLE project_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('VIEW', 'EDIT')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Create indexes
CREATE INDEX idx_project_access_project ON project_access(project_id);
CREATE INDEX idx_project_access_user ON project_access(user_id);
CREATE INDEX idx_project_access_status ON project_access(status);

SELECT 'project_access table created successfully!' as result;
