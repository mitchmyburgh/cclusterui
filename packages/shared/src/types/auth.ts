export interface AuthHeader {
  authorization: string;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  type: "jwt" | "api_key" | "legacy";
}
