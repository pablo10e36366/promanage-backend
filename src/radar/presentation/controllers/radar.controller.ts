import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RadarNode, RadarService } from '../../application/services/radar.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Controller('radar')
@UseGuards(JwtAuthGuard)
export class RadarController {
  constructor(private readonly radarService: RadarService) {}

  @Get('radar-data')
  async getRadarData(
    @Req() req: Request & { user: User },
  ): Promise<RadarNode[]> {
    return this.radarService.getRadarData(req.user.id);
  }

  @Get('radar-svg')
  async getRadarSvg(@Req() req: Request & { user: User }): Promise<string> {
    return this.radarService.generateRadarSvg(req.user.id);
  }
}
