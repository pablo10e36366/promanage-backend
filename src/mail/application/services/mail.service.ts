import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {

  private transporter: nodemailer.Transporter;
  private resend: Resend;

  constructor(private configService: ConfigService) {

    // RESEND API
    this.resend = new Resend(
      this.configService.get<string>('RESEND_API_KEY')
    );

    // Nodemailer (lo dejamos por compatibilidad)
    const rawMailPass = this.configService.get<string>('MAIL_PASS') || '';
    const normalizedMailPass = rawMailPass.replace(/\s+/g, '');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: normalizedMailPass,
      },
    });
  }

  // ✅ OTP GOOGLE (YA USANDO RESEND)
  async sendGoogleOtpEmail(email: string, code: string): Promise<void> {

    const htmlContent = `
      <div style="font-family:Arial;padding:20px">
        <h2>Verifica tu cuenta ProManage</h2>
        <p>Tu código es:</p>
        <h1>${code}</h1>
      </div>
    `;

    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Tu código de verificación ProManage',
      html: htmlContent,
    });
  }

  // 👇 NO tocamos lo demás todavía
  async sendRegistrationVerificationEmail(
    email: string,
    name: string,
    code: string,
  ): Promise<void> {

    console.log(`Registro OTP (temporal) ${email}: ${code}`);

  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {

    console.log(`Welcome email ${email}`);

  }

}