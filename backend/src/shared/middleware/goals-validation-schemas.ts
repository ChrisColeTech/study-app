// Goals validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Goals validation schemas
 */
export class GoalsValidationSchemas {
  /**
   * Schema for create goal request
   */
  static createGoalRequest(): ValidationSchema {
    return {
      required: ['title', 'type', 'priority', 'targetType', 'targetValue'],
      rules: [
        { field: 'title', validate: ValidationRules.stringLength(1, 200) },
        { field: 'description', validate: ValidationRules.stringLength(0, 1000) },
        {
          field: 'type',
          validate: ValidationRules.custom((value: string) => {
            const validTypes = [
              'exam_preparation',
              'topic_mastery',
              'daily_practice',
              'score_target',
              'streak',
            ];
            if (!validTypes.includes(value)) {
              return { isValid: false, error: `type must be one of: ${validTypes.join(', ')}` };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'priority',
          validate: ValidationRules.custom((value: string) => {
            const validPriorities = ['low', 'medium', 'high'];
            if (!validPriorities.includes(value)) {
              return {
                isValid: false,
                error: `priority must be one of: ${validPriorities.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'targetType',
          validate: ValidationRules.custom((value: string) => {
            const validTargetTypes = ['exam', 'topic', 'questions', 'score', 'days'];
            if (!validTargetTypes.includes(value)) {
              return {
                isValid: false,
                error: `targetType must be one of: ${validTargetTypes.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'targetValue', validate: ValidationRules.numberRange(1) },
        {
          field: 'deadline',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const deadline = new Date(value);
            if (isNaN(deadline.getTime())) {
              return { isValid: false, error: 'deadline must be a valid ISO 8601 date' };
            }
            if (deadline <= new Date()) {
              return { isValid: false, error: 'deadline must be in the future' };
            }
            return { isValid: true };
          }),
        },
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'topicId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
      ],
    };
  }

  /**
   * Schema for update goal request
   */
  static updateGoalRequest(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'title', validate: ValidationRules.stringLength(1, 200) },
        { field: 'description', validate: ValidationRules.stringLength(0, 1000) },
        {
          field: 'priority',
          validate: ValidationRules.custom((value: string) => {
            const validPriorities = ['low', 'medium', 'high'];
            if (value && !validPriorities.includes(value)) {
              return {
                isValid: false,
                error: `priority must be one of: ${validPriorities.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        {
          field: 'status',
          validate: ValidationRules.custom((value: string) => {
            const validStatuses = ['active', 'completed', 'paused', 'abandoned'];
            if (value && !validStatuses.includes(value)) {
              return {
                isValid: false,
                error: `status must be one of: ${validStatuses.join(', ')}`,
              };
            }
            return { isValid: true };
          }),
        },
        { field: 'targetValue', validate: ValidationRules.numberRange(1) },
        { field: 'currentValue', validate: ValidationRules.numberRange(0) },
        {
          field: 'deadline',
          validate: ValidationRules.custom((value: string) => {
            if (!value) return { isValid: true };
            const deadline = new Date(value);
            if (isNaN(deadline.getTime())) {
              return { isValid: false, error: 'deadline must be a valid ISO 8601 date' };
            }
            if (deadline <= new Date()) {
              return { isValid: false, error: 'deadline must be in the future' };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }

  /**
   * Schema for goal ID validation
   */
  static goalId(): ValidationSchema {
    return {
      required: ['goalId'],
      rules: [{ field: 'goalId', validate: ValidationRules.uuid() }],
    };
  }
}