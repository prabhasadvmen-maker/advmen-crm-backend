import { authService } from '../../src/modules/auth/auth.service.js';
import bcrypt from 'bcryptjs';

describe('AuthService Unit Tests', () => {
  const mockUser = {
    id: 'usr_test_101',
    email: 'alexander@advmen.io',
    name: 'Alexander Sterling',
    role: 'SUPER_ADMIN' as const,
    organizationId: 'org_advmen_platform',
    organizationName: 'ADVMEN Platform Ops',
    permissions: ['admin.view', 'lead.view', 'deal.view'],
  };

  describe('Service Contract & Method Signatures', () => {
    it('exposes essential authentication methods', () => {
      expect(typeof authService.login).toBe('function');
      expect(typeof authService.signup).toBe('function');
      expect(typeof authService.refreshToken).toBe('function');
      expect(typeof authService.logout).toBe('function');
    });

    it('verifies bcrypt password hashing logic accurately', async () => {
      const plain = 'Secret2026!';
      const hash = await bcrypt.hash(plain, 10);
      const isMatch = await bcrypt.compare(plain, hash);
      const isWrong = await bcrypt.compare('WrongPassword', hash);

      expect(isMatch).toBe(true);
      expect(isWrong).toBe(false);
    });
  });
});
