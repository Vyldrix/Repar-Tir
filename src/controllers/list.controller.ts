import { Request, Response } from 'express';
import { ListService } from '../services/list.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
  };
}

export class ListController {
  static async create(req: Request, res: Response): Promise<void> {
    const { title } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'usuario-autenticado-id';

    const result = await ListService.create(userId, title);
    res.status(result.status).json(result.data);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { title } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.update(id, userId, title);
    res.status(result.status).json(result.data);
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { status } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.updateStatus(id, userId, status);
    res.status(result.status).json(result.data);
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    const result = await ListService.delete(id, userId);
    res.status(result.status).json(result.data);
  }

  static async search(req: Request, res: Response): Promise<void> {
    const { search, page, limit } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'usuario-autenticado-id';

    const result = await ListService.search(userId, { search, page, limit });
    res.status(result.status).json(result.data);
  }
}

