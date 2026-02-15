export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
