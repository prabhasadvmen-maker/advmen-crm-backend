import { Request, Response } from 'express';
import { activityService } from './activity.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class ActivityController {
  async getRecordTimeline(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const recordId = req.params.recordId;
    const timeline = await activityService.getTimeline(organizationId, recordId);
    ApiResponse.success(res, timeline, 200, undefined, 'Timeline events retrieved');
  }

  async addNote(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const actor = req.user!;
    const { recordId, recordType, note } = req.body;

    const activity = await activityService.logActivity(organizationId, {
      type: 'NOTE',
      title: 'Sales Note Added',
      description: note,
      actorId: actor.id,
      actorName: actor.name,
      actorAvatar: actor.avatarUrl,
      relatedRecord: {
        type: recordType || 'LEAD',
        id: recordId,
        name: recordId,
      },
    });

    ApiResponse.created(res, activity, 'Note logged to timeline');
  }

  async getRecentActivities(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
    const activities = await activityService.getRecentActivities(organizationId, limit);
    ApiResponse.success(res, activities, 200, undefined, 'Recent activities retrieved');
  }
}

export const activityController = new ActivityController();
