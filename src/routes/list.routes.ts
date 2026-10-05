import { Router } from 'express';
import { ListController } from '../controllers/list.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const listRouter = Router();

listRouter.post('/', requireAuth, ListController.create);
listRouter.post('/search', requireAuth, ListController.search);
listRouter.put('/:id', requireAuth, ListController.update);
listRouter.delete('/:id', requireAuth, ListController.delete);

export default listRouter;
