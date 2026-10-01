import { Request, Response } from 'express';
import { taskService } from './task.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class TaskController {
  async createTask(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const creator = { id: req.user!.id, name: req.user!.name };
    const task = await taskService.createTask(organizationId, creator, req.body);
    ApiResponse.created(res, task, 'Task created successfully');
  }

  async getTasks(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await taskService.getTasks(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Tasks retrieved successfully'
    );
  }

  async updateTask(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const updated = await taskService.updateTask(organizationId, req.params.id, req.body);
    ApiResponse.success(res, updated, 200, undefined, 'Task updated successfully');
  }

  async deleteTask(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await taskService.deleteTask(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Task deleted successfully');
  }

  async getOverdueTasks(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const tasks = await taskService.getOverdueTasks(organizationId);
    ApiResponse.success(res, tasks, 200, undefined, 'Overdue tasks retrieved');
  }
}

export const taskController = new TaskController();
