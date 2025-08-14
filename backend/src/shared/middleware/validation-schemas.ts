// Additional validation helper methods
// Phase 35: ValidationSchemas Decomposition - Legacy helpers

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * TYPE-SAFE VALIDATION SCHEMAS
 * Generated from TypeScript type definitions to ensure runtime validation matches compile-time types
 * This section bridges the gap between TypeScript interfaces and runtime validation
 */

// No longer importing undefined types - all validation uses existing ValidationRules class

/**
 * Additional validation helper methods that complement the existing ValidationRules
 * These methods provide domain-specific validation patterns
 */
export class AdditionalValidationHelpers {
  
  /**
   * Enhanced session request validation using existing ValidationRules methods
   * Uses only methods that actually exist in ValidationRules class
   */
  static createEnhancedSessionValidation(): ValidationSchema {
    return {
      required: ['examId', 'providerId', 'sessionType'],
      rules: [
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'sessionType', validate: ValidationRules.sessionType() },
        { field: 'questionCount', validate: ValidationRules.numberRange(1, 200) },
        { field: 'topics', validate: ValidationRules.array(undefined, 20) },
        { field: 'timeLimit', validate: ValidationRules.numberRange(5, 300) },
        { field: 'isAdaptive', validate: ValidationRules.boolean() },
      ],
    };
  }

  /**
   * Enhanced answer submission validation using existing ValidationRules methods
   */
  static createEnhancedAnswerValidation(): ValidationSchema {
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

  /**
   * Enhanced update session validation using existing ValidationRules methods
   */
  static createEnhancedUpdateValidation(): ValidationSchema {
    return {
      required: ['action'],
      rules: [
        { field: 'action', validate: ValidationRules.sessionAction() },
        { field: 'currentQuestionIndex', validate: ValidationRules.numberRange(0) },
        { field: 'questionId', validate: ValidationRules.stringLength(1) },
        { field: 'questionId', validate: ValidationRules.alphanumericId() },
        { field: 'userAnswer', validate: ValidationRules.array(1) },
        { field: 'timeSpent', validate: ValidationRules.numberRange(0) },
      ],
    };
  }

  /**
   * Enhanced session ID validation using existing ValidationRules methods
   */
  static createEnhancedSessionIdValidation(): ValidationSchema {
    return {
      required: ['sessionId'],
      rules: [
        { field: 'sessionId', validate: ValidationRules.uuid() },
      ],
    };
  }

  /**
   * Enhanced provider ID validation using existing ValidationRules methods
   */
  static createEnhancedProviderIdValidation(): ValidationSchema {
    return {
      required: ['providerId'],
      rules: [
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
        { 
          field: 'providerId', 
          validate: ValidationRules.custom((value: string) => {
            const validProviderIds = ['aws', 'azure', 'gcp', 'comptia', 'cisco'];
            if (!validProviderIds.includes(value.toLowerCase())) {
              return {
                isValid: false,
                error: `Invalid provider. Valid options: ${validProviderIds.join(', ')}`,
              };
            }
            return { isValid: true };
          })
        },
      ],
    };
  }

  /**
   * Enhanced question ID validation using existing ValidationRules methods
   */
  static createEnhancedQuestionIdValidation(): ValidationSchema {
    return {
      required: ['questionId'],
      rules: [
        { field: 'questionId', validate: ValidationRules.stringLength(1) },
        { 
          field: 'questionId', 
          validate: ValidationRules.custom((value: string) => {
            // Question ID format: providerId-examId-questionNumber or UUID
            const isUuid = /^[a-f0-9-]{36}$/.test(value);
            const isCompositeId = /^[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-\d+$/.test(value);
            
            if (!isUuid && !isCompositeId) {
              return {
                isValid: false,
                error: 'Question ID must be either UUID format or composite format (provider-exam-number)',
              };
            }
            
            return { isValid: true };
          })
        },
      ],
    };
  }

  /**
   * Enhanced analytics request validation using existing ValidationRules methods
   */
  static createEnhancedAnalyticsValidation(): ValidationSchema {
    return {
      required: [],
      rules: [
        { 
          field: 'timeRange', 
          validate: ValidationRules.custom((value: string) => {
            const validRanges = ['week', 'month', 'quarter', 'year', 'all'];
            if (value && !validRanges.includes(value)) {
              return {
                isValid: false,
                error: `Invalid time range. Valid options: ${validRanges.join(', ')}`,
              };
            }
            return { isValid: true };
          })
        },
        { field: 'startDate', validate: ValidationRules.isoDate() },
        { field: 'endDate', validate: ValidationRules.isoDate() },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'includeDetails', validate: ValidationRules.boolean() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 1000) },
        { field: 'offset', validate: ValidationRules.numberRange(0) },
      ],
    };
  }

  /**
   * Enhanced goal creation validation using existing ValidationRules methods
   */
  static createEnhancedGoalValidation(): ValidationSchema {
    return {
      required: ['title', 'type', 'priority', 'targetType', 'targetValue'],
      rules: [
        { field: 'title', validate: ValidationRules.stringLength(1, 200) },
        { field: 'description', validate: ValidationRules.stringLength(0, 1000) },
        { 
          field: 'type', 
          validate: ValidationRules.custom((value: string) => {
            const validTypes = ['exam_completion', 'score_achievement', 'topic_mastery', 'streak_maintenance'];
            if (!validTypes.includes(value)) {
              return {
                isValid: false,
                error: `Invalid goal type. Valid options: ${validTypes.join(', ')}`,
              };
            }
            return { isValid: true };
          })
        },
        { field: 'priority', validate: ValidationRules.stringLength(1) },
        { field: 'targetType', validate: ValidationRules.stringLength(1) },
        { field: 'targetValue', validate: ValidationRules.numberRange(1) },
        { field: 'currentValue', validate: ValidationRules.numberRange(0) },
        { field: 'dueDate', validate: ValidationRules.isoDate() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'topicId', validate: ValidationRules.alphanumericId() },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
      ],
    };
  }
}