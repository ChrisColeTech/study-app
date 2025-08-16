/**
 * HandlerUtils - Common utilities for BaseHandler
 * Extracted from BaseHandler to achieve SRP compliance
 */

import { HandlerContext } from './types';

export class HandlerUtils {
  /**
   * Extract path parameters from the request
   */
  static getPathParameters(context: HandlerContext): Record<string, string> {
    const params = context.event.pathParameters || {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Extract query parameters from the request
   */
  static getQueryParameters(context: HandlerContext): Record<string, string> {
    const params = context.event.queryStringParameters || {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Parse request body as JSON
   */
  static parseBody<T>(context: HandlerContext): T | null {
    if (!context.event.body) {
      return null;
    }

    try {
      return JSON.parse(context.event.body) as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  /**
   * Match path patterns with parameters
   */
  static matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        // This is a parameter, so it matches any value
        return true;
      }
      return part === pathParts[index];
    });
  }

  /**
   * Extract header value with case-insensitive lookup
   */
  static getHeader(context: HandlerContext, headerName: string): string | undefined {
    const headers = context.event.headers || {};
    
    // Try exact match first
    if (headers[headerName]) {
      return headers[headerName] || undefined;
    }

    // Try case-insensitive match
    const lowerHeaderName = headerName.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerHeaderName) {
        return value || undefined;
      }
    }

    return undefined;
  }

  /**
   * Check if request accepts specific content type
   */
  static acceptsContentType(context: HandlerContext, contentType: string): boolean {
    const acceptHeader = HandlerUtils.getHeader(context, 'Accept');
    if (!acceptHeader) {
      return true; // Default to accepting if no Accept header
    }

    return acceptHeader.includes(contentType) || acceptHeader.includes('*/*');
  }

  /**
   * Get client IP address from various sources
   */
  static getClientIp(context: HandlerContext): string | undefined {
    // Try CloudFront forwarded IP first
    const cloudFrontIp = HandlerUtils.getHeader(context, 'CloudFront-Viewer-Address');
    if (cloudFrontIp) {
      return cloudFrontIp.split(':')[0]; // Remove port if present
    }

    // Try X-Forwarded-For
    const forwardedFor = HandlerUtils.getHeader(context, 'X-Forwarded-For');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim(); // Get first IP
    }

    // Fall back to direct source IP
    return context.event.requestContext?.identity?.sourceIp;
  }

  /**
   * Get user agent string
   */
  static getUserAgent(context: HandlerContext): string | undefined {
    return HandlerUtils.getHeader(context, 'User-Agent');
  }

  /**
   * Check if request is from mobile device
   */
  static isMobileRequest(context: HandlerContext): boolean {
    const userAgent = HandlerUtils.getUserAgent(context);
    if (!userAgent) {
      return false;
    }

    const mobilePatterns = [
      /Mobile/i,
      /Android/i,
      /iPhone/i,
      /iPad/i,
      /Windows Phone/i,
      /BlackBerry/i
    ];

    return mobilePatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Safely parse JSON with fallback
   */
  static safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Validate required parameters are present
   */
  static validateRequiredParams(
    params: Record<string, any>,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter(field => 
      params[field] === undefined || params[field] === null || params[field] === ''
    );

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Sanitize string for logging (remove sensitive data)
   */
  static sanitizeForLogging(value: string): string {
    // Remove potential JWT tokens
    return value.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, 'Bearer [REDACTED]')
                .replace(/password["\s]*[:=]["\s]*[^"\s,}]+/gi, 'password: [REDACTED]')
                .replace(/secret["\s]*[:=]["\s]*[^"\s,}]+/gi, 'secret: [REDACTED]');
  }
}