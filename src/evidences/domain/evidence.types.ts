import type { EvidenceStatus, EvidenceType } from './evidence.enums';

export type CreateEvidenceInput = {
  milestoneId: string;
  url?: string;
  description?: string;
  title?: string;
  type: EvidenceType;
  isFolder?: boolean;
  mimeType?: string;
  contentBlob?: string | null;
  parentId?: string | null;
  assignmentId?: string;
};

export type ReviewEvidenceInput = {
  status: EvidenceStatus;
  feedback?: string;
};

export type CreateFolderInput = {
  projectId: string;
  parentId?: string;
  name: string;
  description?: string;
};

export type CreateFileInput = {
  projectId: string;
  milestoneId?: string;
  parentId?: string;
  name?: string;
};

export type UpdateContentInput = {
  content: string;
};

export type EvidenceDownloadInfo = {
  filePath: string;
  mimeType: string;
  dispositionFilename: string;
};

