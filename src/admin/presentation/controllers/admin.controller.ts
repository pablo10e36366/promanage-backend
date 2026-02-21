import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../roles/presentation/guards/roles.guard';
import { Roles } from '../../../roles/presentation/decorators/roles.decorator';
import { CreateUserDto, ChangeRoleDto, BlockUserDto } from '../../application/dto/user-admin.dto';
import { UpdateSettingsDto } from '../../application/dto/admin-project.dto';
import { User } from '../../../users/infrastructure/entities/user.entity';
import { AdminFacadeService } from '../../application/services/admin-facade.service';
import { ProjectStatus } from '../../../projects/infrastructure/entities/project.entity';
import { AccessStatus } from '../../../project-access/infrastructure/entities/project-access.entity';
import { ResolveAccessRequestDto } from '../../application/dto/admin-access-request.dto';
import { ResolveRoleUpgradeRequestDto } from '../../application/dto/admin-role-upgrade-request.dto';
import { RoleUpgradeRequestStatus } from '../../../users/infrastructure/entities/role-upgrade-request.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminFacade: AdminFacadeService) {}

  @Post('users')
  async createUser(@Body() dto: CreateUserDto, @Req() req: Request & { user: User }) {
    return this.adminFacade.createUser(dto, req.user);
  }

  @Patch('users/:id/role')
  async changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminFacade.changeUserRole(id, dto, req.user);
  }

  @Patch('users/:id/block')
  async blockUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BlockUserDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminFacade.setUserActive(id, dto, req.user);
  }

  @Get('users')
  async findAllUsers(
    @Query('status') status?: 'active' | 'blocked',
    @Query('roleId', new ParseIntPipe({ optional: true })) roleId?: number,
    @Query('search') search?: string,
  ) {
    return this.adminFacade.listUsers({ status, roleId, search });
  }

  @Get('roles')
  async findAllRoles() {
    return this.adminFacade.listRoles();
  }

  @Get('settings')
  async getSettings() {
    return this.adminFacade.getSettings();
  }

  @Patch('settings')
  async updateSettings(@Body() dto: UpdateSettingsDto, @Req() req: Request & { user: User }) {
    return this.adminFacade.updateSettings(dto, req.user);
  }

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.adminFacade.getDashboardStats();
  }

  @Get('courses')
  async listCourses(
    @Query('status') status?: ProjectStatus,
    @Query('ownerId', new ParseIntPipe({ optional: true })) ownerId?: number,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 10,
  ) {
    return this.adminFacade.listCourses({
      status,
      ownerId,
      search,
      page,
      pageSize,
    });
  }

  @Delete('courses/:id')
  async deleteCourse(@Param('id') id: string, @Req() req: Request & { user: User }) {
    return this.adminFacade.deleteCourse(id, req.user);
  }

  @Get('access-requests')
  async listAccessRequests(
    @Query('status') status?: AccessStatus,
    @Query('course_id') courseId?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 10,
  ) {
    return this.adminFacade.listAccessRequests({
      status,
      courseId,
      search,
      page,
      pageSize,
    });
  }

  @Patch('access-requests/:id')
  async resolveAccessRequest(
    @Param('id') id: string,
    @Body() dto: ResolveAccessRequestDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminFacade.resolveAccessRequest(id, dto.decision, req.user, dto.notes);
  }

  @Get('role-upgrade-requests')
  async listRoleUpgradeRequests(
    @Query('status') status?: RoleUpgradeRequestStatus,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize = 10,
  ) {
    return this.adminFacade.listRoleUpgradeRequests({
      status,
      search,
      page,
      pageSize,
    });
  }

  @Patch('role-upgrade-requests/:id')
  async resolveRoleUpgradeRequest(
    @Param('id') id: string,
    @Body() dto: ResolveRoleUpgradeRequestDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminFacade.resolveRoleUpgradeRequest(id, dto.decision, req.user, dto.notes);
  }
}


