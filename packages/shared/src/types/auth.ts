export interface AuthHeader {
  authorization: string;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
