export interface CreateListItemDto {
  name: string;
  price?: number;
  quantity?: number;
}

export interface UpdateListItemDto {
  name?: string;
  price?: number;
  quantity?: number;
}

export interface ListItemResponseDto {
  id: string;
  name: string;
  price: number;
  quantity: number;
  listId: string;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}
