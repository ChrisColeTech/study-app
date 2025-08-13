// Validation Rules Library - Extracted from ValidationMiddleware monster class
// Focused responsibility: Providing reusable validation rule functions
// Part of Objective 30 ValidationMiddleware decomposition

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ValidationContext {
  allFields?: Record<string, any>;
  requestType?: 'query' | 'body' | 'params';
}

/**
 * Focused ValidationRules class containing all validation rule methods
 * Extracted from ValidationMiddleware to achieve SRP compliance
 */
export class ValidationRules {
  /**
   * Validate string length
   */
  static stringLength(min: number, max?: number) {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const length = value.trim().length;
      if (length < min) {
        return { isValid: false, error: `Must be at least ${min} characters long` };
      }

      if (max && length > max) {
        return { isValid: false, error: `Must be ${max} characters or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate number range
   */
  static numberRange(min: number, max?: number) {
    return (value: any): ValidationResult => {
      const num = typeof value === 'string' ? parseInt(value, 10) : value;

      if (isNaN(num) || typeof num !== 'number') {
        return { isValid: false, error: 'Must be a valid number' };
      }

      if (num < min) {
        return { isValid: false, error: `Must be at least ${min}` };
      }

      if (max !== undefined && num > max) {
        return { isValid: false, error: `Must be ${max} or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate alphanumeric ID
   */
  static alphanumericId() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      // Allow alphanumeric characters, hyphens, and underscores
      const alphanumericPattern = /^[a-zA-Z0-9_-]+$/;
      if (!alphanumericPattern.test(value)) {
        return { 
          isValid: false, 
          error: 'Must contain only alphanumeric characters, hyphens, and underscores' 
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate UUID format
   */
  static uuid() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        return { isValid: false, error: 'Must be a valid UUID' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate email format
   */
  static email() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return { isValid: false, error: 'Must be a valid email address' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate array
   */
  static array(
    minItems?: number,
    maxItems?: number,
    itemValidator?: (item: any) => ValidationResult
  ) {
    return (value: any): ValidationResult => {
      if (!Array.isArray(value)) {
        return { isValid: false, error: 'Must be an array' };
      }

      if (minItems !== undefined && value.length < minItems) {
        return { isValid: false, error: `Must contain at least ${minItems} items` };
      }

      if (maxItems !== undefined && value.length > maxItems) {
        return { isValid: false, error: `Must contain ${maxItems} items or less` };
      }

      if (itemValidator) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = itemValidator(value[i]);
          if (!itemResult.isValid) {
            return { 
              isValid: false, 
              error: `Item ${i + 1}: ${itemResult.error}` 
            };
          }
        }
      }

      return { isValid: true };
    };
  }

  /**
   * Validate boolean
   */
  static boolean() {
    return (value: any): ValidationResult => {
      if (typeof value === 'boolean') {
        return { isValid: true };
      }

      // Accept string boolean representations
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'false') {
          return { isValid: true };
        }
      }

      return { isValid: false, error: 'Must be a boolean value (true/false)' };
    };
  }

  /**
   * Custom validator wrapper
   */
  static custom(validator: (value: any, context?: ValidationContext) => ValidationResult) {
    return validator;
  }

  /**
   * Session type validation
   */
  static sessionType() {
    return (value: string): ValidationResult => {
      const validTypes = ['practice', 'exam', 'review'];
      if (!validTypes.includes(value)) {
        return {
          isValid: false,
          error: `Must be one of: ${validTypes.join(', ')}`,
        };
      }
      return { isValid: true };
    };
  }

  /**
   * Session action validation
   */
  static sessionAction() {
    return (value: string): ValidationResult => {
      const validActions = [
        'pause', 'resume', 'next', 'previous', 
        'answer', 'mark_for_review', 'complete'
      ];
      if (!validActions.includes(value)) {
        return {
          isValid: false,
          error: `Must be one of: ${validActions.join(', ')}`,
        };
      }
      return { isValid: true };
    };
  }

  /**
   * ISO date validation
   */
  static isoDate() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { isValid: false, error: 'Must be a valid ISO 8601 date' };
      }

      return { isValid: true };
    };
  }

