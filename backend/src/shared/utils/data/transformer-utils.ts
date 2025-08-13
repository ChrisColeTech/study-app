/**
 * Generic data transformation utilities
 * 
 * Single Responsibility: Data structure transformation and mapping
 */

import { formatDate, isValidDate } from '../common/date-utils';

/**
 * Transform object keys to camelCase
 */
export function transformKeysToCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformKeysToCamelCase);
  }
  
  const transformed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    transformed[camelKey] = transformKeysToCamelCase(value);
  }
  
  return transformed;
}

/**
 * Transform object keys to snake_case
 */
export function transformKeysToSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformKeysToSnakeCase);
  }
  
  const transformed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    transformed[snakeKey] = transformKeysToSnakeCase(value);
  }
  
  return transformed;
}

/**
 * Flatten nested object to dot notation
 */
export function flattenObject(obj: any, prefix = '', separator = '.'): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(flattened, flattenObject(value, newKey, separator));
    } else {
      flattened[newKey] = value;
    }
  }
  
  return flattened;
}

/**
 * Unflatten dot notation object to nested structure
 */
export function unflattenObject(obj: Record<string, any>, separator = '.'): any {
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split(separator);
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  return result;
}

/**
 * Deep merge multiple objects
 */
export function deepMerge<T extends Record<string, any>>(...objects: Partial<T>[]): T {
  if (objects.length === 0) return {} as T;
  if (objects.length === 1) return objects[0] as T;
  
  const result: any = {};
  
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Pick specific properties from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific properties from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj } as any;
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}

/**
 * Map array of objects to new structure
 */
export function mapObjects<T, R>(
  objects: T[],
  mapper: (obj: T, index: number) => R
): R[] {
  return objects.map(mapper);
}

/**
 * Group array of objects by key
 */
export function groupBy<T>(
  array: T[],
  keySelector: (item: T) => string | number
): Record<string | number, T[]> {
  const grouped: Record<string | number, T[]> = {};
  
  for (const item of array) {
    const key = keySelector(item);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }
  
  return grouped;
}

/**
 * Convert array to dictionary/map
 */
export function arrayToMap<T>(
  array: T[],
  keySelector: (item: T) => string | number
): Record<string | number, T> {
  const map: Record<string | number, T> = {};
  
  for (const item of array) {
    const key = keySelector(item);
    map[key] = item;
  }
  
  return map;
}

/**
 * Remove null and undefined values from object
 */
export function removeNullish<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Remove empty values (null, undefined, empty string, empty array)
 */
export function removeEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && 
        value !== undefined && 
        value !== '' && 
        !(Array.isArray(value) && value.length === 0)) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Normalize data by ensuring consistent types and formats
 */
export function normalizeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    // Try to parse as date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
      const date = new Date(data);
      if (isValidDate(date)) {
        return formatDate(date);
      }
    }
    
    // Try to parse as number
    if (/^\d+$/.test(data)) {
      return parseInt(data, 10);
    }
    
    if (/^\d*\.\d+$/.test(data)) {
      return parseFloat(data);
    }
    
    return data.trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(normalizeData);
  }
  
  if (typeof data === 'object') {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeData(value);
    }
    return normalized;
  }
  
  return data;
}