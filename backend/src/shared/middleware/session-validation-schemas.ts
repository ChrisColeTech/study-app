// Session validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Session validation schemas
 */
export class SessionValidationSchemas {
  /**
   * Schema for create session request
   */
  static createSessionRequest(): ValidationSchema {
    return {
      required: ['examId', 'providerId', 'sessionType'],
      rules: [
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
        { field: 'sessionType', validate: ValidationRules.sessionType() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'questionCount', validate: ValidationRules.numberRange(1, 200) },
        {
          field: 'topics',
          validate: ValidationRules.array(undefined, 20),
        },
        { field: 'timeLimit', validate: ValidationRules.numberRange(5, 300) },
      ],
    };
  }

  /**
   * Schema for session ID validation
   */
  static sessionId(): ValidationSchema {
    return {
      required: ['sessionId'],
      rules: [{ field: 'sessionId', validate: ValidationRules.uuid() }],
    };
  }

  /**
   * Schema for update session request
   */
  static updateSessionRequest(): ValidationSchema {
    return {
      required: ['action'],
      rules: [
        { field: 'action', validate: ValidationRules.sessionAction() },
        {
          field: 'status',
          validate: ValidationRules.custom((value: string) => {
            const validStatuses = ['active', 'paused', 'completed', 'abandoned'];
            if (value && !validStatuses.includes(value)) {
              return {
                isValid: false,
                error: `status must be one of: ${validStatuses.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'currentQuestionIndex', validate: ValidationRules.numberRange(0) },
        { field: 'questionId', validate: ValidationRules.stringLength(1) },
        { field: 'userAnswer', validate: ValidationRules.array(1) },
        { field: 'timeSpent', validate: ValidationRules.numberRange(0) },
      ],
    };
  }

  /**
   * Schema for submit answer request
   */
  static submitAnswerRequest(): ValidationSchema {
    return {
      required: ['questionId', 'answer', 'timeSpent'],
      rules: [
        { field: 'questionId', validate: ValidationRules.stringLength(1) },
        { field: 'questionId', validate: ValidationRules.alphanumericId() },
        { field: 'answer', validate: ValidationRules.array(1) },
        { field: 'timeSpent', validate: ValidationRules.numberRange(0) },
        { field: 'skipped', validate: ValidationRules.boolean() },
        { field: 'markedForReview', validate: ValidationRules.boolean() },
      ],
    };
  }
}