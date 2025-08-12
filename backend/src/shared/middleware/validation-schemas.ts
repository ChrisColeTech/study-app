// Validation schemas for extracting handler validation methods
// Phase 2: Handler Validation Extraction

import { ValidationSchema, ValidationRules } from './validation.middleware';

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
        { field: 'topics', validate: ValidationRules.array(undefined, 20, ValidationRules.alphanumericId()) },
        { field: 'timeLimit', validate: ValidationRules.numberRange(5, 300) }
      ]
    };
  }

  /**
   * Schema for session ID validation
   */
  static sessionId(): ValidationSchema {
    return {
      required: ['sessionId'],
      rules: [
        { field: 'sessionId', validate: ValidationRules.uuid() }
      ]
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
        { field: 'status', validate: ValidationRules.custom((value: string) => {
          const validStatuses = ['active', 'paused', 'completed', 'abandoned'];
          if (value && !validStatuses.includes(value)) {
            return { isValid: false, error: `status must be one of: ${validStatuses.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'currentQuestionIndex', validate: ValidationRules.numberRange(0) },
        { field: 'questionId', validate: ValidationRules.stringLength(1) },
        { field: 'userAnswer', validate: ValidationRules.array(1) },
        { field: 'timeSpent', validate: ValidationRules.numberRange(0) }
      ]
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
        { field: 'markedForReview', validate: ValidationRules.boolean() }
      ]
    };
  }
}

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
        { field: 'type', validate: ValidationRules.custom((value: string) => {
          const validTypes = ['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'];
          if (!validTypes.includes(value)) {
            return { isValid: false, error: `type must be one of: ${validTypes.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'priority', validate: ValidationRules.custom((value: string) => {
          const validPriorities = ['low', 'medium', 'high'];
          if (!validPriorities.includes(value)) {
            return { isValid: false, error: `priority must be one of: ${validPriorities.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'targetType', validate: ValidationRules.custom((value: string) => {
          const validTargetTypes = ['exam', 'topic', 'questions', 'score', 'days'];
          if (!validTargetTypes.includes(value)) {
            return { isValid: false, error: `targetType must be one of: ${validTargetTypes.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'targetValue', validate: ValidationRules.numberRange(1) },
        { field: 'deadline', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const deadline = new Date(value);
          if (isNaN(deadline.getTime())) {
            return { isValid: false, error: 'deadline must be a valid ISO 8601 date' };
          }
          if (deadline <= new Date()) {
            return { isValid: false, error: 'deadline must be in the future' };
          }
          return { isValid: true };
        })},
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'topicId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.stringLength(1) }
      ]
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
        { field: 'priority', validate: ValidationRules.custom((value: string) => {
          const validPriorities = ['low', 'medium', 'high'];
          if (value && !validPriorities.includes(value)) {
            return { isValid: false, error: `priority must be one of: ${validPriorities.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'status', validate: ValidationRules.custom((value: string) => {
          const validStatuses = ['active', 'completed', 'paused', 'abandoned'];
          if (value && !validStatuses.includes(value)) {
            return { isValid: false, error: `status must be one of: ${validStatuses.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'targetValue', validate: ValidationRules.numberRange(1) },
        { field: 'currentValue', validate: ValidationRules.numberRange(0) },
        { field: 'deadline', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const deadline = new Date(value);
          if (isNaN(deadline.getTime())) {
            return { isValid: false, error: 'deadline must be a valid ISO 8601 date' };
          }
          if (deadline <= new Date()) {
            return { isValid: false, error: 'deadline must be in the future' };
          }
          return { isValid: true };
        })}
      ]
    };
  }

  /**
   * Schema for goal ID validation
   */
  static goalId(): ValidationSchema {
    return {
      required: ['goalId'],
      rules: [
        { field: 'goalId', validate: ValidationRules.uuid() }
      ]
    };
  }
}

/**
 * Analytics validation schemas  
 */
export class AnalyticsValidationSchemas {
  
  /**
   * Schema for progress analytics request
   */
  static progressAnalyticsRequest(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'timeframe', validate: ValidationRules.custom((value: string) => {
          const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
          if (value && !validTimeframes.includes(value)) {
            return { isValid: false, error: `timeframe must be one of: ${validTimeframes.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'startDate', validate: ValidationRules.isoDate() },
        { field: 'endDate', validate: ValidationRules.isoDate() },
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'examId', validate: ValidationRules.alphanumericId() },
        { field: 'topics', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const topics = value.split(',');
          if (topics.length > 20) {
            return { isValid: false, error: 'Maximum 20 topics allowed' };
          }
          for (const topic of topics) {
            if (!/^[a-zA-Z0-9_-]+$/.test(topic.trim())) {
              return { isValid: false, error: 'Invalid topic format. Use alphanumeric characters, hyphens, and underscores only' };
            }
          }
          return { isValid: true };
        })},
        { field: 'limit', validate: ValidationRules.numberRange(1, 1000) },
        { field: 'offset', validate: ValidationRules.numberRange(0) }
      ]
    };
  }
}

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
        { field: 'difficulty', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validDifficulties = ['easy', 'medium', 'hard'];
          if (!validDifficulties.includes(value)) {
            return { isValid: false, error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'type', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validTypes = ['multiple_choice', 'multiple_answer', 'drag_drop', 'hotspot'];
          if (!validTypes.includes(value)) {
            return { isValid: false, error: `Invalid type. Valid options: ${validTypes.join(', ')}` };
          }
          return { isValid: true };
        })}
      ]
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
        { field: 'difficulty', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validDifficulties = ['easy', 'medium', 'hard'];
          if (!validDifficulties.includes(value)) {
            return { isValid: false, error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'type', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validTypes = ['multiple_choice', 'multiple_answer', 'drag_drop', 'hotspot'];
          if (!validTypes.includes(value)) {
            return { isValid: false, error: `Invalid type. Valid options: ${validTypes.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'sortBy', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validSortOptions = ['relevance', 'difficulty', 'date', 'popularity'];
          if (!validSortOptions.includes(value)) {
            return { isValid: false, error: `Invalid sortBy option. Valid options: ${validSortOptions.join(', ')}` };
          }
          return { isValid: true };
        })},
        { field: 'tags', validate: ValidationRules.array() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) }
      ]
    };
  }

  /**
   * Schema for question ID validation
   */
  static questionId(): ValidationSchema {
    return {
      required: ['questionId'],
      rules: [
        { field: 'questionId', validate: ValidationRules.custom((value: string) => {
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return { isValid: false, error: 'Question ID is required' };
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            return { isValid: false, error: 'Invalid question ID format. Use alphanumeric characters, hyphens, and underscores only' };
          }
          return { isValid: true };
        })}
      ]
    };
  }

  /**
   * Schema for search query validation
   */
  static searchQueryRequest(): ValidationSchema {
    return {
      required: ['query'],
      rules: [
        { field: 'query', validate: ValidationRules.custom((value: string) => {
          if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return { isValid: false, error: 'Query is required and must be a non-empty string' };
          }
          if (value.length > 200) {
            return { isValid: false, error: 'Query too long. Maximum 200 characters' };
          }
          return { isValid: true };
        })}
      ]
    };
  }
}

/**
 * Authentication validation schemas
 */
export class AuthValidationSchemas {
  
  /**
   * Schema for user registration request
   */
  static registerRequest(): ValidationSchema {
    return {
      required: ['email', 'password', 'firstName', 'lastName'],
      rules: [
        { field: 'email', validate: ValidationRules.email() },
        { field: 'password', validate: ValidationRules.stringLength(8, 128) },
        { field: 'firstName', validate: ValidationRules.stringLength(1, 50) },
        { field: 'lastName', validate: ValidationRules.stringLength(1, 50) },
        { field: 'password', validate: ValidationRules.custom((value: string) => {
          // Enhanced password validation
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumbers = /\d/.test(value);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
          
          if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return { 
              isValid: false, 
              error: 'Password must contain uppercase, lowercase, number, and special character' 
            };
          }
          return { isValid: true };
        })}
      ]
    };
  }

  /**
   * Schema for user login request
   */
  static loginRequest(): ValidationSchema {
    return {
      required: ['email', 'password'],
      rules: [
        { field: 'email', validate: ValidationRules.email() },
        { field: 'password', validate: ValidationRules.stringLength(1, 128) }
      ]
    };
  }

  /**
   * Schema for refresh token request
   */
  static refreshTokenRequest(): ValidationSchema {
    return {
      required: ['refreshToken'],
      rules: [
        { field: 'refreshToken', validate: ValidationRules.stringLength(1) }
      ]
    };
  }
}

/**
 * Provider validation schemas
 */
export class ProviderValidationSchemas {
  
  /**
   * Schema for provider ID validation
   */
  static providerId(): ValidationSchema {
    return {
      required: ['providerId'],
      rules: [
        { field: 'providerId', validate: ValidationRules.custom((value: string) => {
          const validProviders = ['aws', 'azure', 'gcp', 'comptia', 'cisco'];
          if (!validProviders.includes(value.toLowerCase())) {
            return { 
              isValid: false, 
              error: `Invalid provider. Valid options: ${validProviders.join(', ')}` 
            };
          }
          return { isValid: true };
        })}
      ]
    };
  }

  /**
   * Schema for provider query parameters
   */
  static providerQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'includeExams', validate: ValidationRules.boolean() },
        { field: 'includeStats', validate: ValidationRules.boolean() },
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) }
      ]
    };
  }
}

