import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateReviewDto,
  ReviewsService,
} from '../../application/services/reviews.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';

@Controller('projects/:projectId/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles('professor', 'admin')
  async createReview(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: any,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(projectId, req.user.id, dto);
  }

  @Get()
  async getReviews(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.reviewsService.findByProject(projectId);
  }
}

