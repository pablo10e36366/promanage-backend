import type { ProjectStatus } from './project-status';

export type CreateProjectInput = {
  title: string;
  description?: string;
  status?: ProjectStatus;
  repositoryUrl?: string;
  isPublic?: boolean;
};

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  isArchived?: boolean;
};

export type ShareProjectInput = {
  targetUserId?: string;
  action: string;
  scheduledDate?: string;
  message?: string;
};

export type RepositoryHeader = {
  title: string;
  description: string;
  owner: string;
  avatarUrl: string;
  status: ProjectStatus;
  tags: string[];
};

export type RepositoryStats = {
  commits: number;
  contributors: number;
  lastUpdate: string;
};

export type RepositoryFileTreeItem = {
  name: string;
  type: 'file' | 'dir';
  message: string;
  date: string;
};

export type RepositoryView = {
  header: RepositoryHeader;
  stats: RepositoryStats;
  fileTree: RepositoryFileTreeItem[];
  readme: string;
};

export type ProjectDownloadInfo = {
  filename: string;
  filePath: string;
};

