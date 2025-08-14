// Topic validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Topic validation schemas
 */
export class TopicValidationSchemas {
  /**
   * Schema for topic ID validation
   */
  static topicId(): ValidationSchema {
    return {
      required: ['topicId'],
      rules: [{ field: 'topicId', validate: ValidationRules.alphanumericId() }],
    };
  }

  /**
   * Schema for topic query parameters
   */
  static topicQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'includeQuestionCount', validate: ValidationRules.boolean() },
        { field: 'includeSubtopics', validate: ValidationRules.boolean() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }
}