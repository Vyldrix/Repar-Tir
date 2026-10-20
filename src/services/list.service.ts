import { ListModel, List } from '../models/list.model.js';
import { SearchListDto, ListStatus } from '../dtos/list.dto.js';
import { SseService } from './sse.service.js';

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

const VALID_STATUSES: ListStatus[] = ['BORRADOR', 'CONFIRMADA', 'ELIMINADA'];

const ALLOWED_TRANSITIONS: Record<ListStatus, ListStatus[]> = {
  BORRADOR: ['CONFIRMADA', 'ELIMINADA'],
  CONFIRMADA: ['ELIMINADA'],
  ELIMINADA: [],
};

export class ListService {
  private static inFlightCreations = new Map<string, Promise<List>>();

  static async create(
    userId: string,
    title: unknown,
    idempotencyKey?: string
  ): Promise<ServiceResult<List>> {
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

    const normalizedKey =
      typeof idempotencyKey === 'string' && idempotencyKey.trim() !== ''
        ? idempotencyKey.trim()
        : undefined;

    // 4. Protección Operativa (HU26): Verificar idempotencia si se envió Idempotency-Key
    if (normalizedKey) {
      const compositeKey = `${userId}:${normalizedKey}`;

      const inFlight = this.inFlightCreations.get(compositeKey);
      if (inFlight) {
        const existing = await inFlight;
        return {
          status: 200,
          data: existing,
        };
      }

      const existingRecord = await ListModel.findByUserAndIdempotencyKey(
        userId,
        normalizedKey
      );
      if (existingRecord) {
        return {
          status: 200,
          data: existingRecord,
        };
      }

      const creationPromise = ListModel.create({
        title,
        userId,
        idempotencyKey: normalizedKey,
      });
      this.inFlightCreations.set(compositeKey, creationPromise);

      try {
        const created = await creationPromise;
        return {
          status: 201,
          data: created,
        };
      } finally {
        this.inFlightCreations.delete(compositeKey);
      }
    }

    // 5. Crear la lista sin clave de idempotencia y retornar 201 Created
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

  static async updateStatus(
    id: string,
    userId: string | undefined,
    newStatus: unknown
  ): Promise<ServiceResult<List>> {
    // 1. Verificar que la lista exista
    const list = await ListModel.findById(id);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    // 2. Verificar que solo el usuario propietario pueda mutar el estado (protección IDOR)
    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para modificar el estado de esta lista' },
      };
    }

    // 3. Validar que el estado destino sea válido
    if (
      typeof newStatus !== 'string' ||
      !VALID_STATUSES.includes(newStatus as ListStatus)
    ) {
      return {
        status: 400,
        data: {
          message: 'El estado proporcionado es inválido. Valores permitidos: BORRADOR, CONFIRMADA, ELIMINADA',
        },
      };
    }

    const currentStatus = list.status;
    const targetStatus = newStatus as ListStatus;

    // 4. Validar máquina de estados y rechazar explícitamente las 3 transiciones prohibidas
    if (currentStatus === 'ELIMINADA' && targetStatus === 'BORRADOR') {
      return {
        status: 400,
        data: {
          message: 'Transición de estado inválida: una lista ELIMINADA no puede reactivarse a BORRADOR',
        },
      };
    }

    if (currentStatus === 'ELIMINADA' && targetStatus === 'CONFIRMADA') {
      return {
        status: 400,
        data: {
          message: 'Transición de estado inválida: una lista ELIMINADA no puede confirmarse',
        },
      };
    }

    if (currentStatus === 'CONFIRMADA' && targetStatus === 'BORRADOR') {
      return {
        status: 400,
        data: {
          message: 'Transición de estado inválida: una lista CONFIRMADA no puede revertirse a BORRADOR',
        },
      };
    }

    if (!ALLOWED_TRANSITIONS[currentStatus].includes(targetStatus)) {
      return {
        status: 400,
        data: {
          message: `Transición de estado inválida: no se permite pasar de ${currentStatus} a ${targetStatus}`,
        },
      };
    }

    // 5. Aplicar el cambio de estado
    const updatedList = await ListModel.updateStatus(id, targetStatus);
    if (!updatedList) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    // 6. Al cambiar a CONFIRMADA, disparar tarea asíncrona en background sin bloquear el hilo principal (HU28)
    if (targetStatus === 'CONFIRMADA') {
      void SseService.triggerBackgroundConfirmation(updatedList.id, updatedList.title);
    }

    return {
      status: 200,
      data: updatedList,
    };
  }

  static async getForEvents(
    id: string,
    userId: string | undefined
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(id);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para acceder a los eventos de esta lista' },
      };
    }

    return {
      status: 200,
      data: list,
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

