import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Prisma, User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const authUserInclude = {
  Role: true,
  UserRole: { include: { Role: true } },
} satisfies Prisma.UserInclude;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  async signup(dto: SignupDto, meta = {}) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Unable to create account with these details');
    }

    const user = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase().trim(),
        passwordHash: await hash(dto.password, 12),
        name: dto.name,
        updatedAt: new Date(),
      },
      include: this.userInclude(),
    });
    await this.audit.log({ userId: user.id, event: 'auth.signup', ...this.auditMeta(meta) });
    await this.sendVerificationEmail(user.id);
    return this.issueSession(user, false);
  }

  async login(dto: LoginDto, meta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: this.userInclude(),
    });

    if (!user || !user.isActive) {
      await this.audit.log({ event: 'auth.login_failed', ...this.auditMeta(meta) });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({ userId: user.id, event: 'auth.login_locked', ...this.auditMeta(meta) });
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      await this.recordFailedLogin(user, meta);
      throw new UnauthorizedException('Invalid email or password');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      include: this.userInclude(),
    });
    await this.audit.log({ userId: user.id, event: 'auth.login_success', ...this.auditMeta(meta) });
    return this.issueSession(updated, !!dto.rememberMe);
  }

  async refresh(refreshToken: string, meta = {}) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: AuthTokenType.REFRESH,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { User: { include: this.userInclude() } },
    });

    if (!stored || !stored.User.isActive) {
      await this.audit.log({ event: 'auth.refresh_failed', ...this.auditMeta(meta) });
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.authToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date(), revokedAt: new Date() },
    });
    await this.audit.log({ userId: stored.userId, event: 'auth.refresh', ...this.auditMeta(meta) });
    return this.issueSession(stored.User, false);
  }

  async logout(refreshToken?: string, userId?: string, meta = {}) {
    if (refreshToken) {
      await this.prisma.authToken.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), type: AuthTokenType.REFRESH },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({ userId, event: 'auth.logout', ...this.auditMeta(meta) });
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.toAuthUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, updatedAt: new Date() },
      include: this.userInclude(),
    });
    await this.audit.log({ userId, event: 'auth.profile_updated' });
    return this.toAuthUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Invalid current password');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(dto.newPassword, 12),
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.prisma.authToken.updateMany({
      where: { userId, type: AuthTokenType.REFRESH, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ userId, event: 'auth.password_changed' });
    return { changed: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (user?.isActive) {
      const rawToken = await this.createToken(user.id, AuthTokenType.PASSWORD_RESET, 30 * 60 * 1000);
      const resetUrl = `${this.config.get<string>('frontend.baseUrl')}/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
      await this.email.sendPasswordReset(user.email, resetUrl);
      await this.audit.log({ userId: user.id, event: 'auth.password_reset_requested', ...this.auditMeta(meta) });
    }
    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto, meta = {}) {
    const token = await this.consumeToken(dto.token, AuthTokenType.PASSWORD_RESET);
    await this.prisma.user.update({
      where: { id: token.userId },
      data: {
        passwordHash: await hash(dto.password, 12),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });
    await this.prisma.authToken.updateMany({
      where: { userId: token.userId, type: AuthTokenType.REFRESH, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ userId: token.userId, event: 'auth.password_reset_completed', ...this.auditMeta(meta) });
    return { reset: true };
  }

  async verifyEmail(rawToken: string, meta = {}) {
    const token = await this.consumeToken(rawToken, AuthTokenType.EMAIL_VERIFICATION);
    await this.prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date(), updatedAt: new Date() },
    });
    await this.audit.log({ userId: token.userId, event: 'auth.email_verified', ...this.auditMeta(meta) });
    return { verified: true };
  }

  async resendVerificationEmail(userId: string, meta = {}) {
    await this.sendVerificationEmail(userId);
    await this.audit.log({ userId, event: 'auth.email_verification_resent', ...this.auditMeta(meta) });
    return { sent: true };
  }

  private async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) {
      return;
    }
    const rawToken = await this.createToken(user.id, AuthTokenType.EMAIL_VERIFICATION, 24 * 60 * 60 * 1000);
    const verifyUrl = `${this.config.get<string>('frontend.baseUrl')}/auth?verify=${encodeURIComponent(rawToken)}`;
    await this.email.sendVerification(user.email, verifyUrl);
  }

  private async recordFailedLogin(user: User, meta: unknown) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
    await this.audit.log({ userId: user.id, event: 'auth.login_failed', ...this.auditMeta(meta) });
  }

  private async issueSession(user: UserWithRoles, rememberMe: boolean) {
    const roles = this.rolesFor(user);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      roles,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const days = rememberMe
      ? this.config.get<number>('jwt.rememberMeRefreshExpiresInDays') ?? 30
      : this.config.get<number>('jwt.refreshExpiresInDays') ?? 7;
    await this.prisma.authToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        type: AuthTokenType.REFRESH,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private async createToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.authToken.create({
      data: {
        id: randomUUID(),
        userId,
        type,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return rawToken;
  }

  private async consumeToken(rawToken: string, type: AuthTokenType) {
    const stored = await this.prisma.authToken.findFirst({
      where: {
        tokenHash: this.hashToken(rawToken),
        type,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!stored) {
      throw new BadRequestException('Invalid or expired token');
    }
    return this.prisma.authToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private auditMeta(meta: unknown) {
    if (!meta || typeof meta !== 'object') {
      return {};
    }

    const context = meta as { ipAddress?: string; userAgent?: string };
    return {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };
  }

  private rolesFor(user: UserWithRoles): string[] {
    const roleNames = [
      ...(user.Role ? [user.Role.name] : []),
      ...user.UserRole.map((entry) => entry.Role.name),
    ];
    return Array.from(new Set(roleNames.flatMap((role) => {
      const normalized = role.toLowerCase().replace(/\s+/g, '_');
      return normalized === 'super_admin' ? [role, normalized, 'admin'] : [role, normalized];
    })));
  }

  private toAuthUser(user: UserWithRoles) {
    const roles = this.rolesFor(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      country: user.country,
      companyName: user.companyName,
      company_name: user.companyName,
      avatarUrl: user.avatarUrl,
      avatar_url: user.avatarUrl,
      roleId: user.roleId,
      roles,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  private userInclude() {
    return authUserInclude;
  }
}

type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;
