import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './application/services/reviews.service';
import { ReviewsController } from './presentation/controllers/reviews.controller';
import { Review } from './infrastructure/entities/review.entity';
import { Project } from '../projects/infrastructure/entities/project.entity';
import { User } from '../users/infrastructure/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Project, User])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
