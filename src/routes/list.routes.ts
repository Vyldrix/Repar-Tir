import { Router } from 'express';
import { ListController } from '../controllers/list.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const listRouter = Router();

listRouter.post('/', requireAuth, ListController.create);
listRouter.post('/search', requireAuth, ListController.search);
listRouter.get('/:id/events', requireAuth, ListController.streamEvents);
listRouter.patch('/:id/status', requireAuth, ListController.updateStatus);
listRouter.put('/:id', requireAuth, ListController.update);
listRouter.delete('/:id', requireAuth, ListController.delete);

export default listRouter;
