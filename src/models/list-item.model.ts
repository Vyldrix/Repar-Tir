import prisma from '../lib/prisma.js';
import { CreateListItemDto, UpdateListItemDto, ListItemResponseDto } from '../dtos/item.dto.js';

export class ListItemModel {
  private static mapToDto(record: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    listId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ListItemResponseDto {
    const subtotal = Number((record.price * record.quantity).toFixed(2));
    return {
      id: record.id,
      name: record.name,
      price: record.price,
      quantity: record.quantity,
      listId: record.listId,
      subtotal,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  static async create(listId: string, data: CreateListItemDto): Promise<ListItemResponseDto> {
    const price = data.price !== undefined ? Math.max(0, data.price) : 0;
    const quantity = data.quantity !== undefined ? Math.max(1, data.quantity) : 1;

    const created = await prisma.listItem.create({
      data: {
        name: data.name.trim(),
        price,
        quantity,
        listId,
      },
    });

    return this.mapToDto(created);
  }

  static async findById(id: string): Promise<ListItemResponseDto | undefined> {
    const found = await prisma.listItem.findUnique({
      where: { id },
    });

    if (!found) return undefined;
    return this.mapToDto(found);
  }

  static async findByListId(listId: string): Promise<ListItemResponseDto[]> {
    const items = await prisma.listItem.findMany({
      where: { listId },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => this.mapToDto(item));
  }

  static async update(id: string, data: UpdateListItemDto): Promise<ListItemResponseDto | undefined> {
    try {
      const updateData: { name?: string; price?: number; quantity?: number } = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.price !== undefined) updateData.price = Math.max(0, data.price);
      if (data.quantity !== undefined) updateData.quantity = Math.max(1, data.quantity);

      const updated = await prisma.listItem.update({
        where: { id },
        data: updateData,
      });

      return this.mapToDto(updated);
    } catch {
      return undefined;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      await prisma.listItem.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
