/**
 * HTTP request utility functions
 * 
 * Single Responsibility: Request processing and parameter extraction
 */

import { parseQueryString } from '../data/parser-utils';
import { isValidEmail, isValidUUID } from '../common/validation-utils';

/**
 * Extract and validate request parameters
 */
export function extractRequestParams<T = any>(
  event: any,
  paramSchema: Record<string, {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid';
    validator?: (value: any) => boolean;
    default?: any;
  }>
): { params: T; errors: string[] } {
  const params: any = {};
  const errors: string[] = [];
  
  // Get parameters from various sources
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};
  const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
  
  for (const [paramName, config] of Object.entries(paramSchema)) {
    let value = pathParams[paramName] || queryParams[paramName] || body[paramName] || config.default;
    
    // Check required parameters
    if (config.required && (value === undefined || value === null || value === '')) {
      errors.push(`Missing required parameter: ${paramName}`);
      continue;
    }
    
    // Skip validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      continue;
    }
    
    // Type validation and conversion
    if (config.type) {
      const validationResult = validateAndConvertType(value, config.type, paramName);
      if (validationResult.error) {
        errors.push(validationResult.error);
        continue;
      }
      value = validationResult.value;
    }
    
    // Custom validation
    if (config.validator && !config.validator(value)) {
      errors.push(`Invalid value for parameter: ${paramName}`);
      continue;
    }
    
    params[paramName] = value;
  }
  
  return { params: params as T, errors };
}

/**
 * Validate and convert parameter type
 */
function validateAndConvertType(
  value: any,
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid',
  paramName: string
): { value: any; error?: string } {
  switch (type) {
    case 'string':
      return { value: String(value) };
      
    case 'number':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { value, error: `Parameter ${paramName} must be a number` };
      }
      return { value: numValue };
      
    case 'boolean':
      if (typeof value === 'boolean') {
        return { value };
      }
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1') return { value: true };
        if (lower === 'false' || lower === '0') return { value: false };
      }
      return { value, error: `Parameter ${paramName} must be a boolean` };
      
    case 'email':
      if (!isValidEmail(value)) {
        return { value, error: `Parameter ${paramName} must be a valid email` };
      }
      return { value: String(value) };
      
    case 'uuid':
      if (!isValidUUID(value)) {
        return { value, error: `Parameter ${paramName} must be a valid UUID` };
      }
      return { value: String(value) };
      
    default:
      return { value };
  }
}

/**
 * Extract pagination parameters
 */
export function extractPaginationParams(event: any): {
  limit: number;
  offset: number;
  page: number;
  lastEvaluatedKey?: any;
} {
  const queryParams = event.queryStringParameters || {};
  
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const offset = parseInt(queryParams.offset || String((page - 1) * limit), 10);
  
  let lastEvaluatedKey;
  if (queryParams.cursor) {
    try {
      lastEvaluatedKey = JSON.parse(Buffer.from(queryParams.cursor, 'base64').toString());
    } catch {
      // Invalid cursor, ignore
    }
  }
  
  return {
    limit,
    offset,
    page,
    ...(lastEvaluatedKey && { lastEvaluatedKey }),
  };
}

/**
 * Extract sorting parameters
 */
export function extractSortParams(event: any, allowedFields: string[] = []): {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
} {
  const queryParams = event.queryStringParameters || {};
  
  let sortBy = queryParams.sortBy || queryParams.sort || 'createdAt';
  let sortOrder: 'ASC' | 'DESC' = (queryParams.sortOrder || queryParams.order || 'DESC').toUpperCase() as 'ASC' | 'DESC';
  
  // Validate sort field if allowedFields is provided
  if (allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    sortBy = allowedFields[0]; // Default to first allowed field
  }
  
  // Validate sort order
  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    sortOrder = 'DESC';
  }
  
  return { sortBy, sortOrder };
}

/**
 * Extract filter parameters
 */
export function extractFilterParams(event: any, allowedFilters: string[] = []): Record<string, any> {
  const queryParams = event.queryStringParameters || {};
  const filters: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(queryParams)) {
    if (key.startsWith('filter.') || allowedFilters.includes(key)) {
      const filterKey = key.startsWith('filter.') ? key.substring(7) : key;
      filters[filterKey] = value;
    }
  }
  
  return filters;
}

/**
 * Extract request headers (case-insensitive)
 */
export function getHeader(event: any, headerName: string): string | undefined {
  const headers = event.headers || {};
  const lowerHeaderName = headerName.toLowerCase();
  
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerHeaderName) {
      return value as string;
    }
  }
  
  return undefined;
}

/**
 * Extract authorization token
 */
export function extractAuthToken(event: any): string | null {
  const authHeader = getHeader(event, 'authorization');
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Get client IP address
 */
export function getClientIP(event: any): string | undefined {
  // Try various headers that might contain the real client IP
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'fastly-client-ip', // Fastly
    'true-client-ip',
    'x-cluster-client-ip',
  ];
  
  for (const header of ipHeaders) {
    const value = getHeader(event, header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }
  
  // Fallback to source IP from request context
  return event.requestContext?.identity?.sourceIp;
}

/**
 * Get user agent
 */
export function getUserAgent(event: any): string | undefined {
  return getHeader(event, 'user-agent');
}

/**
 * Check if request is from mobile device
 */
export function isMobileRequest(event: any): boolean {
  const userAgent = getUserAgent(event);
  if (!userAgent) return false;
  
  const mobilePattern = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobilePattern.test(userAgent);
}

/**
 * Extract request timestamp
 */
export function getRequestTimestamp(event: any): Date {
  const requestTime = event.requestContext?.requestTime;
  const requestTimeEpoch = event.requestContext?.requestTimeEpoch;
  
  if (requestTimeEpoch) {
    return new Date(requestTimeEpoch);
  }
  
  if (requestTime) {
    return new Date(requestTime);
  }
  
  return new Date();
}

/**
 * Create request context object
 */
export function createRequestContext(event: any): {
  requestId: string;
  ip: string | undefined;
  userAgent: string | undefined;
  timestamp: Date;
  method: string;
  path: string;
  isMobile: boolean;
  headers: Record<string, string>;
} {
  return {
    requestId: event.requestContext?.requestId || '',
    ip: getClientIP(event),
    userAgent: getUserAgent(event),
    timestamp: getRequestTimestamp(event),
    method: event.httpMethod || event.requestContext?.http?.method || 'GET',
    path: event.path || event.requestContext?.http?.path || '/',
    isMobile: isMobileRequest(event),
    headers: event.headers || {},
  };
}

/**
 * Validate content type
 */
export function validateContentType(event: any, expectedTypes: string[]): boolean {
  const contentType = getHeader(event, 'content-type');
  if (!contentType) return false;
  
  return expectedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));
}

/**
 * Check if request accepts JSON
 */
export function acceptsJSON(event: any): boolean {
  const accept = getHeader(event, 'accept');
  if (!accept) return true; // Default to JSON if no Accept header
  
  return accept.toLowerCase().includes('application/json') || accept.includes('*/*');
}

/**
 * Parse request body safely
 */
export function parseRequestBody<T = any>(event: any): T | null {
  if (!event.body) return null;
  
  try {
    if (typeof event.body === 'string') {
      return JSON.parse(event.body);
    }
    return event.body;
  } catch {
    return null;
  }
}