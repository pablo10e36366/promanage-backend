import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendGoogleOtpEmail(email: string, code: string): Promise<void> {
    const mailFrom = this.configService.get<string>(
      'MAIL_FROM',
      'ProManage <noreply@promanage.com>',
    );

    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPass = this.configService.get<string>('MAIL_PASS');

    if (!mailUser || !mailPass) {
      console.warn(
        `[DEV] OTP Google para ${email}: ${code} (configura MAIL_USER/MAIL_PASS para enviar correo)`,
      );
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 24px;color:#fff;">
              <h1 style="margin:0;font-size:22px;">Verifica tu cuenta en ProManage</h1>
              <p style="margin:8px 0 0;opacity:0.9;">Código de verificación</p>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 14px;color:#334155;line-height:1.6;">
                Usa este código para completar tu registro:
              </p>
              <div style="font-size:32px;letter-spacing:10px;font-weight:800;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;text-align:center;">
                ${code}
              </div>
              <p style="margin:16px 0 0;color:#64748b;line-height:1.6;">
                Este código expira en 10 minutos. Si tú no solicitaste esto, puedes ignorar este correo.
              </p>
            </div>
            <div style="padding:18px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center;">
              ProManage
            </div>
          </div>
        </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: mailFrom,
      to: email,
      subject: 'Tu código de verificación ProManage',
      html: htmlContent,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const mailFrom = this.configService.get<string>(
      'MAIL_FROM',
      'ProManage <noreply@promanage.com>',
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              padding: 40px 30px;
            }
            .welcome-text {
              font-size: 18px;
              color: #1e293b;
              margin-bottom: 20px;
            }
            .message {
              font-size: 15px;
              color: #475569;
              line-height: 1.8;
              margin-bottom: 30px;
            }
            .cta-button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .features {
              background: #f8fafc;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
            }
            .feature-item {
              display: flex;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .feature-item:last-child {
              margin-bottom: 0;
            }
            .feature-icon {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
              flex-shrink: 0;
              font-weight: bold;
            }
            .feature-text {
              color: #475569;
              font-size: 14px;
            }
            .footer {
              background: #f8fafc;
              padding: 30px;
              text-align: center;
              color: #94a3b8;
              font-size: 13px;
            }
            .footer a {
              color: #667eea;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a ProManage!</h1>
            </div>
            <div class="content">
              <p class="welcome-text">Hola <strong>${name}</strong>,</p>
              <p class="message">
                Nos complace darte la bienvenida a <strong>ProManage</strong>, tu nueva plataforma para la gestión de proyectos académicos.
              </p>
              <p class="message">
                Tu cuenta ha sido creada exitosamente con el correo electrónico: <strong>${email}</strong>
              </p>
              
              <div class="features">
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Sube y organiza tus proyectos de manera eficiente</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Colabora en tiempo real con tus compañeros</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Recibe feedback de tus profesores</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Gestiona tus cursos y entregas</div>
                </div>
              </div>

              <p class="message">
                Ya puedes comenzar a usar la plataforma iniciando sesión con tus credenciales.
              </p>

              <center>
                <a href="${this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200')}/login" class="cta-button">
                  Iniciar Sesión
                </a>
              </center>

              <p class="message" style="margin-top: 30px; font-size: 14px; color: #64748b;">
                Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
              </p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
              <p style="margin-top: 10px;">
                © 2026 ProManage. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: '¡Bienvenido a ProManage! 🎉',
        html: htmlContent,
      });
      console.log(`Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  async sendTestEmail(email: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to: email,
        subject: 'Test Email from ProManage',
        text: 'If you receive this email, the mail service is working correctly!',
      });
      return true;
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }
}
