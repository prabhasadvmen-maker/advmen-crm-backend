import { taskRepository } from './task.repository.js';
import { ITask } from './task.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { eventBus } from '../../shared/events/EventBus.js';

export class TaskService {
  async createTask(
    organizationId: string,
    creator: { id: string; name: string },
    data: Partial<ITask> & { title: string; dueAt: Date }
  ): Promise<ITask> {
    const taskId = await taskRepository.generateTaskId(organizationId);

    const task = await taskRepository.create(organizationId, {
      ...data,
      taskId,
      ownerId: data.ownerId || creator.id,
      assignedToName: data.assignedToName || creator.name,
      isCompleted: false,
      status: 'PENDING',
    });

    eventBus.emit('task.created', {
      organizationId,
      taskId: task.taskId,
      assignedTo: task.assignedToName,
      dueAt: task.dueAt.toISOString(),
    });

    return task;
  }

  async getTasks(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      ownerId?: string;
      isCompleted?: boolean;
      priority?: string;
    }
  ) {
    const filter: Record<string, unknown> = {};
    if (query.ownerId) {
      filter.$or = [
        { ownerId: query.ownerId },
        { assignedToName: query.ownerId },
      ];
    }
    if (query.isCompleted !== undefined) filter.isCompleted = query.isCompleted;
    if (query.priority) filter.priority = query.priority;

    return taskRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  async updateTask(organizationId: string, id: string, data: Partial<ITask>): Promise<ITask> {
    if (data.isCompleted === true) {
      data.completedAt = new Date();
      data.status = 'COMPLETED';
    }

    const updated = await taskRepository.updateById(organizationId, id, data);
    if (!updated) {
      throw AppError.notFound('Task');
    }
    return updated;
  }

  async deleteTask(organizationId: string, id: string): Promise<void> {
    const deleted = await taskRepository.deleteById(organizationId, id);
    if (!deleted) {
      throw AppError.notFound('Task');
    }
  }

  async getOverdueTasks(organizationId: string) {
    return taskRepository.getOverdueTasks(organizationId);
  }
}

export const taskService = new TaskService();
