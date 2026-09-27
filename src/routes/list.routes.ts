import { Router } from 'express';
import { ListController } from '../controllers/list.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const listRouter = Router();

listRouter.post('/', authenticateToken, ListController.create);
listRouter.post('/search', authenticateToken, ListController.search);
listRouter.put('/:id', authenticateToken, ListController.update);
listRouter.delete('/:id', authenticateToken, ListController.delete);

export default listRouter;
