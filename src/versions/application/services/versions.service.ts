import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Version } from '../../infrastructure/entities/version.entity';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class VersionsService {
  constructor(
    @InjectRepository(Version)
    private readonly versionRepo: Repository<Version>,
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
  ) {}

  async createVersion(
    evidenceId: string,
    user: User,
    changeDescription?: string,
  ): Promise<Version> {
    const evidence = await this.evidenceRepo.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidencia ${evidenceId} no encontrada`);
    }

    const version = this.versionRepo.create({
      evidenceId,
      content: evidence.contentBlob || '',
      title: evidence.title,
      changeDescription,
      authorId: user.id,
    });

    return this.versionRepo.save(version);
  }

  async findByEvidence(evidenceId: string): Promise<Version[]> {
    return this.versionRepo.find({
      where: { evidenceId },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(versionId: string): Promise<Version> {
    const version = await this.versionRepo.findOne({
      where: { id: versionId },
      relations: ['author', 'evidence'],
    });

    if (!version) {
      throw new NotFoundException(`Versión ${versionId} no encontrada`);
    }

    return version;
  }

  async restoreVersion(versionId: string, user: User): Promise<Evidence> {
    const version = await this.findOne(versionId);

    await this.createVersion(
      version.evidenceId,
      user,
      `Estado antes de restaurar a versión del ${version.createdAt.toISOString()}`,
    );

    await this.evidenceRepo.update(version.evidenceId, {
      contentBlob: version.content,
    });

    const evidence = await this.evidenceRepo.findOne({
      where: { id: version.evidenceId },
    });

    return evidence!;
  }

  async compareVersions(
    versionId1: string,
    versionId2: string,
  ): Promise<{ version1: Version; version2: Version; isDifferent: boolean }> {
    const [version1, version2] = await Promise.all([
      this.findOne(versionId1),
      this.findOne(versionId2),
    ]);

    return {
      version1,
      version2,
      isDifferent: version1.content !== version2.content,
    };
  }
}
