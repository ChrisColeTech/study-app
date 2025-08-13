// API-related constants

export const HTTP_STATUS_CODES = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
} as const;

export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  ...CORS_HEADERS,
} as const;

export const API_VERSIONS = {
  V1: 'v1',
} as const;

export const API_PATHS = {
  HEALTH: '/health',
  HEALTH_STATUS: '/health/status',
  AUTH: '/v1/auth',
  PROVIDERS: '/v1/providers',
  EXAMS: '/v1/exams',
  TOPICS: '/v1/topics',
  QUESTIONS: '/v1/questions',
  SESSIONS: '/v1/sessions',
  ANALYTICS: '/v1/analytics',
  GOALS: '/v1/goals',
} as const;

export const REQUEST_LIMITS = {
  MAX_REQUEST_SIZE: 6 * 1024 * 1024, // 6MB
  MAX_QUERY_PARAMS: 50,
  MAX_HEADERS: 100,
  TIMEOUT_SECONDS: 30,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;
