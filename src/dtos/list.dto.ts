export type ListStatus = 'BORRADOR' | 'CONFIRMADA' | 'ELIMINADA';

export interface CreateListDto {
  title: string;
  userId: string;
  idempotencyKey?: string;
}

export interface UpdateListDto {
  title: string;
}

export interface UpdateListStatusDto {
  status: ListStatus;
}

export interface SearchListDto {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListResponseDto {
  id: string;
  title: string;
  status: ListStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  updated_at?: string;
}

export interface PaginatedListsResponseDto {
  lists: ListResponseDto[];
  total: number;
  page: number;
  limit: number;
}

