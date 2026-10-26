import prisma from '../lib/prisma.js';
import {
  CreateListDto,
  UpdateListDto,
  SearchListDto,
  ListResponseDto,
  ListStatus,
  PaginatedListsResponseDto,
} from '../dtos/list.dto.js';

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
      const subtotal = Number((item.price * item.quantity).toFixed(2));
      totalAmount += subtotal;
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
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
              quantity: i.quantity !== undefined ? Math.max(1, i.quantity) : 1,
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
      const updated = await prisma.list.update({
        where: { id },
        data: {
          status,
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

  static async moveToTrash(id: string): Promise<List | undefined> {
    try {
      const updated = await prisma.list.update({
        where: { id },
        data: {
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
      const updated = await prisma.list.update({
        where: { id },
        data: {
          deletedAt: null,
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
