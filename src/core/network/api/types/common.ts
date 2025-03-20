type SuccessResponse = {
  success: true
};

type ErrorResponse = {
  success: false;
  message: string;
};

export type ActionResponse =
  | SuccessResponse
  | ErrorResponse;
