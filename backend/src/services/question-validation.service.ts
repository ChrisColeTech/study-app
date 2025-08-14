// Question Validation service for Study App V3 Backend
// Objective 36: QuestionService Optimization - Question content validation focused service

import {
  Question,
  GetQuestionsRequest,
  GetQuestionRequest,
  SearchQuestionsRequest,
  QuestionDifficulty,
  QuestionType,
} from '../shared/types/question.types';
import { DifficultyLevel } from '../shared/types/domain.types';
import { createLogger } from '../shared/logger';

export interface IQuestionValidationService {
  validateGetQuestionsRequest(request: GetQuestionsRequest): void;
  validateGetQuestionRequest(request: GetQuestionRequest): void;
  validateSearchQuestionsRequest(request: SearchQuestionsRequest): void;
  validateQuestion(question: Question): boolean;
  validateQuestionContent(question: Question): string[];
}

/**
 * QuestionValidationService - Handles question content validation and request validation
 * Split from QuestionService for SRP compliance (Objective 36)
 * Focused on question content validation and data consistency checks
 */
export class QuestionValidationService implements IQuestionValidationService {
  private logger = createLogger({ component: 'QuestionValidationService' });

  constructor() {}

  /**
   * Validate GetQuestionsRequest parameters
   */
  validateGetQuestionsRequest(request: GetQuestionsRequest): void {
    if (!request) {
      throw new Error('Request is required');
    }

    // Validate limit
    if (request.limit !== undefined && (request.limit < 1 || request.limit > 200)) {
      throw new Error('Limit must be between 1 and 200');
    }

    // Validate offset
    if (request.offset !== undefined && request.offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    // Validate difficulty
    if (request.difficulty && !this.isValidDifficulty(request.difficulty)) {
      throw new Error(`Invalid difficulty: ${request.difficulty}`);
    }

    // Validate type
    if (request.type && !this.isValidQuestionType(request.type)) {
      throw new Error(`Invalid question type: ${request.type}`);
    }

    // Validate provider/exam consistency
    if (request.exam && !request.provider) {
      throw new Error('Provider is required when exam is specified');
    }
  }

  /**
   * Validate GetQuestionRequest parameters
   */
  validateGetQuestionRequest(request: GetQuestionRequest): void {
    if (!request) {
      throw new Error('Request is required');
    }

    if (!request.questionId) {
      throw new Error('Question ID is required');
    }

    if (typeof request.questionId !== 'string' || request.questionId.trim().length === 0) {
      throw new Error('Question ID must be a non-empty string');
    }
  }

  /**
   * Validate SearchQuestionsRequest parameters
   */
  validateSearchQuestionsRequest(request: SearchQuestionsRequest): void {
    if (!request) {
      throw new Error('Request is required');
    }

    if (!request.query) {
      throw new Error('Search query is required');
    }

    if (typeof request.query !== 'string' || request.query.trim().length === 0) {
      throw new Error('Search query must be a non-empty string');
    }

    if (request.query.length > 500) {
      throw new Error('Search query cannot exceed 500 characters');
    }

    // Validate limit
    if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
      throw new Error('Search limit must be between 1 and 100');
    }

    // Validate offset
    if (request.offset !== undefined && request.offset < 0) {
      throw new Error('Offset must be non-negative');
    }

    // Validate difficulty
    if (request.difficulty && !this.isValidDifficulty(request.difficulty)) {
      throw new Error(`Invalid difficulty: ${request.difficulty}`);
    }

    // Validate type
    if (request.type && !this.isValidQuestionType(request.type)) {
      throw new Error(`Invalid question type: ${request.type}`);
    }

    // Validate provider/exam consistency
    if (request.exam && !request.provider) {
      throw new Error('Provider is required when exam is specified');
    }
  }

  /**
   * Validate a question object for completeness and correctness
   */
  validateQuestion(question: Question): boolean {
    if (!question) {
      this.logger.warn('Question validation failed: question is null or undefined');
      return false;
    }

    const errors = this.validateQuestionContent(question);
    
    if (errors.length > 0) {
      this.logger.warn('Question validation failed', { questionId: question.questionId, errors });
      return false;
    }

    return true;
  }

  /**
   * Validate question content and return list of validation errors
   */
  validateQuestionContent(question: Question): string[] {
    const errors: string[] = [];

    // Required fields validation
    if (!question.questionId || typeof question.questionId !== 'string') {
      errors.push('Question ID is required and must be a string');
    }

    if (!question.questionText || typeof question.questionText !== 'string' || question.questionText.trim().length === 0) {
      errors.push('Question text is required and must be a non-empty string');
    }

    if (!question.options || !Array.isArray(question.options)) {
      errors.push('Question options are required and must be an array');
    } else {
      // Validate options array
      if (question.options.length < 2) {
        errors.push('Question must have at least 2 options');
      }

      if (question.options.length > 10) {
        errors.push('Question cannot have more than 10 options');
      }

      // Validate each option
      question.options.forEach((option, index) => {
        if (!option || typeof option !== 'string' || option.trim().length === 0) {
          errors.push(`Option ${index + 1} must be a non-empty string`);
        }
      });
    }

    if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
      errors.push('Correct answer is required and must be a string');
    } else if (question.options && !question.options.includes(question.correctAnswer)) {
      errors.push('Correct answer must be one of the provided options');
    }

    if (!question.providerId || typeof question.providerId !== 'string') {
      errors.push('Provider ID is required and must be a string');
    }

    if (!question.examId || typeof question.examId !== 'string') {
      errors.push('Exam ID is required and must be a string');
    }

    // Optional but validated if present
    if (question.difficulty && !this.isValidDifficulty(question.difficulty)) {
      errors.push(`Invalid difficulty level: ${question.difficulty}`);
    }

    if (question.topicId && (typeof question.topicId !== 'string' || question.topicId.trim().length === 0)) {
      errors.push('Topic ID must be a non-empty string if provided');
    }

    if (question.explanation && (typeof question.explanation !== 'string' || question.explanation.trim().length === 0)) {
      errors.push('Explanation must be a non-empty string if provided');
    }

    if (question.tags) {
      if (!Array.isArray(question.tags)) {
        errors.push('Tags must be an array if provided');
      } else {
        question.tags.forEach((tag, index) => {
          if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
            errors.push(`Tag ${index + 1} must be a non-empty string`);
          }
        });
      }
    }

    // Content length validation
    if (question.questionText && question.questionText.length > 2000) {
      errors.push('Question text cannot exceed 2000 characters');
    }

    if (question.explanation && question.explanation.length > 5000) {
      errors.push('Explanation cannot exceed 5000 characters');
    }

    // Option validation
    if (question.options) {
      question.options.forEach((option, index) => {
        if (option && option.length > 500) {
          errors.push(`Option ${index + 1} cannot exceed 500 characters`);
        }
      });
    }

    return errors;
  }

  /**
   * Check if difficulty level is valid
   */
  private isValidDifficulty(difficulty: any): difficulty is DifficultyLevel {
    const validDifficulties: DifficultyLevel[] = [
      DifficultyLevel.EASY, 
      DifficultyLevel.MEDIUM, 
      DifficultyLevel.HARD,
      DifficultyLevel.BEGINNER,
      DifficultyLevel.INTERMEDIATE,
      DifficultyLevel.ADVANCED,
      DifficultyLevel.EXPERT
    ];
    return validDifficulties.includes(difficulty);
  }

  /**
   * Check if question type is valid
   */
  private isValidQuestionType(type: any): type is QuestionType {
    const validTypes = Object.values(QuestionType);
    return validTypes.includes(type);
  }
}