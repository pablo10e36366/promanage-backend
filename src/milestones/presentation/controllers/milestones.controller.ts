import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { MilestonesService } from '../../application/services/milestones.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CreateMilestoneDto } from '../../application/dto/create-milestone.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller('milestones')
@UseGuards(JwtAuthGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  create(
    @Body() createMilestoneDto: CreateMilestoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.milestonesService.create(createMilestoneDto);
  }
}

