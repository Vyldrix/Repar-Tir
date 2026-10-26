import { ListModel, List } from '../models/list.model.js';
import { ListItemModel } from '../models/list-item.model.js';
import { SearchListDto, ListStatus } from '../dtos/list.dto.js';
import { CreateListItemDto } from '../dtos/item.dto.js';
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

export interface TrashListSummary {
  id: string;
  title: string;
  status: string;
  participantsCount: number;
  totalAmount: number;
  amountPerPerson: number;
  deletedAt: string;
  daysInTrash: number;
  daysRemaining: number;
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
    idempotencyKey?: string,
    participantsCount?: unknown,
    items?: unknown
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

    // 4. Validar cantidad de personas (participantes)
    let parsedParticipants = 1;
    if (participantsCount !== undefined && participantsCount !== null) {
      if (
        typeof participantsCount !== 'number' ||
        !Number.isInteger(participantsCount) ||
        participantsCount < 1
      ) {
        return {
          status: 400,
          data: { message: 'La cantidad de personas debe ser un número entero mayor o igual a 1' },
        };
      }
      parsedParticipants = participantsCount;
    }

    // 5. Validar lista inicial de ítems si se proporcionó
    let parsedItems: CreateListItemDto[] | undefined;
    if (items !== undefined && items !== null) {
      if (!Array.isArray(items)) {
        return {
          status: 400,
          data: { message: 'El campo items debe ser un arreglo de elementos' },
        };
      }
      for (const item of items) {
        if (!item || typeof item !== 'object') {
          return {
            status: 400,
            data: { message: 'Cada ítem debe ser un objeto válido' },
          };
        }
        if (typeof item.name !== 'string' || item.name.trim() === '') {
          return {
            status: 400,
            data: { message: 'El nombre de cada ítem es obligatorio' },
          };
        }
        if (item.price !== undefined && (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0)) {
          return {
            status: 400,
            data: { message: 'El precio del ítem debe ser un número mayor o igual a 0' },
          };
        }
        if (
          item.quantity !== undefined &&
          (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1)
        ) {
          return {
            status: 400,
            data: { message: 'La cantidad del ítem debe ser un número entero mayor o igual a 1' },
          };
        }
      }
      parsedItems = items as CreateListItemDto[];
    }

    const normalizedKey =
      typeof idempotencyKey === 'string' && idempotencyKey.trim() !== ''
        ? idempotencyKey.trim()
        : undefined;

    // 6. Protección Operativa (HU26): Verificar idempotencia si se envió Idempotency-Key
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
        participantsCount: parsedParticipants,
        items: parsedItems,
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

    // 7. Crear la lista sin clave de idempotencia y retornar 201 Created
    const newList = await ListModel.create({
      title,
      userId,
      participantsCount: parsedParticipants,
      items: parsedItems,
    });

