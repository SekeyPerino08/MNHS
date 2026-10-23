import { AppError } from "./AppError.js";

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePagination({ page = 1, pageSize = 10 }: PaginationInput): {
  skip: number;
  take: number;
} {
  if (!Number.isInteger(page) || page < 1) {
    throw new AppError("page must be a positive integer", 400);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AppError("pageSize must be an integer between 1 and 100", 400);
  }
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
