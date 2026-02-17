export type TeacherApiMeta = {
  page?: number;
  page_size?: number;
  total?: number;
};

export type TeacherApiResponse<T> = {
  data: T;
  meta?: TeacherApiMeta;
};

export type TeacherApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    path?: string;
    timestamp?: string;
  };
};
