export type ItemUnit = 'u.' | 'kg' | 'g' | 'L' | 'ml' | 'pack' | 'doc.';

export interface CreateListItemDto {
  name: string;
  price?: number;
  quantity?: number;
  unit?: string;
}

export interface UpdateListItemDto {
  name?: string;
  price?: number;
  quantity?: number;
  unit?: string;
}

export interface ListItemResponseDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  listId: string;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export function calculateItemSubtotal(price: number, quantity: number, unit = 'u.'): number {
  const normalizedUnit = (unit || 'u.').trim();
  const factor = normalizedUnit === 'g' || normalizedUnit === 'ml' ? quantity / 1000 : quantity;
  return Number((price * factor).toFixed(2));
}
