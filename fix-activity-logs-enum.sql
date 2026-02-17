-- Add missing enum values to activity_logs_action_enum
-- This fixes errors when admin blocks/unblocks users or changes roles

ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_ROLE_CHANGE';
ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_BLOCKED';
ALTER TYPE activity_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_UNBLOCKED';

SELECT 'activity_logs enum values added successfully!' as result;
