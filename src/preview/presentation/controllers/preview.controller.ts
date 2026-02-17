import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PreviewService } from '../../application/services/preview.service';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  @Get(':id/preview')
  async getProjectPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: any,
  ): Promise<void> {
    const preview = await this.previewService.getProjectPreview(id);

    res.set({
      'Content-Type': preview.mimeType,
      'Cache-Control': 'public, max-age=60',
    });
    res.send(preview.data);
  }

  @Get(':id/preview-meta')
  async getProjectPreviewMeta(@Param('id', ParseUUIDPipe) id: string) {
    return this.previewService.getProjectMeta(id);
  }
}
