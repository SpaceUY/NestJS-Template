export class ApiException extends Error {
  readonly code: string;
  readonly data?: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'ApiException';
    this.code = params.code;
    this.data = params.data;
  }
}
