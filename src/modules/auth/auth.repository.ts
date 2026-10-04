import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IUser, UserModel } from './auth.model.js';

export class AuthRepository extends BaseTenantRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  /**
   * Find user by employee ID, email, or phone across tenants for login
   */
  async findByIdentifierGlobal(identifier: string): Promise<IUser | null> {
    const raw = identifier.trim();
    const normalized = raw.toLowerCase();
    const digitsOnly = raw.replace(/\D/g, '');

    const queryConditions: any[] = [
      { normalizedEmail: normalized },
      { email: raw },
      { phone: raw },
      { employeeId: raw.toUpperCase() },
    ];

    if (digitsOnly.length >= 7) {
      queryConditions.push({ phone: digitsOnly });
      queryConditions.push({ phone: new RegExp(digitsOnly + '$') });
    }

    const selectCredentials = '+passwordHash +password +refreshTokens';
    const user = await this.model
      .findOne({ $or: queryConditions })
      .select(selectCredentials)
      .exec();

    if (user || !/^[a-f\d]{6}$/i.test(raw)) {
      return user;
    }

    // Older roster screens exposed the last six characters of Mongo user IDs as login IDs.
    const legacyMatches = await this.model
      .find({
        role: { $ne: 'SUPER_ADMIN' },
        $expr: {
          $eq: [{ $substrCP: [{ $toString: '$_id' }, 18, 6] }, normalized],
        },
      })
      .select(selectCredentials)
      .limit(2)
      .exec();

    return legacyMatches.length === 1 ? legacyMatches[0] : null;
  }

  /**
   * Find user by email across all tenants for initial login lookup
   */
  async findByNormalizedEmailGlobal(normalizedEmail: string): Promise<IUser | null> {
    return this.model.findOne({ normalizedEmail }).select('+passwordHash +password +refreshTokens').exec();
  }

  async findByIdWithRefreshTokens(organizationId: string, id: string): Promise<IUser | null> {
    return this.model
      .findOne({ _id: id, organizationId })
      .select('+refreshTokens')
      .exec();
  }

  /**
   * Find user by email within specific tenant
   */
  async findByNormalizedEmail(organizationId: string, normalizedEmail: string): Promise<IUser | null> {
    return this.model.findOne({ organizationId, normalizedEmail }).select('+passwordHash +password +refreshTokens').exec();
  }

  /**
   * Save refresh token for user session
   */
  async addRefreshToken(userId: string, token: string): Promise<void> {
    await this.model.updateOne({ _id: userId }, { $push: { refreshTokens: token } });
  }

  /**
   * Remove specific refresh token on logout
   */
  async removeRefreshToken(userId: string, token: string): Promise<void> {
    await this.model.updateOne({ _id: userId }, { $pull: { refreshTokens: token } });
  }

  /**
   * Clear all refresh tokens on remote logout/revoke
   */
  async clearAllRefreshTokens(userId: string): Promise<void> {
    await this.model.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
  }
}

export const authRepository = new AuthRepository();
