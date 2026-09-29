export interface CreateListDto {
  title: string;
  userId: string;
}

export interface UpdateListDto {
  title: string;
}

export interface SearchListDto {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListResponseDto {
  id: string;
  title: string;
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