/**
 * Exam validation schemas
 */
export class ExamValidationSchemas {
  
  /**
   * Schema for exam ID validation
   */
  static examId(): ValidationSchema {
    return {
      required: ['examId'],
      rules: [
        { field: 'examId', validate: ValidationRules.alphanumericId() }
      ]
    };
  }

  /**
   * Schema for exam query parameters
   */
  static examQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'providerId', validate: ValidationRules.alphanumericId() },
        { field: 'includeTopics', validate: ValidationRules.boolean() },
        { field: 'includeQuestionCount', validate: ValidationRules.boolean() },
        { field: 'difficulty', validate: ValidationRules.custom((value: string) => {
          if (!value) return { isValid: true };
          const validDifficulties = ['beginner', 'intermediate', 'advanced'];
          if (!validDifficulties.includes(value)) {
            return { 
              isValid: false, 
              error: `Invalid difficulty. Valid options: ${validDifficulties.join(', ')}` 
            };
          }
          return { isValid: true };
        })},
        { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
        { field: 'offset', validate: ValidationRules.numberRange(0) }
      ]
    };
  }
}

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
      rules: [
        { field: 'topicId', validate: ValidationRules.alphanumericId() }
      ]
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
        { field: 'offset', validate: ValidationRules.numberRange(0) }
      ]
    };
  }
}

/**
 * Health check validation schemas
 */
export class HealthValidationSchemas {
  
  /**
   * Schema for detailed health check query parameters
   */
  static healthQuery(): ValidationSchema {
    return {
      required: [],
      rules: [
        { field: 'includeDatabase', validate: ValidationRules.boolean() },
        { field: 'includeStorage', validate: ValidationRules.boolean() },
        { field: 'includeCache', validate: ValidationRules.boolean() },
        { field: 'includeExternal', validate: ValidationRules.boolean() },
        { field: 'timeout', validate: ValidationRules.numberRange(1000, 30000) }
      ]
    };
  }
}
