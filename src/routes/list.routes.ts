import { Router } from 'express';
import { ListController } from '../controllers/list.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const listRouter = Router();

listRouter.post('/', requireAuth, ListController.create);
listRouter.post('/search', requireAuth, ListController.search);
listRouter.get('/:id/events', requireAuth, ListController.streamEvents);
listRouter.get('/:id', requireAuth, ListController.getById);
listRouter.patch('/:id/status', requireAuth, ListController.updateStatus);
listRouter.put('/:id', requireAuth, ListController.update);
listRouter.delete('/:id', requireAuth, ListController.delete);

// CRUD de ítems para cálculo de gastos
listRouter.post('/:id/items', requireAuth, ListController.addItem);
listRouter.put('/:id/items/:itemId', requireAuth, ListController.updateItem);
listRouter.delete('/:id/items/:itemId', requireAuth, ListController.deleteItem);

export default listRouter;
