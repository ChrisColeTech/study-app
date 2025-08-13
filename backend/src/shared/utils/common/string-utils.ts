/**
 * String manipulation utility functions
 * 
 * Single Responsibility: String formatting, sanitization, and transformation
 */

/**
 * Sanitize string by removing harmful characters
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove HTML tags, script tags, and potentially harmful characters
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"']/g, (match) => {
      const entityMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return entityMap[match];
    })
    .trim();
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncateString(str: string, maxLength: number, suffix = '...'): string {
  if (typeof str !== 'string' || maxLength <= 0) {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  const truncateLength = Math.max(0, maxLength - suffix.length);
  return str.substring(0, truncateLength).trim() + suffix;
}

/**
 * Convert string to camelCase
 */
export function camelCase(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 */
export function snakeCase(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
export function pascalCase(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, '');
}

/**
 * Generate a slug from a string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Extract initials from a name
 */
export function getInitials(name: string, maxInitials = 2): string {
  if (typeof name !== 'string') {
    return '';
  }
  
  return name
    .split(' ')
    .filter(word => word.length > 0)
    .slice(0, maxInitials)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Count words in a string
 */
export function wordCount(str: string): number {
  if (typeof str !== 'string') {
    return 0;
  }
  
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Generate a random string of specified length
 */
export function generateRandomString(length: number, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}