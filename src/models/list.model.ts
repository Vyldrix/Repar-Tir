import crypto from 'node:crypto';

export interface List {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  updated_at?: string;
}

const lists: List[] = [];

export class ListModel {
  static async create(data: { title: string; userId: string }): Promise<List> {
    const now = new Date().toISOString();
    const newList: List = {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
      updated_at: now,
    };
    lists.push(newList);
    return newList;
  }

  static async findById(id: string): Promise<List | undefined> {
    return lists.find((l) => l.id === id);
  }

  static async findByUserId(userId: string): Promise<List[]> {
    return lists.filter((l) => l.userId === userId);
  }

  static async update(id: string, data: { title: string }): Promise<List | undefined> {
    const list = lists.find((l) => l.id === id);
    if (!list) return undefined;
    const now = new Date().toISOString();
    list.title = data.title.trim();
    list.updatedAt = now;
    list.updated_at = now;
    return list;
  }

  static async delete(id: string): Promise<boolean> {
    const index = lists.findIndex((l) => l.id === id);
    if (index === -1) return false;
    lists.splice(index, 1);
    return true;
  }

  static async search(
    userId: string,
    options: { search?: string; page?: number; limit?: number }
  ): Promise<{ lists: List[]; total: number; page: number; limit: number }> {
    let userLists = lists.filter((l) => l.userId === userId);

    if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
      const term = options.search.trim().toLowerCase();
      userLists = userLists.filter((l) => l.title.toLowerCase().includes(term));
    }

    const total = userLists.length;
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const startIndex = (page - 1) * limit;
    const paginatedLists = userLists.slice(startIndex, startIndex + limit);

    return {
      lists: paginatedLists,
      total,
      page,
      limit,
    };
  }

  static clear(): void {
    lists.length = 0;
  }
}
