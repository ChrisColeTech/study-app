/**
 * Data parsing utility functions
 * 
 * Single Responsibility: Data parsing and format conversion
 */

import { isValidJSON, isValidDateString } from '../common/validation-utils';

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T = any>(jsonString: string, fallback: T | null = null): T | null {
  if (!isValidJSON(jsonString)) {
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  if (!queryString || typeof queryString !== 'string') {
    return params;
  }
  
  const cleanQuery = queryString.replace(/^\?/, '');
  if (!cleanQuery) {
    return params;
  }
  
  const pairs = cleanQuery.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(decodeURIComponent);
    if (key) {
      params[key] = value || '';
    }
  }
  
  return params;
}

/**
 * Parse CSV string to array
 */
export function parseCSV(csvString: string, delimiter = ','): string[][] {
  if (typeof csvString !== 'string') {
    return [];
  }
  
  const lines = csvString.trim().split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      const fields = line.split(delimiter).map(field => field.trim().replace(/^"|"$/g, ''));
      result.push(fields);
    }
  }
  
  return result;
}

/**
 * Parse boolean from various formats
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  
  if (typeof value === 'number') {
    return value !== 0;
  }
  
  return false;
}

/**
 * Parse integer with validation
 */
export function parseInteger(value: any, fallback?: number): number | undefined {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : fallback;
  }
  
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) ? parsed : fallback;
  }
  
  return fallback;
}

/**
 * Parse float with validation
 */
export function parseFloatSafely(value: any, fallback?: number): number | undefined {
  if (typeof value === 'number') {
    return !isNaN(value) ? value : fallback;
  }
  
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return !isNaN(parsed) ? parsed : fallback;
  }
  
  return fallback;
}

/**
 * Parse date from multiple formats
 */
export function parseDateSafely(value: any): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  if (typeof value === 'string' && isValidDateString(value)) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

/**
 * Parse array from various formats
 */
export function parseArray(value: any, separator = ','): any[] {
  if (Array.isArray(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
      // Try to parse as JSON array
      const parsed = safeJsonParse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    
    // Split by separator
    return value.split(separator).map(item => item.trim()).filter(item => item.length > 0);
  }
  
  if (value !== null && value !== undefined) {
    return [value];
  }
  
  return [];
}

/**
 * Parse environment variable with type casting
 */
export function parseEnvVar<T = string>(
  name: string, 
  defaultValue: T, 
  parser?: (value: string) => T
): T {
  const value = process.env[name];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  if (parser) {
    try {
      return parser(value);
    } catch {
      return defaultValue;
    }
  }
  
  return (value as unknown) as T;
}

/**
 * Parse configuration object with type validation
 */
export function parseConfig<T>(
  configString: string,
  validator: (obj: any) => obj is T,
  fallback: T
): T {
  const parsed = safeJsonParse(configString);
  
  if (parsed && validator(parsed)) {
    return parsed;
  }
  
  return fallback;
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  if (typeof duration !== 'string') {
    return 0;
  }
  
  const match = duration.match(/^(\d+)([smhd]?)$/);
  if (!match) {
    return 0;
  }
  
  const [, num, unit] = match;
  const value = parseInt(num, 10);
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value; // assume milliseconds
  }
}

/**
 * Parse size string to bytes
 */
export function parseSize(size: string): number {
  if (typeof size !== 'string') {
    return 0;
  }
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)([kmgt]?b?)$/);
  if (!match) {
    return 0;
  }
  
  const [, num, unit] = match;
  const value = Number.parseFloat(num);
  
  if (isNaN(value)) {
    return 0;
  }
  
  switch (unit) {
    case 'kb': return value * 1024;
    case 'mb': return value * 1024 * 1024;
    case 'gb': return value * 1024 * 1024 * 1024;
    case 'tb': return value * 1024 * 1024 * 1024 * 1024;
    default: return value; // assume bytes
  }
}