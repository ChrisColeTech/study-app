// Question validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Question validation schemas
 */
export class QuestionValidationSchemas {
  /**
   * Schema for enum parameters validation
   */
  static enumParams(): ValidationSchema {
    return {
      required: [],
      rules: [
        {
          field: 'difficulty',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validDifficulties = ['easy', 'medium', 'hard'];
            if (!validDifficulties.includes(value)) {
              return {
                isValid: false,
                error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'type',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validTypes = ['multiple_choice', 'multiple_answer', 'drag_drop', 'hotspot'];
            if (!validTypes.includes(value)) {
              return {
                isValid: false,
                error: `Invalid type. Valid options: ${validTypes.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }

  /**
   * Schema for search request validation
   */
  static searchRequest(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'provider', validate: ValidationRules.alphanumericId() },
        { field: 'exam', validate: ValidationRules.alphanumericId() },
        { field: 'topic', validate: ValidationRules.alphanumericId() },
        {
          field: 'difficulty',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validDifficulties = ['easy', 'medium', 'hard'];
            if (!validDifficulties.includes(value)) {
              return {
                isValid: false,
                error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'type',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validTypes = ['multiple_choice', 'multiple_answer', 'drag_drop', 'hotspot'];
            if (!validTypes.includes(value)) {
              return {
                isValid: false,
                error: `Invalid type. Valid options: ${validTypes.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'sortBy',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const validSortOptions = ['relevance', 'difficulty', 'date', 'popularity'];
            if (!validSortOptions.includes(value)) {
              return {
                isValid: false,
                error: `Invalid sortBy option. Valid options: ${validSortOptions.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'tags', validate: ValidationRules.array() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }

  /**
   * Schema for question ID validation
   */
  static questionId(): ValidationSchema {
    return {
      required: ['questionId'],
      rules: [
        {
          field: 'questionId',
          validate: ValidationRules.custom((value: string) => {
            if (!value || typeof value !== 'string' || value.trim().length === 0) {
              return { isValid: false, error: 'Question ID is required' };
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
              return {
                isValid: false,
                error:
                  'Invalid question ID format. Use alphanumeric characters, hyphens, and underscores only',
              };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }

  /**
   * Schema for search query validation
   */
  static searchQueryRequest(): ValidationSchema {
    return {
      required: ['query'],
      rules: [
        {
          field: 'query',
          validate: ValidationRules.custom((value: string) => {
            if (!value || typeof value !== 'string' || value.trim().length === 0) {
              return { isValid: false, error: 'Query is required and must be a non-empty string' };
            }
            if (value.length > 200) {
              return { isValid: false, error: 'Query too long. Maximum 200 characters' };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }
}