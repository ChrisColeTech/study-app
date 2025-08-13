/**
 * Data serialization utility functions
 * 
 * Single Responsibility: JSON serialization, data encoding/decoding
 */

import { formatJSON } from '../common/format-utils';

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch (error) {
    return JSON.stringify({
      error: 'Serialization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: typeof obj,
    });
  }
}

/**
 * Stringify with replacer for circular references
 */
export function stringifyWithCircular(obj: any, space?: number): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  }, space);
}

/**
 * Serialize object for logging
 */
export function serializeForLogging(obj: any, maxDepth = 3): any {
  const seen = new WeakSet();
  
  const serialize = (value: any, depth: number): any => {
    if (depth > maxDepth) {
      return '[Max Depth Reached]';
    }
    
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    
    if (Array.isArray(value)) {
      seen.add(value);
      const result = value.map(item => serialize(item, depth + 1));
      seen.delete(value);
      return result;
    }
    
    seen.add(value);
    const result: any = {};
    
    for (const [key, val] of Object.entries(value)) {
      // Skip functions and symbols
      if (typeof val === 'function' || typeof val === 'symbol') {
        continue;
      }
      
      result[key] = serialize(val, depth + 1);
    }
    
    seen.delete(value);
    return result;
  };
  
  return serialize(obj, 0);
}

/**
 * Encode data to base64
 */
export function encodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'utf8').toString('base64');
  }
  
  // Fallback for environments without Buffer
  return btoa(unescape(encodeURIComponent(data)));
}

/**
 * Decode data from base64
 */
export function decodeBase64(encodedData: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encodedData, 'base64').toString('utf8');
  }
  
  // Fallback for environments without Buffer
  return decodeURIComponent(escape(atob(encodedData)));
}

/**
 * Encode object to URL-safe base64
 */
export function encodeObjectToBase64(obj: any): string {
  const jsonString = safeStringify(obj);
  return encodeBase64(jsonString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode object from URL-safe base64
 */
export function decodeObjectFromBase64<T = any>(encodedData: string): T | null {
  try {
    // Add padding if needed and restore standard base64 characters
    const padded = encodedData + '==='.slice((encodedData.length + 3) % 4);
    const restored = padded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeBase64(restored);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Serialize data for storage (handles special types)
 */
export function serializeForStorage(data: any): string {
  const replacer = (key: string, value: any) => {
    if (value instanceof Date) {
      return { __type: 'Date', __value: value.toISOString() };
    }
    
    if (value instanceof RegExp) {
      return { __type: 'RegExp', __value: value.toString() };
    }
    
    if (value instanceof Map) {
      return { __type: 'Map', __value: Array.from(value.entries()) };
    }
    
    if (value instanceof Set) {
      return { __type: 'Set', __value: Array.from(value) };
    }
    
    return value;
  };
  
  return JSON.stringify(data, replacer);
}

/**
 * Deserialize data from storage (restores special types)
 */
export function deserializeFromStorage<T = any>(serializedData: string): T | null {
  try {
    const reviver = (key: string, value: any) => {
      if (value && typeof value === 'object' && '__type' in value) {
        switch (value.__type) {
          case 'Date':
            return new Date(value.__value);
          case 'RegExp':
            const regexParts = value.__value.match(/^\/(.+)\/([gimuy]*)$/);
            return regexParts ? new RegExp(regexParts[1], regexParts[2]) : value.__value;
          case 'Map':
            return new Map(value.__value);
          case 'Set':
            return new Set(value.__value);
          default:
            return value;
        }
      }
      return value;
    };
    
    return JSON.parse(serializedData, reviver);
  } catch {
    return null;
  }
}

/**
 * Create a hash from object (simple implementation)
 */
export function hashObject(obj: any): string {
  const str = safeStringify(obj);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Deep clone object through serialization
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle special objects
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T;
  }
  
  // Use serialization for complex objects
  const serialized = serializeForStorage(obj);
  const deserialized = deserializeFromStorage(serialized);
  return deserialized || obj;
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: Record<string, any>[], delimiter = ','): string {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.map(header => `"${header}"`).join(delimiter));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const stringValue = value === null || value === undefined ? '' : String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(delimiter));
  }
  
  return csvRows.join('\n');
}

/**
 * Convert data to XML format (simple implementation)
 */
export function convertToXML(data: any, rootTag = 'root'): string {
  const convert = (obj: any, tag: string): string => {
    if (obj === null || obj === undefined) {
      return `<${tag}></${tag}>`;
    }
    
    if (typeof obj !== 'object') {
      return `<${tag}>${String(obj).replace(/[<>&'"]/g, (char) => {
        const entities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;',
        };
        return entities[char];
      })}</${tag}>`;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => convert(item, 'item')).join('');
    }
    
    const inner = Object.entries(obj)
      .map(([key, value]) => convert(value, key))
      .join('');
    
    return `<${tag}>${inner}</${tag}>`;
  };
  
  return `<?xml version="1.0" encoding="UTF-8"?>\n${convert(data, rootTag)}`;
}