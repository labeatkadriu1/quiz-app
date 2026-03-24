import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

interface InvitationEmailInput {
  toEmail: string;
  organizationName: string;
  roleName: string;
  acceptUrl: string;
  expiresAt: Date;
}

interface PasswordResetEmailInput {
  toEmail: string;
  resetUrl: string;
  expiresAt: Date;
}

interface AssignmentRequestReviewedEmailInput {
  toEmail: string;
  organizationName: string;
  quizTitle: string;
  approved: boolean;
  note?: string | null;
  loginUrl: string;
}

interface ClassJoinReviewedEmailInput {
  toEmail: string;
  className: string;
  schoolName: string;
  approved: boolean;
  loginUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  async sendInvitationEmail(input: InvitationEmailInput): Promise<{ delivered: boolean; reason?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { delivered: false, reason: 'SMTP is not configured' };
    }

    const from = process.env.SMTP_FROM ?? 'QuizOS <no-reply@quizos.local>';
    const subject = `You are invited to join ${input.organizationName} on QuizOS`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin-bottom:8px;">Invitation to QuizOS</h2>
        <p>You have been invited to join <strong>${escapeHtml(input.organizationName)}</strong> as <strong>${escapeHtml(input.roleName)}</strong>.</p>
        <p>
          <a href="${input.acceptUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;">
            Accept Invitation
          </a>
        </p>
        <p style="color:#4b5563;">This invitation expires on ${input.expiresAt.toUTCString()}.</p>
      </div>
    `;

    const text = [
      `You are invited to join ${input.organizationName} on QuizOS.`,
      `Role: ${input.roleName}`,
      `Accept invitation: ${input.acceptUrl}`,
      `Expires: ${input.expiresAt.toUTCString()}`
    ].join('\n');

    try {
      const info = await transporter.sendMail({
        from,
        to: input.toEmail,
        subject,
        text,
        html
      });

      const delivered = (info.accepted?.length ?? 0) > 0;
      return delivered ? { delivered: true } : { delivered: false, reason: 'Mail provider did not accept recipient' };
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${input.toEmail}`, error instanceof Error ? error.stack : undefined);
      return { delivered: false, reason: 'Email delivery failed' };
    }
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<{ delivered: boolean; reason?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { delivered: false, reason: 'SMTP is not configured' };
    }

    const from = process.env.SMTP_FROM ?? 'QuizOS <no-reply@quizos.local>';
    const subject = 'Reset your QuizOS password';

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin-bottom:8px;">Password reset request</h2>
        <p>We received a request to reset your QuizOS password.</p>
        <p>
          <a href="${input.resetUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;">
            Reset Password
          </a>
        </p>
        <p style="color:#4b5563;">This link expires on ${input.expiresAt.toUTCString()}.</p>
        <p style="color:#4b5563;">If you did not request this, you can ignore this email.</p>
      </div>
    `;

    const text = [
      'We received a request to reset your QuizOS password.',
      `Reset link: ${input.resetUrl}`,
      `Expires: ${input.expiresAt.toUTCString()}`,
      'If you did not request this, ignore this email.'
    ].join('\n');

    try {
      const info = await transporter.sendMail({
        from,
        to: input.toEmail,
        subject,
        text,
        html
      });
      const delivered = (info.accepted?.length ?? 0) > 0;
      return delivered ? { delivered: true } : { delivered: false, reason: 'Mail provider did not accept recipient' };
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${input.toEmail}`, error instanceof Error ? error.stack : undefined);
      return { delivered: false, reason: 'Email delivery failed' };
    }
  }

  async sendAssignmentRequestReviewedEmail(
    input: AssignmentRequestReviewedEmailInput
  ): Promise<{ delivered: boolean; reason?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { delivered: false, reason: 'SMTP is not configured' };
    }
    const from = process.env.SMTP_FROM ?? 'QuizOS <no-reply@quizos.local>';
    const subject = input.approved
      ? `Access approved for "${input.quizTitle}"`
      : `Access request update for "${input.quizTitle}"`;
    const statusText = input.approved ? 'approved' : 'rejected';
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin-bottom:8px;">Assignment request ${statusText}</h2>
        <p>Your request for <strong>${escapeHtml(input.quizTitle)}</strong> in <strong>${escapeHtml(input.organizationName)}</strong> was <strong>${statusText}</strong>.</p>
        ${input.note ? `<p>Note: ${escapeHtml(input.note)}</p>` : ''}
        <p><a href="${input.loginUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;">Open QuizOS</a></p>
      </div>
    `;
    const text = [
      `Assignment request ${statusText}`,
      `Quiz: ${input.quizTitle}`,
      `Organization: ${input.organizationName}`,
      input.note ? `Note: ${input.note}` : null,
      `Open: ${input.loginUrl}`
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const info = await transporter.sendMail({ from, to: input.toEmail, subject, text, html });
      return (info.accepted?.length ?? 0) > 0
        ? { delivered: true }
        : { delivered: false, reason: 'Mail provider did not accept recipient' };
    } catch (error) {
      this.logger.error(
        `Failed to send assignment review email to ${input.toEmail}`,
        error instanceof Error ? error.stack : undefined
      );
      return { delivered: false, reason: 'Email delivery failed' };
    }
  }

  async sendClassJoinReviewedEmail(input: ClassJoinReviewedEmailInput): Promise<{ delivered: boolean; reason?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { delivered: false, reason: 'SMTP is not configured' };
    }
    const from = process.env.SMTP_FROM ?? 'QuizOS <no-reply@quizos.local>';
    const subject = input.approved ? `Class join approved: ${input.className}` : `Class join request update: ${input.className}`;
    const statusText = input.approved ? 'approved' : 'rejected';
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin-bottom:8px;">Class join ${statusText}</h2>
        <p>Your request to join <strong>${escapeHtml(input.className)}</strong> (${escapeHtml(input.schoolName)}) was <strong>${statusText}</strong>.</p>
        <p><a href="${input.loginUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;">Open QuizOS</a></p>
      </div>
    `;
    const text = [
      `Class join ${statusText}`,
      `Class: ${input.className}`,
      `School: ${input.schoolName}`,
      `Open: ${input.loginUrl}`
    ].join('\n');

    try {
      const info = await transporter.sendMail({ from, to: input.toEmail, subject, text, html });
      return (info.accepted?.length ?? 0) > 0
        ? { delivered: true }
        : { delivered: false, reason: 'Mail provider did not accept recipient' };
    } catch (error) {
      this.logger.error(
        `Failed to send class join review email to ${input.toEmail}`,
        error instanceof Error ? error.stack : undefined
      );
      return { delivered: false, reason: 'Email delivery failed' };
    }
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? '');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    return this.transporter;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
