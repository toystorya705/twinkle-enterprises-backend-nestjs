import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your Twinkle Enterprises password',
      text: `Reset your password using this link: ${resetUrl}`,
      html: `<p>Reset your password using this secure link:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires soon.</p>`,
    });
  }

  async sendVerification(to: string, verificationUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your Twinkle Enterprises email',
      text: `Verify your email using this link: ${verificationUrl}`,
      html: `<p>Verify your email address using this secure link:</p><p><a href="${verificationUrl}">Verify email</a></p>`,
    });
  }

  private async send(input: MailInput): Promise<void> {
    const host = this.config.get<string>('email.host');
    const user = this.config.get<string>('email.user');
    const from = this.config.get<string>('email.from') ?? user;

    if (!host || !from) {
      this.logger.warn(`Email not sent to ${input.to}; SMTP is not configured.`);
      return;
    }

    const transporter = this.getTransporter();
    await transporter.sendMail({ ...input, from });
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('email.host'),
      port: this.config.get<number>('email.port') ?? 587,
      secure: this.config.get<boolean>('email.secure') ?? false,
      auth: this.config.get<string>('email.user')
        ? {
            user: this.config.get<string>('email.user'),
            pass: this.config.get<string>('email.pass'),
          }
        : undefined,
    });
    return this.transporter;
  }
}
