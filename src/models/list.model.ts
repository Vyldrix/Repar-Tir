import prisma from '../lib/prisma.js';
import {
  CreateListDto,
  UpdateListDto,
  SearchListDto,
  ListResponseDto,
  ListStatus,
  PaginatedListsResponseDto,
} from '../dtos/list.dto.js';
import { calculateItemSubtotal } from '../dtos/item.dto.js';

export type List = ListResponseDto;

export class ListModel {
  private static mapToDto(record: {
    id: string;
    title: string;
    status: string;
    userId: string;
    participantsCount?: number | null;
    deletedAt?: Date | null;
    items?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      unit?: string | null;
      listId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): List {
    const isoCreatedAt = record.createdAt.toISOString();
    const isoUpdatedAt = record.updatedAt.toISOString();
    const participantsCount =
      record.participantsCount && record.participantsCount > 0
        ? record.participantsCount
        : 1;

    let totalAmount = 0;
    const mappedItems = record.items?.map((item) => {
      const unit = item.unit || 'u.';
      const subtotal = calculateItemSubtotal(item.price, item.quantity, unit);
      totalAmount += subtotal;
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        unit,
        listId: item.listId,
        subtotal,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    totalAmount = Number(totalAmount.toFixed(2));
    const amountPerPerson = Number((totalAmount / participantsCount).toFixed(2));

    return {
      id: record.id,
      title: record.title,
      status: (record.status as ListStatus) || 'BORRADOR',
      userId: record.userId,
      participantsCount,
      totalAmount,
      amountPerPerson,
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
      items: mappedItems,
      createdAt: isoCreatedAt,
      updatedAt: isoUpdatedAt,
      updated_at: isoUpdatedAt,
    };
  }

  static async create(data: CreateListDto): Promise<List> {
    const title = data.title.trim();
    const participantsCount =
      data.participantsCount && data.participantsCount > 0
        ? data.participantsCount
        : 1;

    const itemsCreateData =
      data.items && data.items.length > 0
        ? {
            create: data.items.map((i) => ({
              name: i.name.trim(),
              price: i.price !== undefined ? Math.max(0, i.price) : 0,
              quantity: i.quantity !== undefined ? Math.max(0.01, i.quantity) : 1,
              unit: i.unit ? i.unit.trim() : 'u.',
            })),
          }
        : undefined;

    const created = await prisma.list.create({
      data: {
        title,
        status: 'BORRADOR',
        userId: data.userId,
        participantsCount,
        idempotencyKey: data.idempotencyKey ?? null,
        items: itemsCreateData,
      },
      include: {
        items: true,
      },
    });

    return this.mapToDto(created);
  }

  static async findByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<List | undefined> {
    const found = await prisma.list.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
      include: {
        items: true,
      },
    });

    if (!found) return undefined;

    return this.mapToDto(found);
  }

  static async findById(id: string): Promise<List | undefined> {
    const found = await prisma.list.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!found) return undefined;

    return this.mapToDto(found);
  }

  static async findByUserId(userId: string): Promise<List[]> {
    const lists = await prisma.list.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return lists.map((l) => this.mapToDto(l));
  }

  static async update(id: string, data: UpdateListDto): Promise<List | undefined> {
    try {
      const updateData: { title?: string; participantsCount?: number } = {};
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.participantsCount !== undefined) updateData.participantsCount = data.participantsCount;

      const updated = await prisma.list.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
        },
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
  }

  static async updateStatus(id: string, status: ListStatus): Promise<List | undefined> {
    try {
      const data: { status: ListStatus; deletedAt?: Date } = { status };
      if (status === 'ELIMINADA') {
        data.deletedAt = new Date();
      }

      const updated = await prisma.list.update({
        where: { id },
        data,
        include: {
          items: true,
        },
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
  }

  static async moveToTrash(id: string): Promise<List | undefined> {
    try {
      const updated = await prisma.list.update({
        where: { id },
        data: {
          status: 'ELIMINADA',
          deletedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
  }

  static async restore(id: string): Promise<List | undefined> {
    try {
      const current = await prisma.list.findUnique({ where: { id } });
      if (!current) return undefined;

      const updated = await prisma.list.update({
        where: { id },
        data: {
          deletedAt: null,
          status: current.status === 'ELIMINADA' ? 'BORRADOR' : current.status,
        },
        include: {
          items: true,
        },
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
  }

  static async findTrashByUserId(userId: string): Promise<List[]> {
    const lists = await prisma.list.findMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
      include: {
        items: true,
      },
      orderBy: { deletedAt: 'desc' },
    });

    return lists.map((l) => this.mapToDto(l));
  }

  static async purgeExpiredTrash(retentionDays = 30, userId?: string): Promise<number> {
    if (retentionDays <= 0) {
      const whereClause: { deletedAt: { not: null }; userId?: string } = {
        deletedAt: { not: null },
      };
      if (userId) {
        whereClause.userId = userId;
      }
      const result = await prisma.list.deleteMany({
        where: whereClause,
      });
      return result.count;
    }

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const whereClause: { deletedAt: { lte: Date }; userId?: string } = {
      deletedAt: {
        lte: cutoffDate,
      },
    };
    if (userId) {
      whereClause.userId = userId;
    }

    const result = await prisma.list.deleteMany({
      where: whereClause,
    });

    return result.count;
  }

  static async delete(id: string): Promise<boolean> {
    try {
      await prisma.list.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  static async search(
    userId: string,
    options: SearchListDto
  ): Promise<PaginatedListsResponseDto> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const skip = (page - 1) * limit;

    const whereClause: {
      userId: string;
      title?: { contains: string };
      deletedAt?: null | { not: null };
    } = {
      userId,
    };

    if (!options.includeDeleted) {
      whereClause.deletedAt = null;
    }

    if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
      whereClause.title = {
        contains: options.search.trim(),
      };
    }

    const [total, lists] = await Promise.all([
      prisma.list.count({ where: whereClause }),
      prisma.list.findMany({
        where: whereClause,
        include: {
          items: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      lists: lists.map((l) => this.mapToDto(l)),
      total,
      page,
      limit,
    };
  }

  static async clear(): Promise<void> {
    await prisma.list.deleteMany();
  }
}
