import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../../projects/infrastructure/entities/project.entity';

export interface PreviewData {
  data: Buffer;
  mimeType: string;
}

export interface PreviewMeta {
  id: string;
  title: string;
  description: string;
  status: string;
  owner: string;
  updatedAt: Date;
  milestonesCount: number;
  evidencesCount: number;
}

@Injectable()
export class PreviewService {
  private cache = new Map<string, { data: PreviewData; expiry: number }>();
  private metaCache = new Map<string, { data: PreviewMeta; expiry: number }>();
  private TTL = 60000;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async getProjectPreview(projectId: string): Promise<PreviewData> {
    const cached = this.cache.get(projectId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['milestones', 'milestones.evidences'],
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const preview = this.generateSvgPreview(project);

    const data: PreviewData = {
      data: Buffer.from(preview),
      mimeType: 'image/svg+xml',
    };

    this.cache.set(projectId, { data, expiry: Date.now() + this.TTL });

    return data;
  }

  async getProjectMeta(projectId: string): Promise<PreviewMeta> {
    const cached = this.metaCache.get(projectId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['owner', 'milestones', 'milestones.evidences'],
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const meta: PreviewMeta = {
      id: project.id,
      title: project.title,
      description: project.description || '',
      status: project.status,
      owner: project.owner?.name || 'Unknown',
      updatedAt: project.updatedAt,
      milestonesCount: project.milestones?.length || 0,
      evidencesCount:
        project.milestones?.reduce(
          (acc, m) => acc + (m.evidences?.length || 0),
          0,
        ) || 0,
    };

    this.metaCache.set(projectId, {
      data: meta,
      expiry: Date.now() + this.TTL,
    });

    return meta;
  }

  private generateSvgPreview(project: Project): string {
    const statusColors: Record<string, string> = {
      DRAFT: '#94a3b8',
      IN_PROGRESS: '#3b82f6',
      IN_REVIEW: '#f59e0b',
      COMPLETED: '#22c55e',
      PUBLISHED: '#8b5cf6',
    };

    const color = statusColors[project.status] || '#6b7280';
    const milestonesCount = project.milestones?.length || 0;
    const evidencesCount =
      project.milestones?.reduce(
        (acc, m) => acc + (m.evidences?.length || 0),
        0,
      ) || 0;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc"/>
            <stop offset="100%" style="stop-color:#e2e8f0"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1"/>
          </filter>
        </defs>
        
        <rect width="300" height="200" rx="12" fill="url(#bg)" filter="url(#shadow)"/>
        
        <rect x="12" y="12" width="80" height="24" rx="12" fill="${color}"/>
        <text x="52" y="28" font-family="system-ui" font-size="10" fill="white" text-anchor="middle">${project.status}</text>
        
        <text x="12" y="60" font-family="system-ui" font-size="16" font-weight="600" fill="#1e293b">
          ${this.truncateText(project.title, 25)}
        </text>
        
        <text x="12" y="82" font-family="system-ui" font-size="11" fill="#64748b">
          ${this.truncateText(project.description || 'Sin descripción', 40)}
        </text>
        
        <g transform="translate(12, 120)">
          <rect width="80" height="50" rx="8" fill="white" opacity="0.8"/>
          <text x="40" y="22" font-family="system-ui" font-size="18" font-weight="700" fill="#1e293b" text-anchor="middle">${milestonesCount}</text>
          <text x="40" y="38" font-family="system-ui" font-size="9" fill="#64748b" text-anchor="middle">Milestones</text>
        </g>
        
        <g transform="translate(100, 120)">
          <rect width="80" height="50" rx="8" fill="white" opacity="0.8"/>
          <text x="40" y="22" font-family="system-ui" font-size="18" font-weight="700" fill="#1e293b" text-anchor="middle">${evidencesCount}</text>
          <text x="40" y="38" font-family="system-ui" font-size="9" fill="#64748b" text-anchor="middle">Evidencias</text>
        </g>
        
        <text x="288" y="188" font-family="system-ui" font-size="9" fill="#94a3b8" text-anchor="end">
          ${new Date(project.updatedAt).toLocaleDateString('es-ES')}
        </text>
      </svg>
    `.trim();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}
