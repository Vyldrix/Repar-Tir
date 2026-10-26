import { Request, Response } from 'express';
import { ListService } from '../services/list.service.js';
import { SseService } from '../services/sse.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
  };
}

export class ListController {
  static async create(req: Request, res: Response): Promise<void> {
    const { title, participantsCount, items } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'usuario-autenticado-id';
    const idempotencyKey =
      req.header('Idempotency-Key') || req.header('X-Idempotency-Key') || undefined;

    const result = await ListService.create(userId, title, idempotencyKey, participantsCount, items);
    res.status(result.status).json(result.data);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.getById(id, userId);
    res.status(result.status).json(result.data);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.update(id, userId, req.body);
    res.status(result.status).json(result.data);
  }

  static async addItem(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.addItem(id, userId, req.body);
    res.status(result.status).json(result.data);
  }

  static async updateItem(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const rawItemId = req.params.itemId;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.updateItem(id, itemId, userId, req.body);
    res.status(result.status).json(result.data);
  }

  static async deleteItem(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const rawItemId = req.params.itemId;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.deleteItem(id, itemId, userId);
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

  static async streamEvents(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || authReq.user?.userId;

    const result = await ListService.getForEvents(id, userId);
    if (result.status !== 200) {
      res.status(result.status).json(result.data);
      return;
    }

    SseService.subscribe(id, res);
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
    const { search, page, limit, includeDeleted } = req.body;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'usuario-autenticado-id';

    const result = await ListService.search(userId, { search, page, limit, includeDeleted });
    res.status(result.status).json(result.data);
  }
}
