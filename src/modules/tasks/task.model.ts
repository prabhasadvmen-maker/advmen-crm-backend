import mongoose, { Schema, Document } from 'mongoose';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ITask extends Document {
  taskId: string;
  organizationId: string;
  title: string;
  relatedTo?: {
    type?: 'LEAD' | 'DEAL' | 'ACCOUNT' | 'GENERAL';
    id?: string;
    name?: string;
  };
  ownerId: string;
  assignedToName: string;
  priority: TaskPriority;
  dueAt: Date;
  status: TaskStatus;
  isCompleted: boolean;
  completedAt?: Date;
  slaBreachInMinutes?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    relatedTo: {
      type: {
        type: String,
        enum: ['LEAD', 'DEAL', 'ACCOUNT', 'GENERAL'],
        default: 'GENERAL',
      },
      id: { type: String, default: '' },
      name: { type: String, default: '' },
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    assignedToName: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: Date,
    slaBreachInMinutes: Number,
    notes: String,
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ organizationId: 1, dueAt: 1 });
TaskSchema.index({ organizationId: 1, ownerId: 1, isCompleted: 1 });

export const TaskModel = mongoose.model<ITask>('Task', TaskSchema);
