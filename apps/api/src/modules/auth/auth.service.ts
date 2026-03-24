import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

interface TokenPayload {
  sub: string;
  email: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService
  ) {}

  async register(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    const tokens = await this.signTokens({ sub: user.id, email: user.email });
    return { user, tokens };
  }

  async login(input: { email: string; password: string }): Promise<{ user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const tokens = await this.signTokens({ sub: user.id, email: user.email });
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      tokens
    };
  }

  async getUserById(userId: string): Promise<Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true }
    });
  }

  async issueTokensForUser(input: { id: string; email: string }): Promise<AuthTokens> {
    return this.signTokens({ sub: input.id, email: input.email });
  }

  async requestPasswordReset(input: { email: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return { ok: true, delivered: false };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        }
      });
    });

    const webUrl = process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
    const resetUrl = `${webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const mail = await this.emailService.sendPasswordResetEmail({
      toEmail: user.email,
      resetUrl,
      expiresAt
    });

    const includeDebugLink = process.env.NODE_ENV !== 'production';
    return {
      ok: true,
      delivered: mail.delivered,
      ...(includeDebugLink ? { resetUrl } : {})
    };
  }

  async resetPassword(input: { token: string; password: string }) {
    const tokenHash = this.hashResetToken(input.token.trim());
    const now = new Date();

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash
        }
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id }
        },
        data: { usedAt: new Date() }
      });
    });

    return { ok: true };
  }

  private async signTokens(payload: TokenPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m'
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_TTL ?? '30d'
      })
    ]);

    return { accessToken, refreshToken };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
