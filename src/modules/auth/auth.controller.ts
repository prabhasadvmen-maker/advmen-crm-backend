import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { AppError } from '../../shared/errors/AppError.js';
import { env } from '../../config/env.js';

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    const result = await authService.signup(req.body);

    // Set secure HTTP-only cookies
    res.cookie('accessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    ApiResponse.created(res, result, 'Organization workspace and admin account created successfully');
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);

    res.cookie('accessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    ApiResponse.success(res, result, 200, undefined, 'Authentication successful');
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      throw AppError.unauthorized('No active session or refresh token found');
    }

    const tokens = await authService.refreshToken(refreshToken);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    ApiResponse.success(res, { tokens }, 200, undefined, 'Token rotated successfully');
  }

  async logout(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

    if (userId) {
      await authService.logout(userId, refreshToken);
    }

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    ApiResponse.success(res, { loggedOut: true }, 200, undefined, 'Logged out successfully');
  }

  async getMe(req: Request, res: Response): Promise<void> {
    ApiResponse.success(res, { user: req.user }, 200, undefined, 'Current authenticated session');
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    ApiResponse.success(res, result, 200, undefined, result.message);
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { otp, newPassword } = req.body;
    await authService.resetPassword(otp, newPassword);
    ApiResponse.success(res, { success: true }, 200, undefined, 'Password updated successfully. Please sign in again.');
  }
}

export const authController = new AuthController();
