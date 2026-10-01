import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { SignupSchema, LoginSchema, RefreshTokenSchema, ForgotPasswordSchema, ResetPasswordSchema } from './auth.validators.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/signup', validateRequest({ body: SignupSchema }), authController.signup);
authRouter.post('/login', validateRequest({ body: LoginSchema }), authController.login);
authRouter.post('/refresh', validateRequest({ body: RefreshTokenSchema }), authController.refreshToken);
authRouter.post('/logout', authMiddleware, authController.logout);
authRouter.get('/me', authMiddleware, authController.getMe);
authRouter.post('/forgot-password', validateRequest({ body: ForgotPasswordSchema }), authController.forgotPassword);
authRouter.post('/reset-password', validateRequest({ body: ResetPasswordSchema }), authController.resetPassword);
