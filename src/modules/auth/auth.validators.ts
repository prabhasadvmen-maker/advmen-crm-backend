import { z } from 'zod';
import { USER_ROLES } from '../../config/constants.js';

export const SignupSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('A valid Super Admin email address is required'),
});

export const ResetPasswordSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});
