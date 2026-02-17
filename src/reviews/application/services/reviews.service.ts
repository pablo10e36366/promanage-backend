import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus } from '../../infrastructure/entities/review.entity';
import { Project } from '../../../projects/infrastructure/entities/project.entity';
import { User } from '../../../users/infrastructure/entities/user.entity';

export class CreateReviewDto {
  status: ReviewStatus;
  score?: number;
  feedback?: string;
  details?: any;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    projectId: string,
    userId: number,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const review = this.reviewRepository.create({
      project,
      author: user,
      status: dto.status,
      score: dto.score,
      feedback: dto.feedback,
      details: dto.details,
    });

    return this.reviewRepository.save(review);
  }

  async findByProject(projectId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { project: { id: projectId } },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }
}
