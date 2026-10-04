import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { normalizeEmail, normalizePhone } from '../../shared/utils/normalize.js';
import { UserModel } from '../auth/auth.model.js';
import { LeadModel, ILead } from './lead.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger/logger.js';

export type ImportRow = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  title?: string;
  city?: string;
  source?: string;
  requirement?: string;
  budget?: number;
  rowNumber: number;
  customFields?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

// Flexible header aliases
const NAME_ALIASES = [
  'name', 'fullname', 'full_name', 'contactname', 'contact_name', 'leadname', 'lead_name',
  'customer', 'customername', 'customer_name', 'client', 'clientname', 'client_name',
  'person', 'contactperson', 'party', 'partyname', 'naam'
];

const PHONE_ALIASES = [
  'phone', 'mobile', 'phonenumber', 'phone_number', 'contactnumber', 'contact_number',
  'mobileno', 'mobile_no', 'mobilenumber', 'mobile_number', 'contactno', 'contact_no',
  'cell', 'cellphone', 'whatsapp', 'whatsappnumber', 'whatsapp_number', 'tel', 'telephone',
  'callingnumber', 'calling_number', 'number', 'mob'
];

const EMAIL_ALIASES = [
  'email', 'emailid', 'email_id', 'emailaddress', 'email_address', 'mail', 'mailid', 'mail_id'
];

const COMPANY_ALIASES = [
  'company', 'companyname', 'company_name', 'organization', 'org', 'business', 'businessname',
  'firm', 'firmname', 'firm_name', 'agency', 'store', 'shop', 'shopname'
];

const TITLE_ALIASES = [
  'title', 'designation', 'role', 'position', 'jobtitle'
];

const CITY_ALIASES = [
  'city', 'location', 'state', 'address', 'district', 'town', 'area'
];

const REQUIREMENT_ALIASES = [
  'requirement', 'requirements', 'notes', 'note', 'remark', 'remarks', 'details', 'query',
  'comment', 'comments', 'work', 'service', 'product', 'description'
];

const BUDGET_ALIASES = [
  'budget', 'value', 'amount', 'price', 'cost', 'dealvalue', 'deal_value'
];

// Helper to extract field value matching any alias
const extractField = (row: Record<string, unknown>, aliases: string[]): string => {
  const normalizedKeys = Object.keys(row).map(k => ({
    original: k,
    normalized: k.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '')
  }));

  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
    const match = normalizedKeys.find(k => k.normalized === normAlias || k.normalized.includes(normAlias));
    if (match && row[match.original] !== undefined && row[match.original] !== null) {
      const val = String(row[match.original]).trim();
      if (val) return val;
    }
  }
  return '';
};

// Helper to clean phone numbers (handles scientific notation, floats, country codes)
function cleanPhoneNumber(rawPhone: unknown): string {
  if (rawPhone === undefined || rawPhone === null) return '';
  let str = String(rawPhone).trim();

  // If scientific notation like 9.87654E+09
  if (/^[0-9]+(\.[0-9]+)?e\+[0-9]+$/i.test(str)) {
    try {
      str = Number(str).toFixed(0);
    } catch {
      // fallback
    }
  }

  // Remove .0 suffix if excel parsed as float like 9876543210.0
  str = str.replace(/\.0+$/, '');

  // Extract digits and optional leading +
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');

  if (digits.length >= 7) {
    return hasPlus ? `+${digits}` : digits;
  }
  return digits;
}