    return {
      status: 201,
      data: newList,
    };
  }

  static async getById(
    id: string,
    userId: string | undefined
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(id);
    if (!list || list.deletedAt) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para acceder a esta lista' },
      };
    }

    return {
      status: 200,
      data: list,
    };
  }

  static async update(
    id: string,
    userId: string | undefined,
    data: unknown
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(id);
    if (!list || list.deletedAt) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para editar esta lista' },
      };
    }

    let title: unknown;
    let participantsCount: unknown;

    if (typeof data === 'object' && data !== null) {
      const obj = data as { title?: unknown; participantsCount?: unknown };
      title = obj.title;
      participantsCount = obj.participantsCount;
    } else if (typeof data === 'string') {
      title = data;
    }

    if (title === undefined && participantsCount === undefined) {
      return {
        status: 400,
        data: { message: 'El título o la cantidad de participantes es obligatorio para actualizar' },
      };
    }

    const updatePayload: { title?: string; participantsCount?: number } = {};

    if (title !== undefined) {
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
      updatePayload.title = title.trim();
    }

    if (participantsCount !== undefined) {
      if (
        typeof participantsCount !== 'number' ||
        !Number.isInteger(participantsCount) ||
        participantsCount < 1
      ) {
        return {
          status: 400,
          data: { message: 'La cantidad de personas debe ser un número entero mayor o igual a 1' },
        };
      }
      updatePayload.participantsCount = participantsCount;
    }

    const updatedList = await ListModel.update(id, updatePayload);
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

  static async addItem(
    listId: string,
    userId: string | undefined,
    itemData: { name?: unknown; price?: unknown; quantity?: unknown }
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(listId);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para agregar ítems a esta lista' },
      };
    }

    const { name, price, quantity } = itemData;

    if (name === undefined || typeof name !== 'string' || name.trim() === '') {
      return {
        status: 400,
        data: { message: 'El nombre del ítem es obligatorio' },
      };
    }

    if (name.length > 255) {
      return {
        status: 400,
        data: { message: 'El nombre del ítem excede la longitud máxima permitida' },
      };
    }

    let parsedPrice = 0;
    if (price !== undefined) {
      if (typeof price !== 'number' || isNaN(price) || price < 0) {
        return {
          status: 400,
          data: { message: 'El precio del ítem debe ser un número mayor o igual a 0' },
        };
      }
      parsedPrice = Number(price.toFixed(2));
    }

    let parsedQuantity = 1;
    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
        return {
          status: 400,
          data: { message: 'La cantidad del ítem debe ser un número entero mayor o igual a 1' },
        };
      }
      parsedQuantity = quantity;
    }

    await ListItemModel.create(listId, {
      name: name.trim(),
      price: parsedPrice,
      quantity: parsedQuantity,
    });

    const updatedList = await ListModel.findById(listId);
    return {
      status: 201,
      data: updatedList!,
    };
  }

  static async updateItem(
    listId: string,
    itemId: string,
    userId: string | undefined,
    itemData: { name?: unknown; price?: unknown; quantity?: unknown }
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(listId);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para modificar ítems en esta lista' },
      };
    }

    const item = await ListItemModel.findById(itemId);
    if (!item || item.listId !== listId) {
      return {
        status: 404,
        data: { message: 'Ítem no encontrado en esta lista' },
      };
    }

    const { name, price, quantity } = itemData;
    const updatePayload: { name?: string; price?: number; quantity?: number } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return {
          status: 400,
          data: { message: 'El nombre del ítem no puede estar vacío' },
        };
      }
      if (name.length > 255) {
        return {
          status: 400,
          data: { message: 'El nombre del ítem excede la longitud máxima permitida' },
        };
      }
      updatePayload.name = name.trim();
    }

    if (price !== undefined) {
      if (typeof price !== 'number' || isNaN(price) || price < 0) {
        return {
          status: 400,
          data: { message: 'El precio del ítem debe ser un número mayor o igual a 0' },
        };
      }
      updatePayload.price = Number(price.toFixed(2));
    }

    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
        return {
          status: 400,
          data: { message: 'La cantidad del ítem debe ser un número entero mayor o igual a 1' },
        };
      }
      updatePayload.quantity = quantity;
    }

    await ListItemModel.update(itemId, updatePayload);

    const updatedList = await ListModel.findById(listId);
    return {
      status: 200,
      data: updatedList!,
    };
  }

  static async deleteItem(
    listId: string,
    itemId: string,
    userId: string | undefined
  ): Promise<ServiceResult<List>> {
    const list = await ListModel.findById(listId);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para eliminar ítems de esta lista' },
      };
    }

    const item = await ListItemModel.findById(itemId);
    if (!item || item.listId !== listId) {
      return {
        status: 404,
        data: { message: 'Ítem no encontrado en esta lista' },
      };
    }

    await ListItemModel.delete(itemId);

    const updatedList = await ListModel.findById(listId);
    return {
      status: 200,
      data: updatedList!,
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
    if (!list || list.deletedAt) {
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

    // 3. Mover a la papelera (Soft delete)
    await ListModel.moveToTrash(id);

    // 4. Responder con 200 OK
    return {
      status: 200,
      data: { message: 'Lista eliminada correctamente y enviada a la papelera' },
    };
  }

  static async restore(id: string, userId: string | undefined): Promise<ServiceResult<List>> {
    // 1. Validar si la lista existe
    const list = await ListModel.findById(id);
    if (!list) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    // 2. Validar que pertenezca al usuario autenticado (IDOR)
    if (!userId || list.userId !== userId) {
      return {
        status: 403,
        data: { message: 'No tienes permiso para restaurar esta lista' },
      };
    }

    // 3. Validar que la lista esté efectivamente en la papelera
    if (!list.deletedAt) {
      return {
        status: 400,
        data: { message: 'La lista no se encuentra en la papelera' },
      };
    }

    // 4. Restaurar lista
    const restored = await ListModel.restore(id);
    if (!restored) {
      return {
        status: 404,
        data: { message: 'Lista no encontrada' },
      };
    }

    return {
      status: 200,
      data: restored,
    };
  }

  static async purgeExpiredTrash(
    retentionDays = 30
  ): Promise<ServiceResult<{ message: string; purgedCount: number }>> {
    const validDays =
      typeof retentionDays === 'number' && retentionDays > 0 ? retentionDays : 30;
    const purgedCount = await ListModel.purgeExpiredTrash(validDays);

    return {
      status: 200,
      data: {
        message: `Purga completada. Se eliminaron definitivamente ${purgedCount} lista(s) con más de ${validDays} días en la papelera`,
        purgedCount,
      },
    };
  }

  static async getTrash(userId: string): Promise<ServiceResult<TrashListSummary[]>> {
    const lists = await ListModel.findTrashByUserId(userId);
    const now = Date.now();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const trashSummaries: TrashListSummary[] = lists.map((l) => {
      const deletedTime = l.deletedAt ? new Date(l.deletedAt).getTime() : now;
      const daysInTrash = Math.floor((now - deletedTime) / MS_PER_DAY);
      const daysRemaining = Math.max(0, 30 - daysInTrash);

      return {
        id: l.id,
        title: l.title,
        status: l.status,
        participantsCount: l.participantsCount,
        totalAmount: l.totalAmount,
        amountPerPerson: l.amountPerPerson,
        deletedAt: l.deletedAt || new Date().toISOString(),
        daysInTrash,
        daysRemaining,
      };
    });

    return {
      status: 200,
      data: trashSummaries,
    };
  }

  static async search(
    userId: string,
    options: { search?: unknown; page?: unknown; limit?: unknown; includeDeleted?: unknown }
  ): Promise<ServiceResult<SearchServiceResponse>> {
    const { search, page, limit, includeDeleted } = options;

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
      includeDeleted: Boolean(includeDeleted),
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
