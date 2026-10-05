import { Request, Response } from 'express';
import { ListModel } from '../models/list.model.js';

export class ListController {
  static async create(req: Request, res: Response): Promise<void> {
    const { title } = req.body;

    // 1. Validar presencia del título
    if (title === undefined || title === null) {
      res.status(400).json({ message: 'El título de la lista es obligatorio' });
      return;
    }

    // 2. Validar que no sea cadena vacía ni contenga solo espacios
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ message: 'El título de la lista no puede estar vacío' });
      return;
    }

    // 3. Validar longitud máxima
    if (title.length > 255) {
      res.status(400).json({ message: 'El título excede la longitud máxima permitida (255 caracteres)' });
      return;
    }

    // 4. Obtener el ID del usuario autenticado desde el middleware
    const userId = (req as any).user?.id || 'usuario-autenticado-id';

    // 5. Crear la lista y retornar respuesta 201 Created
    const newList = await ListModel.create({ title, userId });

    res.status(201).json(newList);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { title } = req.body;

    // 1. Consultar el recurso en la BD antes de modificar para identificar al propietario (HU #16 - IDOR)
    const list = await ListModel.findById(id);
    if (!list) {
      res.status(404).json({ message: 'Lista no encontrada' });
      return;
    }

    // 2. Comparar el identificador del propietario con el ID del usuario autenticado desde el JWT (HU #16 - IDOR)
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId || list.userId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para editar esta lista' });
      return;
    }

    // 3. Validar presencia y formato del título
    if (title === undefined || title === null) {
      res.status(400).json({ message: 'El título es obligatorio' });
      return;
    }

    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ message: 'El título no puede estar vacío' });
      return;
    }

    if (title.length > 255) {
      res.status(400).json({ message: 'El título excede la longitud máxima permitida' });
      return;
    }

    // 4. Actualizar datos y responder 200 OK
    const updatedList = await ListModel.update(id, { title });
    res.status(200).json(updatedList);
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    // 1. Validar si la lista existe
    const list = await ListModel.findById(id);
    if (!list) {
      res.status(404).json({ message: 'Lista no encontrada' });
      return;
    }

    // 2. Validar que la lista pertenezca al usuario autenticado
    const userId = (req as any).user?.id;
    if (list.userId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para eliminar esta lista' });
      return;
    }

    // 3. Eliminar la lista
    await ListModel.delete(id);

    // 4. Responder con 200 OK
    res.status(200).json({ message: 'Lista eliminada correctamente' });
  }

  static async search(req: Request, res: Response): Promise<void> {
    const { search, page, limit } = req.body;

    // 1. Validar parámetros de paginación
    if (page !== undefined && (typeof page !== 'number' || page < 1)) {
      res.status(400).json({ message: 'El parámetro page debe ser un número entero mayor a 0' });
      return;
    }

    if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
      res.status(400).json({ message: 'El parámetro limit debe ser un número entero mayor a 0' });
      return;
    }

    // 2. Obtener userId del usuario autenticado
    const userId = (req as any).user?.id || 'usuario-autenticado-id';

    // 3. Ejecutar consulta sobre listas del usuario
    const result = await ListModel.search(userId, { search, page, limit });

    // 4. Responder 200 OK con listas y paginación
    res.status(200).json({
      lists: result.lists,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  }
}