export class LeadImportService {
  /**
   * Parse uploaded Excel or CSV buffer with high capacity (supports up to 100,000 rows)
   */
  parse(file: Express.Multer.File) {
    if (!['.xlsx', '.xls', '.csv'].some(ext => file.originalname.toLowerCase().endsWith(ext))) {
      throw AppError.badRequest('Only .xlsx, .xls, and .csv files are accepted.');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        dense: true,
      });
    } catch (err: any) {
      logger.error('❌ Failed to read spreadsheet buffer:', err);
      throw AppError.badRequest('Failed to parse spreadsheet file. Please check file format and try again.');
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw AppError.badRequest('The uploaded workbook has no sheets.');
    }

    // Find first sheet that has rows
    let targetSheetName = workbook.SheetNames[0];
    let sheet = workbook.Sheets[targetSheetName];
    let raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', blankrows: false });

    for (const sName of workbook.SheetNames) {
      const s = workbook.Sheets[sName];
      const testRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(s, { defval: '', blankrows: false });
      if (testRows.length > 0) {
        targetSheetName = sName;
        sheet = s;
        raw = testRows;
        break;
      }
    }

    if (!raw.length) {
      throw AppError.badRequest('The uploaded sheet has no data rows.');
    }

    // Filter out ghost rows (blank lines from Excel formatting)
    const validDataRows = raw.filter(row => {
      return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
    });

    if (!validDataRows.length) {
      throw AppError.badRequest('The uploaded sheet contains only blank or empty rows.');
    }

    // Support up to 100,000 rows (removed restrictive 5000 limit)
    if (validDataRows.length > 100000) {
      throw AppError.badRequest('A single import may contain up to 100,000 rows. Please split larger files.');
    }

    const columns = Object.keys(validDataRows[0] || {});
    const seen = new Set<string>();
    const valid: ImportRow[] = [];
    const rejected: Array<{ rowNumber: number; reason: string; raw?: Record<string, unknown> }> = [];

    validDataRows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header row

      const rawName = extractField(row, NAME_ALIASES);
      const rawPhone = extractField(row, PHONE_ALIASES);
      const rawEmail = extractField(row, EMAIL_ALIASES);
      const company = extractField(row, COMPANY_ALIASES);
      const title = extractField(row, TITLE_ALIASES);
      const city = extractField(row, CITY_ALIASES);
      const requirement = extractField(row, REQUIREMENT_ALIASES);
      const rawBudget = extractField(row, BUDGET_ALIASES);
      const budget = Number(rawBudget.replace(/[^0-9.]/g, '')) || undefined;

      const phone = cleanPhoneNumber(rawPhone);

      // Validation: Phone is minimum requirement
      if (!phone || phone.length < 6) {
        return rejected.push({
          rowNumber,
          reason: rawPhone ? `Invalid phone number (${rawPhone})` : 'Phone number missing',
          raw: row,
        });
      }

      // Name fallback: If name is missing, fallback to Company or Lead + Phone
      const name = rawName || (company ? `${company} (Contact)` : `Lead ${phone.slice(-4)}`);

      // Duplicate check within same sheet
      const dedupeKey = normalizePhone(phone) || (rawEmail ? normalizeEmail(rawEmail) : phone);
      if (dedupeKey && seen.has(dedupeKey)) {
        return rejected.push({
          rowNumber,
          reason: `Duplicate phone number in sheet (${phone})`,
          raw: row,
        });
      }
      seen.add(dedupeKey);

      // Collect any remaining columns into customFields
      const customFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          customFields[k] = v;
        }
      }

      valid.push({
        name,
        phone,
        email: rawEmail || undefined,
        company: company || undefined,
        title: title || undefined,
        city: city || undefined,
        source: 'CSV_IMPORT',
        requirement: requirement || (city ? `City: ${city}` : undefined),
        budget,
        rowNumber,
        customFields,
      });
    });

    return {
      sheetName: targetSheetName,
      totalRows: validDataRows.length,
      readyRows: valid,
      rejectedRows: rejected,
      columns,
    };
  }

  /**
   * Fast Batch Import Rows into MongoDB using insertMany in chunks
   */
  async importRows(organizationId: string, rows: ImportRow[]) {
    if (!rows.length) {
      throw AppError.badRequest('No valid rows provided for import.');
    }
    if (rows.length > 100000) {
      throw AppError.badRequest('Select up to 100,000 valid rows to import.');
    }

    const importedIds: string[] = [];
    const rejected: Array<{ rowNumber: number; reason: string }> = [];

    // Process in high-performance chunks of 500
    const CHUNK_SIZE = 500;
    const now = new Date();

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const docsToInsert = [];

      for (const row of chunk) {
        const normalizedPhone = normalizePhone(row.phone);
        const normalizedEmail = row.email ? normalizeEmail(row.email) : undefined;
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const leadId = `LD-${Date.now().toString(36).toUpperCase()}-${randomSuffix}-${row.rowNumber}`;

        docsToInsert.push({
          organizationId,
          leadId,
          name: row.name.trim(),
          phone: row.phone.trim(),
          normalizedPhone,
          email: row.email ? row.email.trim().toLowerCase() : undefined,
          normalizedEmail,
          company: row.company || 'Individual Prospect',
          title: row.title,
          city: row.city || undefined,
          address: ((row.customFields?.['Address'] || row.customFields?.['address'] || row.customFields?.['City'] || row.customFields?.['Location'] || row.city || '') as string) || undefined,
          source: 'CSV_IMPORT',
          status: 'NEW',
          score: 50,
          scoreCategory: 'WARM',
          budget: row.budget,
          requirement: row.requirement,
          customFields: row.customFields || {},
          tags: ['EXCEL_IMPORT'],
          slaStatus: 'ON_TIME',
          createdAt: now,
          updatedAt: now,
        });
      }

      try {
        const inserted = await LeadModel.insertMany(docsToInsert, { ordered: false });
        for (const doc of inserted) {
          importedIds.push(doc._id.toString());
        }
      } catch (err: any) {
        // If some rows were inserted despite duplicate key errors
        if (err.insertedDocs && Array.isArray(err.insertedDocs)) {
          for (const doc of err.insertedDocs) {
            importedIds.push(doc._id.toString());
          }
        }
        // Identify failed rows
        if (err.writeErrors && Array.isArray(err.writeErrors)) {
          for (const we of err.writeErrors) {
            const failedIndex = we.index;
            const originalRow = chunk[failedIndex];
            rejected.push({
              rowNumber: originalRow?.rowNumber || i + failedIndex + 2,
              reason: we.errmsg?.includes('duplicate key') ? 'Already exists in CRM' : we.errmsg || 'Failed to save',
            });
          }
        } else {
          logger.warn('⚠️ Batch import chunk notice:', err?.message);
        }
      }
    }

    return {
      importedCount: importedIds.length,
      rejected,
      leadIds: importedIds,
    };
  }

  /**
   * Helper to build flexible match filter for lead IDs (supports ObjectId & LD-XXXXX strings)
   */
  private buildLeadIdsFilter(organizationId: string, leadIds: string[]) {
    const validObjectIds = leadIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    return {
      organizationId,
      $or: [
        { _id: { $in: validObjectIds } },
        { leadId: { $in: leadIds } },
      ],
    };
  }

  private unassignedConditions(): Record<string, unknown>[] {
    return [
      {
        $or: [
          { ownerId: { $exists: false } },
          { ownerId: null },
          { ownerId: '' },
        ],
      },
      {
        $or: [
          { 'assignedTo.id': { $exists: false } },
          { 'assignedTo.id': null },
          { 'assignedTo.id': '' },
        ],
      },
      {
        $or: [
          { 'assignedTo.name': { $exists: false } },
          { 'assignedTo.name': null },
          { 'assignedTo.name': '' },
        ],
      },
    ];
  }

  private buildUnassignedLeadIdsFilter(organizationId: string, leadIds: string[]) {
    const leadIdsFilter = this.buildLeadIdsFilter(organizationId, leadIds);
    return {
      organizationId,
      $and: [
        { $or: leadIdsFilter.$or },
        ...this.unassignedConditions(),
      ],
    };
  }

  /**
   * Bulk assign only unassigned leads to one employee.
   */
  async assign(organizationId: string, leadIds: string[], employeeId: string) {
    const uniqueLeadIds = [...new Set(leadIds)];
    if (uniqueLeadIds.length !== leadIds.length) {
      throw AppError.badRequest('The lead selection contains duplicate IDs.');
    }
    const employee = await UserModel.findOne({ _id: employeeId, organizationId, isActive: true }).lean();
    if (!employee) {
      throw AppError.badRequest('Select an active employee in this workspace.');
    }

    const filter = this.buildUnassignedLeadIdsFilter(organizationId, uniqueLeadIds);
    const result = await LeadModel.updateMany(filter, {
      $set: {
        ownerId: employeeId,
        assignedTo: {
          id: employeeId,
          name: employee.name,
          avatarUrl: employee.avatarUrl,
        },
        status: 'ASSIGNED',
      },
    });

    return {
      assignedCount: result.modifiedCount,
      employee: { id: employeeId, name: employee.name },
    };
  }

  /**
   * Assign a specified QUANTITY of unassigned leads directly to an employee
   */
  async assignQuantity(organizationId: string, employeeId: string, quantity: number) {
    const employee = await UserModel.findOne({ _id: employeeId, organizationId, isActive: true }).lean();
    if (!employee) {
      throw AppError.badRequest('Select an active employee in this workspace.');
    }
    if (!quantity || quantity <= 0) {
      throw AppError.badRequest('Please specify a positive number of leads to assign.');
    }

    const unassignedFilter = {
      organizationId,
      $and: this.unassignedConditions(),
    };

    const targetLeads = await LeadModel.find(unassignedFilter)
      .select('_id')
      .sort({ createdAt: -1 })
      .limit(quantity)
      .lean();

    if (targetLeads.length === 0) {
      return {
        assignedCount: 0,
        employee: { id: employeeId, name: employee.name },
        message: 'No unassigned leads available in workspace.',
      };
    }

    const targetIds = targetLeads.map((l) => l._id);
    const result = await LeadModel.updateMany(
      {
        organizationId,
        _id: { $in: targetIds },
        $and: this.unassignedConditions(),
      },
      {
        $set: {
          ownerId: employeeId,
          assignedTo: {
            id: employeeId,
            name: employee.name,
            avatarUrl: employee.avatarUrl,
          },
          status: 'ASSIGNED',
        },
      }
    );

    return {
      assignedCount: result.modifiedCount,
      employee: { id: employeeId, name: employee.name },
    };
  }

  /**
   * Distribute leads equally across multiple employees (Round-Robin)
   */
  async distributeEvenly(organizationId: string, leadIds: string[], employeeIds: string[]) {
    const uniqueLeadIds = [...new Set(leadIds)];
    if (uniqueLeadIds.length !== leadIds.length) {
      throw AppError.badRequest('The lead selection contains duplicate IDs.');
    }
    const uniqueEmployeeIds = [...new Set(employeeIds)];
    if (uniqueEmployeeIds.length === 0) {
      throw AppError.badRequest('Select at least one active employee for distribution.');
    }
    const employees = await UserModel.find({
      _id: { $in: uniqueEmployeeIds },
      organizationId,
      isActive: true,
    }).select('_id name avatarUrl').lean();

    if (employees.length !== uniqueEmployeeIds.length) {
      throw AppError.badRequest('Every selected employee must be active and belong to this workspace.');
    }

    const employeeById = new Map(employees.map(employee => [employee._id.toString(), employee]));
    const assignments = new Map<string, string[]>();

    uniqueLeadIds.forEach((leadId, index) => {
      const employeeId = uniqueEmployeeIds[index % uniqueEmployeeIds.length];
      assignments.set(employeeId, [...(assignments.get(employeeId) || []), leadId]);
    });

    const results = await Promise.all(
      [...assignments.entries()].map(async ([employeeId, ids]) => {
        const employee = employeeById.get(employeeId)!;
        const filter = this.buildUnassignedLeadIdsFilter(organizationId, ids);
        const result = await LeadModel.updateMany(filter, {
          $set: {
            ownerId: employeeId,
            assignedTo: { id: employeeId, name: employee.name, avatarUrl: employee.avatarUrl },
            status: 'ASSIGNED',
          },
        });
        return {
          employee: { id: employeeId, name: employee.name },
          count: result.modifiedCount,
        };
      })
    );

    return {
      assignedCount: results.reduce((sum, a) => sum + a.count, 0),
      distribution: results,
    };
  }

  /**
   * Distribute specific lead counts / batches to specific employees
   */
  async distributeCustom(
    organizationId: string,
    distribution: Array<{ employeeId: string; leadIds: string[] }>
  ) {
    const assignedLeadIds = new Set<string>();
    for (const group of distribution) {
      for (const leadId of group.leadIds) {
        if (assignedLeadIds.has(leadId)) {
          throw AppError.badRequest(`Lead ${leadId} is assigned more than once in this distribution.`);
        }
        assignedLeadIds.add(leadId);
      }
    }
    const employeeIds = [...new Set(distribution.map(d => d.employeeId))];
    const employees = await UserModel.find({
      _id: { $in: employeeIds },
      organizationId,
      isActive: true,
    }).select('_id name avatarUrl').lean();

    if (employees.length !== employeeIds.length) {
      throw AppError.badRequest('Every selected employee must be active and belong to this workspace.');
    }

    const employeeById = new Map(employees.map(emp => [emp._id.toString(), emp]));

    const results = await Promise.all(
      distribution.map(async item => {
        const employee = employeeById.get(item.employeeId);
        if (!employee) throw AppError.badRequest('Select an active employee in this workspace.');

        const filter = this.buildUnassignedLeadIdsFilter(organizationId, item.leadIds);
        const result = await LeadModel.updateMany(filter, {
          $set: {
            ownerId: item.employeeId,
            assignedTo: { id: item.employeeId, name: employee.name, avatarUrl: employee.avatarUrl },
            status: 'ASSIGNED',
          },
        });
        return {
          employee: { id: item.employeeId, name: employee.name },
          count: result.modifiedCount,
        };
      })
    );

    return {
      assignedCount: results.reduce((sum, a) => sum + a.count, 0),
      distribution: results,
    };
  }

  /**
   * Get count and IDs of unassigned leads in workspace for easy distribution
   */
  async getUnassignedSummary(organizationId: string) {
    const filter = {
      organizationId,
      $and: this.unassignedConditions(),
    };
    const total = await LeadModel.countDocuments(filter);
    const docs = await LeadModel.find(filter).select('_id leadId').sort({ createdAt: -1 }).limit(50000).lean();
    return {
      total,
      unassignedIds: docs.map((d) => d._id.toString()),
    };
  }
}

export const leadImportService = new LeadImportService();