  /**
   * Float number validation
   */
  static float(min?: number, max?: number) {
    return (value: any): ValidationResult => {
      const num = typeof value === 'string' ? parseFloat(value) : value;

      if (isNaN(num) || typeof num !== 'number') {
        return { isValid: false, error: 'Must be a valid number' };
      }

      if (min !== undefined && num < min) {
        return { isValid: false, error: `Must be at least ${min}` };
      }

      if (max !== undefined && num > max) {
        return { isValid: false, error: `Must be ${max} or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * JSON string validation
   */
  static json() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        JSON.parse(value);
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Must be valid JSON' };
      }
    };
  }

  /**
   * URL validation
   */
  static url() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        new URL(value);
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Must be a valid URL' };
      }
    };
  }

  /**
   * Phone number validation
   */
  static phoneNumber() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      // Basic international phone number pattern
      const phonePattern = /^\+?[1-9]\d{1,14}$/;
      if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
        return { isValid: false, error: 'Must be a valid phone number' };
      }

      return { isValid: true };
    };
  }

  /**
   * File extension validation
   */
  static fileExtension(allowedExtensions: string[]) {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const extension = value.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `Must have one of these extensions: ${allowedExtensions.join(', ')}`,
        };
      }

      return { isValid: true };
    };
  }

  /**
   * IP address validation
   */
  static ipAddress() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      // IPv4 pattern
      const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Pattern.test(value)) {
        const parts = value.split('.');
        if (parts.every(part => parseInt(part, 10) <= 255)) {
          return { isValid: true };
        }
      }

      return { isValid: false, error: 'Must be a valid IP address' };
    };
  }

  /**
   * Hex color validation
   */
  static hexColor() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexPattern.test(value)) {
        return { isValid: false, error: 'Must be a valid hex color (e.g., #FF0000 or #F00)' };
      }

      return { isValid: true };
    };
  }

  /**
   * Time format validation
   */
  static timeFormat() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const timePattern = /^([01]?\d|2[0-3]):([0-5]?\d)$/;
      if (!timePattern.test(value)) {
        return { isValid: false, error: 'Must be in HH:MM format (24-hour)' };
      }

      return { isValid: true };
    };
  }

  /**
   * Credit card validation (Luhn algorithm)
   */
  static creditCard() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const cardNumber = value.replace(/\s/g, '');
      
      if (!/^\d+$/.test(cardNumber)) {
        return { isValid: false, error: 'Must contain only digits' };
      }

      // Luhn algorithm
      let sum = 0;
      let alternate = false;
      
      for (let i = cardNumber.length - 1; i >= 0; i--) {
        let n = parseInt(cardNumber.charAt(i), 10);
        
        if (alternate) {
          n *= 2;
          if (n > 9) {
            n = (n % 10) + 1;
          }
        }
        
        sum += n;
        alternate = !alternate;
      }

      if (sum % 10 !== 0) {
        return { isValid: false, error: 'Must be a valid credit card number' };
      }

      return { isValid: true };
    };
  }

  /**
   * Field matching validation
   */
  static matchesField(fieldName: string) {
    return (value: any, context?: ValidationContext): ValidationResult => {
      if (!context?.allFields) {
        return { isValid: false, error: 'Context required for field matching' };
      }

      const fieldValue = context.allFields[fieldName];
      if (value !== fieldValue) {
        return { isValid: false, error: `Must match ${fieldName}` };
      }

      return { isValid: true };
    };
  }

  /**
   * Coordinates validation
   */
  static coordinates() {
    return (value: { lat: number; lng: number }): ValidationResult => {
      if (typeof value !== 'object' || value === null) {
        return { isValid: false, error: 'Must be an object with lat and lng properties' };
      }

      const { lat, lng } = value;
      
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { isValid: false, error: 'Latitude and longitude must be numbers' };
      }

      if (lat < -90 || lat > 90) {
        return { isValid: false, error: 'Latitude must be between -90 and 90' };
      }

      if (lng < -180 || lng > 180) {
        return { isValid: false, error: 'Longitude must be between -180 and 180' };
      }

      return { isValid: true };
    };
  }

  /**
   * Timezone validation
   */
  static timezone() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        // Test if timezone is valid by creating a date with it
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Must be a valid timezone (e.g., America/New_York)' };
      }
    };
  }
}