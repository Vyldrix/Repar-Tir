import { Router } from 'express';
import { ListController } from '../controllers/list.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const listRouter = Router();

listRouter.post('/', requireAuth, ListController.create);
listRouter.post('/search', requireAuth, ListController.search);

// Papelera de reciclaje y purga (declaradas antes de /:id para evitar colisiones de rutas)
listRouter.get('/trash', requireAuth, ListController.getTrash);
listRouter.delete('/trash/purge', requireAuth, ListController.purgeTrash);

// Eventos SSE y obtención individual
listRouter.get('/:id/events', requireAuth, ListController.streamEvents);
listRouter.get('/:id', requireAuth, ListController.getById);

// Máquina de estados y restauración
listRouter.patch('/:id/status', requireAuth, ListController.updateStatus);
listRouter.post('/:id/restore', requireAuth, ListController.restore);

// Edición y borrado (soft delete a papelera)
listRouter.put('/:id', requireAuth, ListController.update);
listRouter.delete('/:id', requireAuth, ListController.delete);

// CRUD de ítems para cálculo de gastos
listRouter.post('/:id/items', requireAuth, ListController.addItem);
listRouter.put('/:id/items/:itemId', requireAuth, ListController.updateItem);
listRouter.delete('/:id/items/:itemId', requireAuth, ListController.deleteItem);

export default listRouter;
