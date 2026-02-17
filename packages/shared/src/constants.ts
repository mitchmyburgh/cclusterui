export const DEFAULT_CHAT_TITLE = "New Chat";
export const MAX_MESSAGE_LENGTH = 100_000;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];
export const WS_PING_INTERVAL = 30_000;
export const WS_HEARTBEAT_INTERVAL = 15_000;
export const WS_HEARTBEAT_TIMEOUT = 45_000;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
export const MAX_WS_MESSAGE_SIZE = 1_000_000; // 1MB
export const MAX_FILE_SEARCH_RESULTS = 50;
export const MAX_FILE_SEARCH_QUERY_LENGTH = 500;
export const VALID_AGENT_MODES = [
  "plan",
  "human_confirm",
  "accept_all",
] as const;
