import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Project,
  ProjectStatus,
} from '../../../projects/infrastructure/entities/project.entity';

export interface RadarNode {
  id: string;
  title: string;
  x: number;
  y: number;
  r: number;
  color: string;
  status: string;
}

@Injectable()
export class RadarService {
  private statusColors: Record<string, string> = {
    [ProjectStatus.DRAFT]: '#94a3b8',
    [ProjectStatus.IN_PROGRESS]: '#3b82f6',
    [ProjectStatus.IN_REVIEW]: '#f59e0b',
    [ProjectStatus.COMPLETED]: '#22c55e',
  };

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async getRadarData(userId: number): Promise<RadarNode[]> {
    const projects = await this.projectRepo.find({
      where: { owner: { id: userId } },
      relations: ['milestones', 'milestones.evidences'],
    });

    return projects.map((project) => this.projectToRadarNode(project));
  }

  private projectToRadarNode(project: Project): RadarNode {
    let x = 50;
    if (project.deadline) {
      const now = new Date().getTime();
      const deadline = new Date(project.deadline).getTime();
      const diffDays = (deadline - now) / (1000 * 60 * 60 * 24);

      if (diffDays <= 0) {
        x = 100;
      } else if (diffDays <= 1) {
        x = 95;
      } else if (diffDays <= 3) {
        x = 80;
      } else if (diffDays <= 7) {
        x = 60;
      } else if (diffDays <= 14) {
        x = 40;
      } else {
        x = Math.max(10, 30 - diffDays);
      }
    } else {
      const hash = this.simpleHash(project.id);
      x = 30 + (hash % 40);
    }

    const evidencesCount =
      project.milestones?.reduce(
        (acc, m) => acc + (m.evidences?.length || 0),
        0,
      ) || 0;
    let y = Math.min(100, evidencesCount * 10 + 20);

    if (evidencesCount === 0) {
      const hash = this.simpleHash(project.id);
      y = 30 + ((hash * 7) % 40);
    }

    const milestonesCount = project.milestones?.length || 0;
    const r = Math.min(40, Math.max(15, milestonesCount * 8 + 10));

    return {
      id: project.id,
      title: project.title,
      x,
      y,
      r,
      color: this.statusColors[project.status] || '#6b7280',
      status: project.status,
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }
    return Math.abs(hash);
  }

  async generateRadarSvg(userId: number): Promise<string> {
    const nodes = await this.getRadarData(userId);

    const width = 600;
    const height = 400;
    const padding = 40;

    const circles = nodes
      .map((node) => {
        const cx = padding + (node.x / 100) * (width - 2 * padding);
        const cy = height - padding - (node.y / 100) * (height - 2 * padding);

        return `
        <g class="node" data-id="${node.id}">
          <circle cx="${cx}" cy="${cy}" r="${node.r}" 
            fill="${node.color}" fill-opacity="0.7" 
            stroke="${node.color}" stroke-width="2"/>
          <text x="${cx}" y="${cy + 4}" 
            font-family="system-ui" font-size="10" 
            fill="white" text-anchor="middle">
            ${node.title.slice(0, 8)}${node.title.length > 8 ? '...' : ''}
          </text>
        </g>
      `;
      })
      .join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a"/>
            <stop offset="100%" style="stop-color:#1e293b"/>
          </linearGradient>
        </defs>
        
        <rect width="${width}" height="${height}" rx="12" fill="url(#bgGrad)"/>
        
        <g stroke="#334155" stroke-width="1" opacity="0.3">
          ${[0.25, 0.5, 0.75]
            .map(
              (p) => `
            <line x1="${padding}" y1="${height * p}" x2="${width - padding}" y2="${height * p}"/>
            <line x1="${width * p}" y1="${padding}" x2="${width * p}" y2="${height - padding}"/>
          `,
            )
            .join('')}
        </g>
        
        <text x="${width / 2}" y="${height - 10}" 
          font-family="system-ui" font-size="11" fill="#64748b" text-anchor="middle">
          Urgencia (Deadline) →
        </text>
        <text x="12" y="${height / 2}" 
          font-family="system-ui" font-size="11" fill="#64748b" 
          text-anchor="middle" transform="rotate(-90, 12, ${height / 2})">
          Tamaño (Evidencias) →
        </text>
        
        <rect x="${width - padding - 80}" y="${padding}" width="80" height="${height - 2 * padding}" 
          fill="#ef4444" fill-opacity="0.1" rx="8"/>
        
        ${circles}
        
        <g transform="translate(${padding}, ${padding})">
          <rect width="100" height="70" rx="6" fill="#1e293b" stroke="#334155"/>
          <text x="8" y="16" font-family="system-ui" font-size="9" fill="#94a3b8">Estado</text>
          ${Object.entries(this.statusColors)
            .slice(0, 4)
            .map(
              ([status, color], i) => `
            <circle cx="16" cy="${30 + i * 12}" r="4" fill="${color}"/>
            <text x="26" y="${33 + i * 12}" font-family="system-ui" font-size="8" fill="#e2e8f0">${status}</text>
          `,
            )
            .join('')}
        </g>
      </svg>
    `.trim();
  }
}
