import { Module } from '@nestjs/common';
import { MailService } from './application/services/mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
