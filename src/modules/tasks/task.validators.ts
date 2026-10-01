import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  relatedTo: z
    .object({
      type: z.enum(['LEAD', 'DEAL', 'ACCOUNT', 'GENERAL']).optional().default('GENERAL'),
      id: z.string().optional().default(''),
      name: z.string().optional().default(''),
    })
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => {
      if (!val) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString();
      }
      return new Date(val).toISOString();
    }),
  ownerId: z.string().optional(),
  assignedToName: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  isCompleted: z.boolean().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

export const TaskFilterQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 25)),
  ownerId: z.string().optional(),
  isCompleted: z.string().optional().transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  priority: z.string().optional(),
});
