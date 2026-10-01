import { jest } from '@jest/globals';
import { organizationService } from '../../src/modules/organizations/organization.service.js';
import { OrganizationModel } from '../../src/modules/organizations/organization.model.js';
import { USER_ROLES } from '../../src/config/constants.js';

describe('OrganizationService Unit Tests', () => {
  const mockSuperAdmin = {
    id: 'usr_super_01',
    name: 'Platform Ops Super Admin',
    email: 'superadmin@salesos.advmen.io',
    role: USER_ROLES.SUPER_ADMIN,
    organizationId: 'org_advmen_platform',
    permissions: ['*'],
  };

  const mockOrgAdmin = {
    id: 'usr_admin_01',
    name: 'Sarah Chen',
    email: 'sarah.c@acmecorp.com',
    role: USER_ROLES.ORG_ADMIN,
    organizationId: 'org_acme_corp',
    permissions: ['org.manage'],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes public organizations directory and lifecycle methods', () => {
    expect(typeof organizationService.getPublicOrganizations).toBe('function');
    expect(typeof organizationService.getOrganizations).toBe('function');
    expect(typeof organizationService.createOrganization).toBe('function');
    expect(typeof organizationService.deleteOrganization).toBe('function');
  });

  it('prohibits non-superadmins from deleting tenant organizations', async () => {
    await expect(
      organizationService.deleteOrganization(mockOrgAdmin, 'org_acme_corp')
    ).rejects.toThrow('Only Super Administrators can delete Tenant Workspaces.');
  });

  it('prohibits deleting the root platform organization (org_advmen_platform)', async () => {
    await expect(
      organizationService.deleteOrganization(mockSuperAdmin, 'org_advmen_platform')
    ).rejects.toThrow('The root platform operations workspace (org_advmen_platform) cannot be deleted.');
  });

  it('retrieves public organizations without requiring authentication', async () => {
    const mockOrgs = [
      {
        organizationId: 'org_test_1',
        name: 'Test Tenant 1',
        slug: 'test-tenant-1',
        planTier: 'ENTERPRISE',
        planStatus: 'ACTIVE',
        createdAt: new Date(),
      },
    ];

    (jest.spyOn(OrganizationModel, 'find') as any).mockReturnValue({
      sort: (jest.fn() as any).mockResolvedValue(mockOrgs),
    });

    const result = await organizationService.getPublicOrganizations();
    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe('org_test_1');
    expect(result[0].name).toBe('Test Tenant 1');
  });
});
