// Question CRUD service for Study App V3 Backend
// Objective 36: QuestionService Optimization - CRUD operations focused service

import {
  Question,
  GetQuestionsRequest,
  GetQuestionsResponse,
  GetQuestionRequest,
  GetQuestionResponse,
  IQuestionService,
} from '../shared/types/question.types';
import { IQuestionRepository } from '../repositories/question.repository';
import { BaseService } from '../shared/base-service';
import { IQuestionSelectionService } from './question-selection.service';
import { IQuestionValidationService } from './question-validation.service';

// Re-export the interface for ServiceFactory
export type { IQuestionService };

/**
 * QuestionCrudService - Handles basic CRUD operations for questions
 * Split from QuestionService for SRP compliance (Objective 36)
 */
export class QuestionCrudService extends BaseService implements IQuestionService {
  constructor(
    private questionRepository: IQuestionRepository,
    private questionSelectionService: IQuestionSelectionService,
    private questionValidationService: IQuestionValidationService
  ) {
    super();
  }

  /**
   * Get questions with comprehensive filtering - delegates to selection service
   */
  async getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse> {
    return this.executeWithErrorHandling(
      async () => {
        // Validate request using validation service
        this.questionValidationService.validateGetQuestionsRequest(request);

        // Get questions based on provider/exam filters using repository
        let allQuestions: Question[] = [];

        if (request.provider && request.exam) {
          // Load questions for specific provider/exam
          const result = await this.questionRepository.findByExam(request.provider, request.exam);
          allQuestions = result.items;
        } else if (request.provider) {
          // Load questions for all exams in provider
          const result = await this.questionRepository.findByProvider(request.provider);
          allQuestions = result.items;
        } else {
          // No provider specified - return empty array for now since we have no data loaded
          // This allows the endpoint to work correctly and return proper empty response
          this.logWarning('No provider/exam filters specified - returning empty results', {});
          allQuestions = [];
        }

        // Delegate filtering and processing to QuestionSelectionService
        const result = await this.questionSelectionService.selectQuestions(allQuestions, request);

        this.logSuccess('Questions retrieved successfully', {
          total: result.total,
          returned: result.questions.length,
          provider: request.provider,
          exam: request.exam,
          topic: request.topic,
          difficulty: request.difficulty,
          type: request.type,
        });

        return result;
      },
      {
        operation: 'get questions',
        entityType: 'Question',
        requestData: {
          provider: request.provider,
          exam: request.exam,
          limit: request.limit,
        },
      }
    );
  }

  /**
   * Get individual question by ID
   */
  async getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse> {
    return this.executeWithErrorHandling(
      async () => {
        // Validate request using validation service
        this.questionValidationService.validateGetQuestionRequest(request);

        // Get question from repository
        const question = await this.questionRepository.findById(request.questionId);
        const validatedQuestion = this.validateEntityExists(
          question,
          'Question',
          request.questionId
        );

        // Process question output using QuestionSelectionService
        const processedQuestion = await this.questionSelectionService.processQuestionOutput(
          validatedQuestion,
          request
        );

        this.logSuccess('Question retrieved successfully', {
          questionId: request.questionId,
          providerId: processedQuestion.providerId,
          examId: processedQuestion.examId,
          includeExplanation: request.includeExplanation,
          includeMetadata: request.includeMetadata,
        });

        return { question: processedQuestion };
      },
      {
        operation: 'get question',
        entityType: 'Question',
        entityId: request.questionId,
        requestData: {
          includeExplanation: request.includeExplanation,
          includeMetadata: request.includeMetadata,
        },
      }
    );
  }

  /**
   * Search questions - delegates to analytics service
   * This method is implemented here to satisfy the IQuestionService interface,
   * but the actual implementation should be accessed through the main QuestionService
   */
  async searchQuestions(request: any): Promise<any> {
    throw new Error('searchQuestions should be called through the main QuestionService which delegates to QuestionAnalyticsService');
  }

  /**
   * Refresh question cache (admin operation)
   */
  async refreshCache(): Promise<void> {
    return this.executeWithErrorHandling(
      async () => {
        this.questionRepository.clearCache?.();

        this.logSuccess('Question cache refreshed successfully', {});
      },
      {
        operation: 'refresh question cache',
        entityType: 'QuestionCache',
      }
    );
  }
}