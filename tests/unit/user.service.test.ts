import { jest } from '@jest/globals';
import { userService } from '../../src/modules/users/user.service.js';
import { userRepository } from '../../src/modules/users/user.repository.js';
import { USER_ROLES } from '../../src/config/constants.js';

describe('UserService Unit Tests', () => {
  const mockAdminRequester = {
    id: 'usr_sarah_01',
    name: 'Sarah Chen',
    email: 'sarah.c@acmecorp.com',
    role: USER_ROLES.ORG_ADMIN,
    organizationId: 'org_acme_corp',
    permissions: ['user.manage', 'lead.view'],
  };

  beforeEach(() => {
    jest.spyOn(userRepository, 'findByNormalizedEmail').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes complete user lifecycle methods', () => {
    expect(typeof userService.getUsers).toBe('function');
    expect(typeof userService.getUserById).toBe('function');
    expect(typeof userService.createUser).toBe('function');
    expect(typeof userService.updateUser).toBe('function');
    expect(typeof userService.deleteUser).toBe('function');
  });

  it('prohibits an admin from deleting their own active session', async () => {
    await expect(
      userService.deleteUser(mockAdminRequester, mockAdminRequester.id)
    ).rejects.toThrow('You cannot remove your own active administrator account.');
  });

  it('prohibits non-superadmins from provisioning superadmin accounts', async () => {
    await expect(
      userService.createUser(mockAdminRequester, {
        name: 'Hacker',
        email: 'hacker@example.com',
        role: USER_ROLES.SUPER_ADMIN,
      })
    ).rejects.toThrow('Only root Super Administrators can provision new Super Admin accounts.');
  });
});
