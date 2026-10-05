import { OrganizationModel } from '../organizations/organization.model.js';
import { UserModel } from '../auth/auth.model.js';
import { AttendanceModel } from '../attendance/attendance.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger/logger.js';

export const DEFAULT_DEPARTMENTS = [
  'Sales',
  'Intern',
  'IT Department',
  'SEO',
  'Marketing',
  'Operations',
  'Customer Support',
  'Finance & Accounts',
  'Human Resources',
];

export class DepartmentService {
  /**
   * Get all active departments for an organization
   */
  async getDepartments(organizationId: string): Promise<string[]> {
    const orgId = organizationId || 'org_advmen_platform';
    const org = await OrganizationModel.findOne({ organizationId: orgId }).lean();

    const orgDepts = org && Array.isArray(org.departments) ? org.departments : [];

    // Distinct departments currently in use in UserModel and AttendanceModel
    const [userDepts, attendanceDepts] = await Promise.all([
      UserModel.distinct('department', { organizationId: orgId }).catch(() => []),
      AttendanceModel.distinct('department', { organizationId: orgId }).catch(() => []),
    ]);

    // Merge and deduplicate
    const set = new Set<string>();

    // 1. Add requested default departments first
    DEFAULT_DEPARTMENTS.forEach((d) => set.add(d.trim()));

    // 2. Add org saved departments
    orgDepts.forEach((d: string) => {
      if (d && typeof d === 'string' && d.trim()) set.add(d.trim());
    });

    // 3. Add existing users' departments
    userDepts.forEach((d: any) => {
      if (d && typeof d === 'string' && d.trim()) set.add(d.trim());
    });
    attendanceDepts.forEach((d: any) => {
      if (d && typeof d === 'string' && d.trim()) set.add(d.trim());
    });

    const result = Array.from(set);

    // Keep primary user requested departments at the top
    const priority = ['Sales', 'Intern', 'IT Department', 'SEO'];
    return result.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  /**
   * Add a new custom department for an organization
   */
  async addDepartment(
    organizationId: string,
    departmentName: string
  ): Promise<{ department: string; departments: string[] }> {
    const orgId = organizationId || 'org_advmen_platform';
    const trimmed = (departmentName || '').trim();

    if (!trimmed || trimmed.length < 2) {
      throw AppError.badRequest('Department name must be at least 2 characters long.');
    }
    if (trimmed.length > 60) {
      throw AppError.badRequest('Department name cannot exceed 60 characters.');
    }

    // Upsert into organization's departments array
    await OrganizationModel.updateOne(
      { organizationId: orgId },
      {
        $addToSet: { departments: trimmed },
        $setOnInsert: {
          name: 'ADVMEN Workspace',
          slug: orgId.toLowerCase(),
          departments: [...DEFAULT_DEPARTMENTS, trimmed],
        },
      },
      { upsert: true }
    );

    logger.info(`🏢 New Department '${trimmed}' added to organization '${orgId}'`);

    const all = await this.getDepartments(orgId);
    return {
      department: trimmed,
      departments: all,
    };
  }
}

export const departmentService = new DepartmentService();
