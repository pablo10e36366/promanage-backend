export type StudentApiMeta = {
  page?: number;
  page_size?: number;
  total?: number;
};

export type StudentApiResponse<T> = {
  data: T;
  meta?: StudentApiMeta;
};

export type StudentApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    path?: string;
    timestamp?: string;
  };
};

