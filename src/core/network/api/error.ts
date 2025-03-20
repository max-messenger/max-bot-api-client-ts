export type ErrorResponse = {
  code: string;
  message: string;
};

export class MaxError extends Error {
  constructor(
    public readonly status: number,
    private readonly response: ErrorResponse,
  ) {
    super(`${status}: ${response.message}`);
  }

  get code() {
    return this.response.code;
  }

  get description() {
    return this.response.message;
  }
}
