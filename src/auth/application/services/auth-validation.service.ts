import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../users/infrastructure/entities/user.entity';

@Injectable()
export class AuthValidationService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async validateUser(userId: number): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    if (user.blockedAt) {
      throw new ForbiddenException('Tu cuenta ha sido bloqueada');
    }

    return user;
  }
}
