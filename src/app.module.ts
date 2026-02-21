import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

import { validateConfig } from './config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { MilestonesModule } from './milestones/milestones.module';
import { EvidencesModule } from './evidences/evidences.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { ActivityModule } from './activity/activity.module';
import { CollaborativeModule } from './collaborative/collaborative.module';
import { RemindersModule } from './reminders/reminders.module';
import { PreviewModule } from './preview/preview.module';
import { RadarModule } from './radar/radar.module';
import { ReviewsModule } from './reviews/reviews.module';
import { VersionsModule } from './versions/versions.module';
import { MessagesModule } from './messages/messages.module';
import { AdminModule } from './admin/admin.module';
import { ProjectAccessModule } from './project-access/project-access.module';
import { TeacherModule } from './teacher/teacher.module';
import { StudentModule } from './student/student.module';

import { RolesGuard } from './roles/presentation/guards/roles.guard';
import { JwtAuthGuard } from './auth/presentation/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), '.env'],
      validate: validateConfig,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbSsl = config.get<boolean>('DB_SSL', false);

        return {
          type: 'postgres' as const,
          host: config.getOrThrow<string>('DB_HOST'),
          port: config.getOrThrow<number>('DB_PORT'),
          username: config.getOrThrow<string>('DB_USERNAME'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: false,
          migrations: ['dist/database/migrations/*.js'],
          migrationsRun: config.get<string>('NODE_ENV') === 'production',
          logging: ['error'] as 'error'[],
          ssl: dbSsl ? { rejectUnauthorized: false } : false,
        };
      },
    }),

    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    MilestonesModule,
    EvidencesModule,
    AssignmentsModule,
    ActivityModule,
    CollaborativeModule,
    AdminModule,
    RemindersModule,
    PreviewModule,
    RadarModule,
    ReviewsModule,
    VersionsModule,
    MessagesModule,
    ProjectAccessModule,
    TeacherModule,
    StudentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
