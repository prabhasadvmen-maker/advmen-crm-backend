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

export interface DepartmentRoleItem {
  role: string;
  label: string;
  description?: string;
}

export const DEFAULT_DEPARTMENT_ROLES: Record<string, DepartmentRoleItem[]> = {
  Sales: [
    { role: 'SALES_REP', label: 'Sales Representative (Executive)', description: 'Manages sales deals, leads, quotes and client pipelines.' },
    { role: 'TELECALLER', label: 'Telecaller / Outreach Agent', description: 'Autodialer queue, calling contacts, disposition logging.' },
    { role: 'SALES_MANAGER', label: 'Sales Manager', description: 'Team leaderboards, lead quota approvals, sales performance.' },
    { role: 'BDE', label: 'Business Development Executive (BDE)', description: 'Generates new commercial leads and client partnerships.' },
    { role: 'ACCOUNT_EXECUTIVE', label: 'Account Executive', description: 'Manages key client accounts and enterprise closures.' },
  ],
  Intern: [
    { role: 'SALES_INTERN', label: 'Sales Intern', description: 'Assists sales team with lead research and outbound support.' },
    { role: 'IT_INTERN', label: 'IT / Web Development Intern', description: 'Assists engineering team with frontend/backend tasks.' },
    { role: 'SEO_INTERN', label: 'SEO & Content Intern', description: 'Assists with keyword research, backlinks and site audits.' },
    { role: 'MARKETING_INTERN', label: 'Digital Marketing Intern', description: 'Assists with social media, creatives and campaigns.' },
    { role: 'HR_INTERN', label: 'HR Operations Intern', description: 'Assists HR with candidate screening and onboardings.' },
    { role: 'OPERATIONS_INTERN', label: 'Operations Intern', description: 'Assists with operations workflow and client logistics.' },
    { role: 'GENERAL_INTERN', label: 'Intern / Trainee', description: 'General internship and trainee tasks across teams.' },
  ],
  'IT Department': [
    { role: 'IT_SUPPORT', label: 'IT Support Engineer', description: 'Technical assistance, office networking, and hardware setup.' },
    { role: 'FULL_STACK_DEV', label: 'Full Stack Developer', description: 'Full-stack software engineering and application development.' },
    { role: 'FRONTEND_DEV', label: 'Frontend Developer', description: 'Builds responsive UI, interactive dashboards and web apps.' },
    { role: 'BACKEND_DEV', label: 'Backend Developer', description: 'Designs scalable APIs, databases and microservices.' },
    { role: 'DEVOPS_SYSADMIN', label: 'System Administrator / DevOps', description: 'Cloud infrastructure, CI/CD, deployments and servers.' },
    { role: 'QA_TESTER', label: 'QA / Software Tester', description: 'Quality assurance, functional and automation testing.' },
    { role: 'IT_MANAGER', label: 'IT Team Lead / Manager', description: 'Oversees IT infrastructure, projects and developer team.' },
  ],
  SEO: [
    { role: 'SEO_EXECUTIVE', label: 'SEO Executive', description: 'On-page and off-page search engine optimization.' },
    { role: 'SEO_ANALYST', label: 'SEO Analyst / Specialist', description: 'Technical SEO audits, keyword ranking and traffic analysis.' },
    { role: 'LINK_BUILDER', label: 'Link Building & Outreach Specialist', description: 'High-authority backlink outreach and partner PR.' },
    { role: 'CONTENT_STRATEGIST', label: 'SEO Content Strategist', description: 'SEO-driven articles, landing page copy and content calendar.' },
    { role: 'SEO_MANAGER', label: 'SEO Team Lead / Manager', description: 'Overall organic search strategy, Google analytics and growth.' },
  ],
  Marketing: [
    { role: 'MARKETING_SDR', label: 'Marketing / Inbound SDR', description: 'Lead generation, campaign imports, and early qualification.' },
    { role: 'DIGITAL_MARKETER', label: 'Digital Marketing Executive', description: 'Online brand promotions, social ads and email blasts.' },
    { role: 'PERFORMANCE_MARKETER', label: 'Performance Marketing Specialist', description: 'Google Ads, Meta Ads (PPC) and conversion tracking.' },
    { role: 'SOCIAL_MEDIA_MGR', label: 'Social Media & Content Manager', description: 'Social media growth, creative designs and viral hooks.' },
    { role: 'MARKETING_MANAGER', label: 'Marketing Manager', description: 'Comprehensive marketing campaigns and budget execution.' },
  ],
  Operations: [
    { role: 'OPERATIONS_EXECUTIVE', label: 'Operations Executive', description: 'Day-to-day business operations and process coordination.' },
    { role: 'PROJECT_COORDINATOR', label: 'Project Coordinator', description: 'Project timelines, resource delivery and cross-team sync.' },
    { role: 'OPERATIONS_MANAGER', label: 'Operations Manager', description: 'Streamlining business workflows, vendor SLAs and efficiency.' },
  ],
  'Customer Support': [
    { role: 'SUPPORT_EXECUTIVE', label: 'Customer Support Executive', description: 'Handling client queries, tickets, live chat and support emails.' },
    { role: 'CLIENT_SUCCESS_REP', label: 'Customer Success Specialist', description: 'Client onboarding, retention, relationship and NPS tracking.' },
    { role: 'SUPPORT_LEAD', label: 'Customer Support Lead', description: 'Escalation resolution, support SLAs and team coaching.' },
  ],
  'Finance & Accounts': [
    { role: 'FINANCE_VIEWER', label: 'Finance Viewer', description: 'View invoices, payment reconciliations, and revenue ledger.' },
    { role: 'ACCOUNTANT', label: 'Accounts Executive / Accountant', description: 'Bookkeeping, tax compliance, invoices and payment tracking.' },
    { role: 'BILLING_EXECUTIVE', label: 'Billing & Collection Specialist', description: 'Client billing, receivables follow-ups and statements.' },
    { role: 'FINANCE_MANAGER', label: 'Finance & Accounts Manager', description: 'Financial planning, audits, payroll and cash flow oversight.' },
  ],
  'Human Resources': [
    { role: 'HR_EXECUTIVE', label: 'HR Executive', description: 'Day-to-day employee lifecycle, attendance and documentation.' },
    { role: 'HR_RECRUITER', label: 'Talent Acquisition / Recruiter', description: 'Sourcing, screening, scheduling and hiring candidates.' },
    { role: 'HR_OPERATIONS', label: 'HR Operations Specialist', description: 'HR process compliance, employee benefits and payroll coordination.' },
    { role: 'HR_MANAGER', label: 'Human Resources Manager', description: 'HR policy management, employee engagement and appraisals.' },
  ],
  'General Sales': [
    { role: 'SALES_REP', label: 'Sales Representative (Executive)', description: 'Manages sales deals, leads, quotes and client pipelines.' },
    { role: 'SALES_MANAGER', label: 'Sales Manager', description: 'Team leaderboards, lead quota approvals, sales performance.' },
  ],
  'Sales & Business Development': [
    { role: 'SALES_REP', label: 'Sales Representative', description: 'Direct sales, customer demos and closing deals.' },
    { role: 'BDE', label: 'Business Development Executive', description: 'Lead prospecting and outbound B2B relationship building.' },
    { role: 'SALES_MANAGER', label: 'Sales Manager', description: 'Sales pipeline direction, quotas and rep mentorship.' },
  ],
};

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

  /**
   * Get role mappings for all departments in an organization
   */
  async getDepartmentRoles(
    organizationId: string
  ): Promise<Record<string, DepartmentRoleItem[]>> {
    const orgId = organizationId || 'org_advmen_platform';
    const org = await OrganizationModel.findOne({ organizationId: orgId }).lean();

    const merged: Record<string, DepartmentRoleItem[]> = { ...DEFAULT_DEPARTMENT_ROLES };

    // Overlay custom department roles stored in organization
    if (org && org.departmentRoles && typeof org.departmentRoles === 'object') {
      for (const [dept, roles] of Object.entries(org.departmentRoles)) {
        if (Array.isArray(roles)) {
          merged[dept] = [
            ...(merged[dept] || []),
            ...roles
              .filter((r) => r && r.label)
              .map((r) => ({
                role: String(r.role || r.label).toUpperCase().replace(/[^A-Z0-9]/gi, '_'),
                label: String(r.label),
                description: r.description ? String(r.description) : undefined,
              })),
          ];
          // Deduplicate by role key or label
          const seen = new Set<string>();
          merged[dept] = merged[dept].filter((item) => {
            const key = (item.role || item.label).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      }
    }

    return merged;
  }

  /**
   * Add a custom role to a specific department
   */
  async addDepartmentRole(
    organizationId: string,
    department: string,
    roleData: { role?: string; label: string; description?: string }
  ): Promise<{ department: string; roles: DepartmentRoleItem[] }> {
    const orgId = organizationId || 'org_advmen_platform';
    const dept = (department || '').trim();
    const label = (roleData.label || '').trim();

    if (!dept) {
      throw AppError.badRequest('Department is required to add a role.');
    }
    if (!label || label.length < 2) {
      throw AppError.badRequest('Role label must be at least 2 characters.');
    }

    const cleanRoleKey = (
      roleData.role ||
      label.toUpperCase().replace(/[^A-Z0-9]/gi, '_')
    )
      .toUpperCase()
      .replace(/__+/g, '_');

    const newRoleItem: DepartmentRoleItem = {
      role: cleanRoleKey,
      label,
      description: roleData.description?.trim() || `${label} in ${dept}`,
    };

    // Update organization with custom role under departmentRoles.<dept>
    await OrganizationModel.updateOne(
      { organizationId: orgId },
      {
        $addToSet: {
          departments: dept,
          [`departmentRoles.${dept}`]: newRoleItem,
        },
        $setOnInsert: {
          name: 'ADVMEN Workspace',
          slug: orgId.toLowerCase(),
        },
      },
      { upsert: true }
    );

    logger.info(`🎭 Added role '${label}' to department '${dept}' for organization '${orgId}'`);

    const allRoles = await this.getDepartmentRoles(orgId);
    return {
      department: dept,
      roles: allRoles[dept] || [newRoleItem],
    };
  }
}

export const departmentService = new DepartmentService();
