import { Request, Response } from 'express';
import { userService } from './user.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';

export class UserController {
  async getUsers(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const result = await userService.getUsers(requester, req.query as any);

    ApiResponse.paginated(
      res,
      result.users,
      result.total,
      result.page,
      Number(req.query.limit) || 50,
      'Team members retrieved successfully'
    );
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const user = await userService.getUserById(requester, req.params.id);

    ApiResponse.success(res, user, 200, undefined, 'User account details');
  }

  async createUser(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const user = await userService.createUser(requester, req.body);

    ApiResponse.created(res, user, `User '${user.name}' provisioned successfully`);
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const user = await userService.updateUser(requester, req.params.id, req.body);

    ApiResponse.success(res, user, 200, undefined, `User '${user.name}' updated successfully`);
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    await userService.deleteUser(requester, req.params.id);

    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Team member removed successfully');
  }
}

export const userController = new UserController();
