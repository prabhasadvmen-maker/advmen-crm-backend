import { z } from 'zod';
import { USER_ROLES } from '../../config/constants.js';

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').default('SalesOS2026!Secure'),
  role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).default(USER_ROLES.SALES_REP),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  organizationId: z.string().optional(),
});

export type CreateUserInput = z.input<typeof CreateUserSchema>;
export type CreateUserOutput = z.output<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UserFilterQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  organizationId: z.string().optional(),
});

export type UserFilterQuery = z.infer<typeof UserFilterQuerySchema>;
