import { ListModel, List } from '../models/list.model.js';
import { SearchListDto } from '../dtos/list.dto.js';

export interface ServiceResult<T> {
  status: number;
  data: T | { message: string };
}

export interface SearchServiceResponse {
  lists: List[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export class ListService {
  static async create(userId: string, title: unknown): Promise<ServiceResult<List>> {
    // 1. Validar presencia del título
    if (title === undefined || title === null) {
      return {
        status: 400,
        data: { message: 'El título de la lista es obligatorio' },
      };
    }

    // 2. Validar que no sea cadena vacía ni contenga solo espacios
    if (typeof title !== 'string' || title.trim() === '') {
      return {
        status: 400,
        data: { message: 'El título de la lista no puede estar vacío' },
      };
    }

    // 3. Validar longitud máxima
    if (title.length > 255) {
      return {
        status: 400,
        data: { message: 'El título excede la longitud máxima permitida (255 caracteres)' },
      };
    }

    // 4. Crear la lista y retornar 201 Created
    const newList = await ListModel.create({ title, userId });

    return {
      status: 201,
      data: newList,
    };
  }

  static async update(
    id: string,
    userId: string | undefined,
    title: unknown
  ): Promise<ServiceResult<List>> {
    // 1. Consultar el recurso en la BD antes de modificar para identificar al propietario (HU #16 - IDOR)
    const list = await ListModel.findById(id);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    // 2. Comparar el identificador del propietario con el ID del usuario autenticado desde el JWT (HU #16 - IDOR)
    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para editar esta lista' },
      };
    }

    // 3. Validar presencia y formato del título
    if (title === undefined || title === null) {
      return {
        status: 400,
        data: { message: 'El título es obligatorio' },
      };
    }

    if (typeof title !== 'string' || title.trim() === '') {
      return {
        status: 400,
        data: { message: 'El título no puede estar vacío' },
      };
    }

    if (title.length > 255) {
      return {
        status: 400,
        data: { message: 'El título excede la longitud máxima permitida' },
      };
    }

    // 4. Actualizar datos y responder 200 OK
    const updatedList = await ListModel.update(id, { title });
    if (!updatedList) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    return {
      status: 200,
      data: updatedList,
    };
  }

  static async delete(id: string, userId: string | undefined): Promise<ServiceResult<{ message: string }>> {
    // 1. Validar si la lista existe
    const list = await ListModel.findById(id);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    // 2. Validar que la lista pertenezca al usuario autenticado
    if (list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para eliminar esta lista' },
      };
    }

    // 3. Eliminar la lista
    await ListModel.delete(id);

    // 4. Responder con 200 OK
    return {
      status: 200,
      data: { message: 'Lista eliminada correctamente' },
    };
  }

  static async search(
    userId: string,
    options: { search?: unknown; page?: unknown; limit?: unknown }
  ): Promise<ServiceResult<SearchServiceResponse>> {
    const { search, page, limit } = options;

    // 1. Validar parámetros de paginación
    if (page !== undefined && (typeof page !== 'number' || page < 1)) {
      return {
        status: 400,
        data: { message: 'El parámetro page debe ser un número entero mayor a 0' },
      };
    }

    if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
      return {
        status: 400,
        data: { message: 'El parámetro limit debe ser un número entero mayor a 0' },
      };
    }

    const searchDto: SearchListDto = {
      search: typeof search === 'string' ? search : undefined,
      page: typeof page === 'number' ? page : undefined,
      limit: typeof limit === 'number' ? limit : undefined,
    };

    // 2. Ejecutar consulta sobre listas del usuario
    const result = await ListModel.search(userId, searchDto);

    return {
      status: 200,
      data: {
        lists: result.lists,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      },
    };
  }
}
