import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Evidence } from '../../../evidences/infrastructure/entities/evidence.entity';

@Injectable()
export class CollaborativeService {
  private readonly logger = new Logger(CollaborativeService.name);

  private redisStorage = new Map<string, string>();
  private dirtyDocuments = new Set<string>();

  constructor(
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
  ) {}

  async updateDocumentContent(
    documentId: string,
    content: string,
  ): Promise<void> {
    this.redisStorage.set(`doc:${documentId}`, content);
    this.dirtyDocuments.add(documentId);
  }

  async getDocumentContent(documentId: string): Promise<string> {
    if (this.redisStorage.has(`doc:${documentId}`)) {
      return this.redisStorage.get(`doc:${documentId}`) || '';
    }

    const evidence = await this.evidenceRepo.findOne({
      where: { id: documentId },
    });
    const content = evidence?.contentBlob || '';

    this.redisStorage.set(`doc:${documentId}`, content);
    return content;
  }

  @Interval(30000)
  async persistChangesToDatabase() {
    if (this.dirtyDocuments.size === 0) return;

    this.logger.log(
      `Persisting ${this.dirtyDocuments.size} documents to DB...`,
    );

    const docsToSave = Array.from(this.dirtyDocuments);
    this.dirtyDocuments.clear();

    for (const docId of docsToSave) {
      const content = this.redisStorage.get(`doc:${docId}`);
      if (content !== undefined) {
        try {
          await this.evidenceRepo.update(docId, { contentBlob: content });
        } catch (error) {
          this.logger.error(`Failed to persist document ${docId}`, error);
          this.dirtyDocuments.add(docId);
        }
      }
    }
  }

  async isDocumentLocked(documentId: string): Promise<boolean> {
    try {
      const evidence = await this.evidenceRepo.findOne({
        where: { id: documentId },
        relations: ['milestone', 'milestone.project'],
      });

      if (!evidence?.milestone?.project?.deadline) {
        return false;
      }

      const deadline = new Date(evidence.milestone.project.deadline);
      const now = new Date();

      return now > deadline;
    } catch (error) {
      this.logger.error(`Error checking document lock: ${documentId}`, error);
      return false;
    }
  }
}
