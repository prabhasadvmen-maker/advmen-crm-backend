import { Router } from 'express';
import { userController } from './user.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserFilterQuerySchema,
} from './user.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const userRouter = Router();

userRouter.use(authMiddleware, tenantMiddleware);

// Team members directory — accessible by any authenticated tenant member
userRouter.get(
  '/',
  validateRequest({ query: UserFilterQuerySchema }),
  userController.getUsers
);

userRouter.get(
  '/:id',
  userController.getUserById
);

userRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.USER_MANAGE),
  validateRequest({ body: CreateUserSchema }),
  userController.createUser
);

userRouter.patch(
  '/:id',
  requirePermission(PERMISSION_KEYS.USER_MANAGE),
  validateRequest({ body: UpdateUserSchema }),
  userController.updateUser
);

userRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.USER_MANAGE),
  userController.deleteUser
);
