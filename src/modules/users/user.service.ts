import bcrypt from 'bcryptjs';
import { userRepository } from './user.repository.js';
import { CreateUserInput, UpdateUserInput, UserFilterQuery } from './user.validators.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { USER_ROLES, ROLE_DEFAULT_PERMISSIONS, UserRole } from '../../config/constants.js';
import { normalizeEmail } from '../../shared/utils/normalize.js';
import { IUser } from '../auth/auth.model.js';
import { LeadModel } from '../leads/lead.model.js';

export class UserService {
  private sanitizeUser(user: IUser) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.passwordHash;
    delete obj.refreshTokens;
    return {
      id: obj._id ? obj._id.toString() : obj.id,
      ...obj,
    };
  }

  async getUsers(
    requester: AuthenticatedUser,
    filter: UserFilterQuery
  ): Promise<{ users: any[]; total: number; page: number; totalPages: number }> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    const result = await userRepository.findUsers(requester.organizationId, filter, isSuperAdmin);

    // Aggregate lead counts per user within organization
    const userIds = result.users.map((u) => (u._id ? u._id.toString() : u.id));
    const leadCounts = await LeadModel.aggregate([
      {
        $match: {
          organizationId: requester.organizationId,
          ownerId: { $in: userIds },
        },
      },
      {
        $group: {
          _id: '$ownerId',
          count: { $sum: 1 },
        },
      },
    ]);
    const leadCountMap = new Map<string, number>(leadCounts.map((lc) => [String(lc._id), lc.count]));

    return {
      users: result.users.map((u) => {
        const sanitized = this.sanitizeUser(u);
        return {
          ...sanitized,
          assignedLeadsCount: leadCountMap.get(sanitized.id) || 0,
        };
      }),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  async getUserById(requester: AuthenticatedUser, id: string): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    const user = await userRepository.findById(requester.organizationId, id, isSuperAdmin);

    if (!user) {
      throw AppError.notFound('User account not found');
    }

    const sanitized = this.sanitizeUser(user);
    const assignedLeadsCount = await LeadModel.countDocuments({
      organizationId: requester.organizationId,
      ownerId: sanitized.id,
    });

    return {
      ...sanitized,
      assignedLeadsCount,
    };
  }

  async createUser(requester: AuthenticatedUser, input: CreateUserInput): Promise<any> {
    const normalizedEmail = normalizeEmail(input.email);

    // 1. Check for duplicate email
    const existing = await userRepository.findByNormalizedEmail(normalizedEmail);
    if (existing) {
      throw AppError.conflict(`A user with email '${input.email}' already exists.`);
    }

    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;

    // 2. Authorization check for Super Admin creation
    if (input.role === USER_ROLES.SUPER_ADMIN && !isSuperAdmin) {
      throw AppError.forbidden('Only root Super Administrators can provision new Super Admin accounts.');
    }

    // 3. Resolve Organization ID
    const targetOrgId = isSuperAdmin && input.organizationId ? input.organizationId : requester.organizationId;

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password || 'SalesOS2026!Secure', salt);

    const role = (input.role as UserRole) || USER_ROLES.SALES_REP;
    const permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];

    // 5. Create user in database
    const newUser = await userRepository.create({
      organizationId: targetOrgId,
      name: input.name.trim(),
      email: input.email.trim(),
      normalizedEmail,
      passwordHash,
      role,
      permissions,
      department: input.department?.trim() || 'General Sales',
      phone: input.phone?.trim(),
      avatarUrl: input.avatarUrl || undefined,
      isActive: true,
      isEmailVerified: true,
    });

    return {
      ...this.sanitizeUser(newUser),
      assignedLeadsCount: 0,
    };
  }

  async updateUser(requester: AuthenticatedUser, id: string, input: UpdateUserInput): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    const existingUser = await userRepository.findById(requester.organizationId, id, isSuperAdmin);

    if (!existingUser) {
      throw AppError.notFound('User account not found');
    }

    // Protect Super Admin role modifications
    if (input.role === USER_ROLES.SUPER_ADMIN && !isSuperAdmin) {
      throw AppError.forbidden('Only root Super Administrators can promote users to Super Admin.');
    }

    const updateData: Partial<IUser> = {};

    if (input.name) updateData.name = input.name.trim();
    if (input.department) updateData.department = input.department.trim();
    if (input.phone !== undefined) updateData.phone = input.phone.trim();
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl || undefined;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (input.role) {
      updateData.role = input.role as UserRole;
      updateData.permissions = ROLE_DEFAULT_PERMISSIONS[input.role as UserRole] || existingUser.permissions;
    }

    if (input.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(input.password, salt);
    }

    const updated = await userRepository.updateById(
      requester.organizationId,
      id,
      updateData,
      isSuperAdmin
    );

    if (!updated) {
      throw AppError.notFound('User account not found');
    }

    return this.sanitizeUser(updated);
  }

  async deleteUser(requester: AuthenticatedUser, id: string): Promise<void> {
    if (requester.id === id) {
      throw AppError.badRequest('You cannot remove your own active administrator account.');
    }

    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    const user = await userRepository.findById(requester.organizationId, id, isSuperAdmin);

    if (!user) {
      throw AppError.notFound('User account not found');
    }

    const deleted = await userRepository.deleteById(requester.organizationId, id, isSuperAdmin);
    if (!deleted) {
      throw AppError.notFound('User account could not be removed');
    }
  }
}

export const userService = new UserService();
