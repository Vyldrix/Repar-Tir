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
    createdAt: Date;
    updatedAt: Date;
  }): List {
    const isoCreatedAt = record.createdAt.toISOString();
    const isoUpdatedAt = record.updatedAt.toISOString();

    return {
      id: record.id,
      title: record.title,
      status: (record.status as ListStatus) || 'BORRADOR',
      userId: record.userId,
      createdAt: isoCreatedAt,
      updatedAt: isoUpdatedAt,
      updated_at: isoUpdatedAt,
    };
  }

  static async create(data: CreateListDto): Promise<List> {
    const title = data.title.trim();
    const created = await prisma.list.create({
      data: {
        title,
        status: 'BORRADOR',
        userId: data.userId,
      },
    });

    return this.mapToDto(created);
  }

  static async findById(id: string): Promise<List | undefined> {
    const found = await prisma.list.findUnique({
      where: { id },
    });

    if (!found) return undefined;

    return this.mapToDto(found);
  }

  static async findByUserId(userId: string): Promise<List[]> {
    const lists = await prisma.list.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return lists.map((l) => this.mapToDto(l));
  }

  static async update(id: string, data: UpdateListDto): Promise<List | undefined> {
    try {
      const updated = await prisma.list.update({
        where: { id },
        data: {
          title: data.title.trim(),
        },
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
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

    const whereClause: { userId: string; title?: { contains: string } } = {
      userId,
    };

    if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
      whereClause.title = {
        contains: options.search.trim(),
      };
    }

    const [total, lists] = await Promise.all([
      prisma.list.count({ where: whereClause }),
      prisma.list.findMany({
        where: whereClause,
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

