import { Request } from 'express';

export interface PageParams {
  limit: number;
  offset: number;
  page: number;
}

/** Reads ?page=&limit= from the query string with sane bounds. */
export function getPageParams(req: Request): PageParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginatedResponse<T>(rows: T[], total: number, params: PageParams) {
  return {
    data: rows,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      total_pages: Math.ceil(total / params.limit),
    },
  };
}
