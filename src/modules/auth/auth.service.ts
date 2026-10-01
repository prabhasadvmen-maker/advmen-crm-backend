import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ERROR_CODES } from '../../shared/errors/errorCodes.js';
import { USER_ROLES, UserRole, ROLE_DEFAULT_PERMISSIONS, PERMISSION_KEYS } from '../../config/constants.js';
import { emailService } from '../../shared/services/email.service.js';

import { normalizeEmail } from '../../shared/utils/normalize.js';
import { authRepository } from './auth.repository.js';
import { OrganizationModel } from '../organizations/organization.model.js';
import { IUser, UserModel } from './auth.model.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponsePayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    organizationId: string;
    organizationName?: string;
    avatarUrl?: string;
    permissions: string[];
  };
  tokens: AuthTokens;
}

export class AuthService {
  /**
   * Generates JWT Access and Refresh tokens
   */
  private generateTokens(user: IUser, organizationName?: string): AuthTokens {
    const rawRole = ((user.role || '') as string).toUpperCase().replace('-', '_');
    let finalRole: UserRole = USER_ROLES.ORG_ADMIN;
    if (rawRole === 'SUPERADMIN' || rawRole === 'SUPER_ADMIN') {
      finalRole = USER_ROLES.SUPER_ADMIN;
    } else if (rawRole === 'ADMIN' || rawRole === 'ORG_ADMIN') {
      finalRole = USER_ROLES.ORG_ADMIN;
    } else if (USER_ROLES[rawRole as keyof typeof USER_ROLES]) {
      finalRole = USER_ROLES[rawRole as keyof typeof USER_ROLES];
    }

    const orgId = user.organizationId || 'org_advmen_platform';
    const permissions = (user.permissions && user.permissions.length > 0)
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[finalRole] || Object.values(PERMISSION_KEYS));

    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: finalRole,
      organizationId: orgId,
      organizationName: organizationName || 'ADVMEN Workspace',
      permissions,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { id: user._id.toString(), organizationId: orgId },
      env.JWT_REFRESH_SECRET,
      {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  /**
   * Register a new company/organization and its primary Admin user
   */
  async signup(data: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<AuthResponsePayload> {
    const normalizedEmail = normalizeEmail(data.email);

    // Check if user with email already exists globally
    const existingUser = await authRepository.findByNormalizedEmailGlobal(normalizedEmail);
    if (existingUser) {
      throw AppError.conflict('An account with this email already exists');
    }

    // 1. Create Organization
    const organizationId = `org_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const slug = data.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const org = await OrganizationModel.create({
      organizationId,
      name: data.organizationName,
      slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // 3. Create Primary Admin User
    const role = data.role || USER_ROLES.ORG_ADMIN;
    const user = await authRepository.create(organizationId, {
      organizationId,
      name: data.name,
      email: data.email,
      normalizedEmail,
      passwordHash,
      role,
      permissions: ROLE_DEFAULT_PERMISSIONS[role] || [],
      isActive: true,
      isEmailVerified: true,
    });

    // 4. Issue Tokens
    const tokens = this.generateTokens(user, org.name);
    await authRepository.addRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: org.name,
        avatarUrl: user.avatarUrl,
        permissions: user.permissions,
      },
      tokens,
    };
  }

  /**
   * Login user by phone number or email and password
   */
  async login(data: { email?: string; phone?: string; identifier?: string; password: string }): Promise<AuthResponsePayload> {
    const rawIdentifier = data.identifier || data.phone || data.email || '';
    if (!rawIdentifier.trim()) {
      throw AppError.badRequest('Please enter your phone number or email address.');
    }

    const user = await authRepository.findByIdentifierGlobal(rawIdentifier);
    if (!user) {
      throw AppError.unauthorized('Invalid phone number/email or password', ERROR_CODES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw AppError.forbidden('Your account has been deactivated. Please contact your organization administrator.');
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid phone number/email or password', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const orgId = user.organizationId || 'org_advmen_platform';
    const org = await OrganizationModel.findOne({ organizationId: orgId });

    // Update last login
    await authRepository.updateById(orgId, user._id.toString(), {
      lastLoginAt: new Date(),
    });

    // Generate tokens & rotate refresh token
    const tokens = this.generateTokens(user, org?.name);
    await authRepository.addRefreshToken(user._id.toString(), tokens.refreshToken);

    const rawRole = ((user.role || '') as string).toUpperCase().replace('-', '_');
    let finalRole: UserRole = USER_ROLES.ORG_ADMIN;
    if (rawRole === 'SUPERADMIN' || rawRole === 'SUPER_ADMIN') {
      finalRole = USER_ROLES.SUPER_ADMIN;
    } else if (rawRole === 'ADMIN' || rawRole === 'ORG_ADMIN') {
      finalRole = USER_ROLES.ORG_ADMIN;
    } else if (USER_ROLES[rawRole as keyof typeof USER_ROLES]) {
      finalRole = USER_ROLES[rawRole as keyof typeof USER_ROLES];
    }

    const permissions = (user.permissions && user.permissions.length > 0)
      ? user.permissions
      : (ROLE_DEFAULT_PERMISSIONS[finalRole] || Object.values(PERMISSION_KEYS));

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: finalRole,
        organizationId: orgId,
        organizationName: org?.name || 'ADVMEN Workspace',
        avatarUrl: user.avatarUrl || (user as any).avatar,
        permissions,
      },
      tokens,
    };
  }

  /**
   * Rotate access token using valid refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        id: string;
        organizationId: string;
      };

      const user = await authRepository.findById(decoded.organizationId, decoded.id);
      if (!user || !user.isActive) {
        throw AppError.unauthorized('Invalid or expired refresh token');
      }

      const org = await OrganizationModel.findOne({ organizationId: user.organizationId });
      const newTokens = this.generateTokens(user, org?.name);

      // Rotate: remove old, save new
      await authRepository.removeRefreshToken(user._id.toString(), refreshToken);
      await authRepository.addRefreshToken(user._id.toString(), newTokens.refreshToken);

      return newTokens;
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token', ERROR_CODES.TOKEN_EXPIRED);
    }
  }

  /**
   * Invalidate refresh token on logout
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await authRepository.removeRefreshToken(userId, refreshToken);
    } else {
      await authRepository.clearAllRefreshTokens(userId);
    }
  }

  /**
   * Forgot password — SUPER_ADMIN only.
   * Generates a cryptographically secure 6-digit OTP, stores it hashed with a 10-minute
   * expiry on the user record, and emails the plain OTP to the Super Admin's address.
   */
  async forgotPassword(email: string): Promise<{ message: string; expiresAt: Date }> {
    const normalizedEmail = normalizeEmail(email);
    const user = await authRepository.findByNormalizedEmailGlobal(normalizedEmail);

    if (!user) {
      throw AppError.unauthorized('No Super Admin account found with this email address.');
    }

    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      throw AppError.forbidden('Password reset is only available for Super Admin accounts.');
    }

    if (!user.isActive) {
      throw AppError.forbidden('This account is deactivated.');
    }

    // Generate a 6-digit numeric OTP using crypto (cryptographically secure)
    const otp = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store HASHED otp — never persist plain text
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordResetToken: hashedOtp, passwordResetExpiresAt: expiresAt } }
    );

    // Send the OTP to the Super Admin's email
    await emailService.sendPasswordResetOtp(user.email, otp, user.name);

    return {
      message: `A 6-digit verification code has been sent to ${user.email}. It expires in 10 minutes.`,
      expiresAt,
    };
  }

  /**
   * Reset password using the OTP sent to the Super Admin's email.
   * SUPER_ADMIN only.
   */
  async resetPassword(otp: string, newPassword: string): Promise<void> {
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await UserModel.findOne({
      passwordResetToken: hashedOtp,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetToken +passwordResetExpiresAt');

    if (!user) {
      throw AppError.unauthorized('The OTP is incorrect or has expired. Please request a new one.');
    }

    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      throw AppError.forbidden('Password reset is only available for Super Admin accounts.');
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    (user as any).passwordResetToken = undefined;
    (user as any).passwordResetExpiresAt = undefined;
    await user.save();

    // Invalidate all existing sessions for full security
    await authRepository.clearAllRefreshTokens(user._id.toString());
  }
}

export const authService = new AuthService();
