import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { ITask, TaskModel } from './task.model.js';

export class TaskRepository extends BaseTenantRepository<ITask> {
  constructor() {
    super(TaskModel);
  }

  async generateTaskId(organizationId: string): Promise<string> {
    const count = await this.model.countDocuments({ organizationId });
    return `TSK-${3001 + count}`;
  }

  async getOverdueTasks(organizationId: string) {
    const now = new Date();
    return this.model
      .find({
        organizationId,
        isCompleted: false,
        dueAt: { $lt: now },
      })
      .lean();
  }
}

export const taskRepository = new TaskRepository();
