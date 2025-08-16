// CommonParsing - Predefined parsing configurations for common use cases
// Part of ParsingMiddleware decomposition (Objective 37)

/**
 * Common parsing configurations that can be reused across the application
 * Provides standardized parsing patterns for typical use cases
 */
export const CommonParsing = {
  /**
   * Standard ID parameter parsing with UUID validation
   */
  id: { type: 'uuid' as const, decode: true },

  /**
   * Simple string ID parameter parsing (for non-UUID IDs)
   */
  stringId: { type: 'string' as const, decode: true },

  /**
   * Standard pagination parsing
   */
  pagination: {
    limit: { type: 'number' as const },
    offset: { type: 'number' as const },
  },

  /**
   * Standard search parameter parsing with length validation
   */
  search: {
    type: 'string' as const,
    decode: true,
    validate: (value: string) => ({
      isValid: value.length >= 1 && value.length <= 255,
      message: 'Search term must be between 1 and 255 characters',
    }),
  },

  /**
   * Boolean flag parsing with enhanced support
   */
  booleanFlag: { type: 'boolean' as const },

  /**
   * Comma-separated array parsing
   */
  csvArray: { type: 'array' as const, arrayDelimiter: ',' },

  /**
   * Pipe-separated array parsing
   */
  pipeArray: { type: 'array' as const, arrayDelimiter: '|' },

  /**
   * Provider/exam ID parsing (alphanumeric with hyphens/underscores)
   */
  alphanumericId: {
    type: 'string' as const,
    decode: true,
    validate: (value: string) => ({
      isValid: /^[a-zA-Z0-9_-]+$/.test(value),
      message: 'ID must contain only alphanumeric characters, hyphens, and underscores',
    }),
  },

  /**
   * Email parameter parsing
   */
  email: { type: 'email' as const },

  /**
   * Date parameter parsing
   */
  date: { type: 'date' as const },

  /**
   * JSON parameter parsing (for complex filter objects)
   */
  jsonParam: { type: 'json' as const, decode: true },

  /**
   * Float/decimal number parsing
   */
  decimal: { type: 'float' as const },

  /**
   * Positive integer validation
   */
  positiveInteger: {
    type: 'number' as const,
    validate: (value: number) => ({
      isValid: value > 0 && Number.isInteger(value),
      message: 'Value must be a positive integer',
    }),
  },

  /**
   * Percentage validation (0-100)
   */
  percentage: {
    type: 'float' as const,
    validate: (value: number) => ({
      isValid: value >= 0 && value <= 100,
      message: 'Percentage must be between 0 and 100',
    }),
  },

  /**
   * Sort order validation
   */
  sortOrder: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['asc', 'desc'].includes(value.toLowerCase()),
      message: 'Sort order must be "asc" or "desc"',
    }),
    transform: (value: string) => value.toLowerCase(),
  },

  /**
   * ISO date string validation
   */
  isoDate: {
    type: 'string' as const,
    validate: (value: string) => {
      const date = new Date(value);
      return {
        isValid: !isNaN(date.getTime()) && value.includes('T'),
        message: 'Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      };
    },
  },

  /**
   * Difficulty level validation for exam questions
   */
  difficultyLevel: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['easy', 'medium', 'hard'].includes(value.toLowerCase()),
      message: 'Difficulty must be "easy", "medium", or "hard"',
    }),
    transform: (value: string) => value.toLowerCase(),
  },

  /**
   * Provider validation for certification questions
   */
  certificationProvider: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['aws', 'azure', 'gcp', 'comptia', 'cisco'].includes(value.toLowerCase()),
      message: 'Provider must be one of: aws, azure, gcp, comptia, cisco',
    }),
    transform: (value: string) => value.toLowerCase(),
  },
};