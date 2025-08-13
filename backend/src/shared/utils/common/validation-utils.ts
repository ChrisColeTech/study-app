/**
 * Common validation utility functions
 * 
 * Single Responsibility: Data validation and format checking
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate UUID format (v4)
 */
export function isValidUUID(uuid: string): boolean {
  if (typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate URL format
 */
export function isValidURL(url: string): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number format (basic)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (typeof phone !== 'string') {
    return false;
  }
  
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  }
  
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}

/**
 * Validate numeric string
 */
export function isNumeric(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  return !isNaN(Number(value)) && !isNaN(parseFloat(value));
}

/**
 * Validate integer string
 */
export function isInteger(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  return Number.isInteger(Number(value));
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? Number(value) : value;
  return !isNaN(num) && num > 0;
}

/**
 * Validate range (inclusive)
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * Validate string length
 */
export function isValidLength(str: string, minLength: number, maxLength?: number): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  
  const length = str.length;
  return length >= minLength && (maxLength === undefined || length <= maxLength);
}

/**
 * Validate JSON string
 */
export function isValidJSON(str: string): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate date string
 */
export function isValidDateString(dateStr: string): boolean {
  if (typeof dateStr !== 'string') {
    return false;
  }
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate array and check if not empty
 */
export function isNonEmptyArray<T>(value: any): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Validate object and check if not empty
 */
export function isNonEmptyObject(value: any): boolean {
  return typeof value === 'object' && 
         value !== null && 
         !Array.isArray(value) && 
         Object.keys(value).length > 0;
}

/**
 * Validate required fields in object
 */
export function hasRequiredFields(obj: any, requiredFields: string[]): boolean {
  if (!isNonEmptyObject(obj)) {
    return false;
  }
  
  return requiredFields.every(field => {
    const value = obj[field];
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * Validate enum value
 */
export function isValidEnumValue<T>(value: any, enumObject: T): value is T[keyof T] {
  return Object.values(enumObject as any).includes(value);
}