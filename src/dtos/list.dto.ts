import { ListItemResponseDto, CreateListItemDto } from './item.dto.js';

export type ListStatus = 'BORRADOR' | 'CONFIRMADA' | 'ELIMINADA';

export interface CreateListDto {
  title: string;
  userId: string;
  idempotencyKey?: string;
  participantsCount?: number;
  items?: CreateListItemDto[];
}

export interface UpdateListDto {
  title?: string;
  participantsCount?: number;
}

export interface UpdateListStatusDto {
  status: ListStatus;
}

export interface SearchListDto {
  search?: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface ListResponseDto {
  id: string;
  title: string;
  status: ListStatus;
  userId: string;
  participantsCount: number;
  totalAmount: number;
  amountPerPerson: number;
  deletedAt?: string | null;
  items?: ListItemResponseDto[];
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
