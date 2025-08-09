import { Question, RawQuestionData, QuestionFilter, PaginationOptions, QuestionSearchResult } from '../types';
import { S3Service } from './s3-service';
import { MultiLayerCache } from './cache-service';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Question Service - Manages study questions with S3 backend
 * Provides filtering, search, and pagination capabilities with multi-layer caching
 */
export class QuestionService {
  private s3Service: S3Service;
  private cache: MultiLayerCache;
  private logger: Logger;

  constructor() {
    this.s3Service = new S3Service();
    this.cache = new MultiLayerCache();
    this.logger = new Logger('QuestionService');
  }

  /**
   * Get questions with filtering, search, and pagination
   */
  async getQuestions(
    provider: string, 
    exam: string, 
    filter?: QuestionFilter,
    pagination?: PaginationOptions
  ): Promise<QuestionSearchResult> {
    const startTime = Date.now();
    const cacheKey = `${provider}-${exam}`;

    try {
      this.logger.info('Getting questions', { 
        provider, 
        exam, 
        filter, 
        pagination 
      });

      // Load all questions for the exam
      const allQuestions = await this.loadQuestionsFromCache(cacheKey, provider, exam);
      
      // Apply filters
      let filteredQuestions = this.applyFilters(allQuestions, filter);
      
      // Get filter metadata
      const filterMetadata = this.generateFilterMetadata(allQuestions);

      // Apply pagination
      const paginationOptions = pagination || { limit: 50, offset: 0 };
      const totalCount = filteredQuestions.length;
      const paginatedQuestions = filteredQuestions.slice(
        paginationOptions.offset,
        paginationOptions.offset + paginationOptions.limit
      );

      const result: QuestionSearchResult = {
        questions: paginatedQuestions,
        totalCount,
        hasMore: paginationOptions.offset + paginatedQuestions.length < totalCount,
        filters: filterMetadata
      };

      this.logger.perf('getQuestions', Date.now() - startTime, {
        provider,
        exam,
        totalQuestions: allQuestions.length,
        filteredCount: totalCount,
        returnedCount: paginatedQuestions.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get questions', {
        provider,
        exam,
        filter,
        pagination,
        error
      });
      throw error;
    }
  }

  /**
   * Get a specific question by ID
   */
  async getQuestion(
    provider: string, 
    exam: string, 
    questionId: string
  ): Promise<Question | null> {
    const startTime = Date.now();
    const cacheKey = `${provider}-${exam}`;

    try {
      const allQuestions = await this.loadQuestionsFromCache(cacheKey, provider, exam);
      const question = allQuestions.find(q => q.questionId === questionId);

      this.logger.perf('getQuestion', Date.now() - startTime, {
        provider,
        exam,
        questionId,
        found: !!question
      });

      return question || null;
    } catch (error) {
      this.logger.error('Failed to get specific question', {
        provider,
        exam,
        questionId,
        error
      });
      throw error;
    }
  }

  /**
   * Get random questions for practice
   */
  async getRandomQuestions(
    provider: string,
    exam: string,
    count: number,
    filter?: QuestionFilter
  ): Promise<Question[]> {
    try {
      const cacheKey = `${provider}-${exam}`;
      const allQuestions = await this.loadQuestionsFromCache(cacheKey, provider, exam);
      
      // Apply filters
      let filteredQuestions = this.applyFilters(allQuestions, filter);
      
      // Shuffle and take random questions
      const shuffled = this.shuffleArray([...filteredQuestions]);
      return shuffled.slice(0, Math.min(count, shuffled.length));
    } catch (error) {
      this.logger.error('Failed to get random questions', {
        provider,
        exam,
        count,
        filter,
        error
      });
      throw error;
    }
  }

  /**
   * Get question statistics
   */
  async getQuestionStats(provider: string, exam: string): Promise<{
    totalQuestions: number;
    difficultyDistribution: { [key: string]: number };
    topicDistribution: { [key: string]: number };
    serviceDistribution: { [key: string]: number };
    hasExplanationCount: number;
  }> {
    try {
      const cacheKey = `${provider}-${exam}`;
      const allQuestions = await this.loadQuestionsFromCache(cacheKey, provider, exam);

      const stats = {
        totalQuestions: allQuestions.length,
        difficultyDistribution: {},
        topicDistribution: {},
        serviceDistribution: {},
        hasExplanationCount: 0
      } as any;

      allQuestions.forEach(question => {
        // Difficulty distribution
        const difficulty = question.difficulty || 'unknown';
        stats.difficultyDistribution[difficulty] = (stats.difficultyDistribution[difficulty] || 0) + 1;

        // Topic distribution
        question.topics.forEach(topic => {
          stats.topicDistribution[topic] = (stats.topicDistribution[topic] || 0) + 1;
        });

        // Service distribution
        if (question.awsServices) {
          question.awsServices.forEach(service => {
            stats.serviceDistribution[service] = (stats.serviceDistribution[service] || 0) + 1;
          });
        }

        // Explanation count
        if (question.hasExplanation) {
          stats.hasExplanationCount++;
        }
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get question stats', { provider, exam, error });
      throw error;
    }
  }

  /**
   * Clear cache for specific provider/exam or all
   */
  clearCache(provider?: string, exam?: string): void {
    // Only clear memory cache, DynamoDB cache will expire naturally
    this.cache.clearMemoryCache();
    this.logger.info('Cleared question cache', { provider, exam });
  }

  /**
   * Load questions from cache or S3
   */
  private async loadQuestionsFromCache(
    cacheKey: string, 
    provider: string, 
    exam: string
  ): Promise<Question[]> {
    // Check multi-layer cache first
    const cachedQuestions = await this.cache.get<Question[]>(cacheKey);
    if (cachedQuestions) {
      this.logger.debug('Returning cached questions', { cacheKey });
      return cachedQuestions;
    }

    this.logger.info('Loading questions from S3', { cacheKey, provider, exam });

    // Load from S3
    const questions = await this.loadQuestionsFromS3(provider, exam);
    
    // Update cache with 30 minute TTL
    await this.cache.put(cacheKey, questions, 30);

    return questions;
  }

  /**
   * Load questions from S3
   */
  private async loadQuestionsFromS3(provider: string, exam: string): Promise<Question[]> {
    try {
      // Try to load processed questions first
      let questions = await this.s3Service.getJsonObject<Question[]>(`questions/${provider}/${exam}/questions.json`);
      
      if (questions && questions.length > 0) {
        return questions;
      }

      // If processed questions don't exist, try to load raw data and convert
      const rawData = await this.s3Service.getJsonObject<{ study_data: RawQuestionData[] }>(`questions/${provider}/${exam}/raw-data.json`);
      
      if (rawData && rawData.study_data) {
        questions = rawData.study_data.map(raw => this.convertRawToQuestion(raw, provider, exam));
        
        // Save processed questions back to S3 for faster future loads
        await this.s3Service.putJsonObject(`questions/${provider}/${exam}/questions.json`, questions);
        
        return questions;
      }

      // Return empty array if no data found
      this.logger.warn('No questions found for exam', { provider, exam });
      return [];

    } catch (error) {
      this.logger.error('Failed to load questions from S3', { provider, exam, error });
      
      // Return empty array on error rather than throwing
      return [];
    }
  }

  /**
   * Convert raw question data to Question interface
   */
  private convertRawToQuestion(raw: RawQuestionData, provider: string, exam: string): Question {
    return {
      questionId: uuidv4(),
      questionNumber: raw.question_number,
      provider,
      exam,
      text: raw.question.text,
      options: raw.question.options,
      questionType: raw.question.question_type,
      expectedAnswers: raw.question.expected_answers,
      correctAnswer: raw.answer?.correct_answer || '',
      explanation: raw.answer?.explanation,
      difficulty: raw.study_metadata?.difficulty || 'medium',
      topics: raw.question.topic ? [raw.question.topic] : [],
      serviceCategory: raw.question.service_category,
      awsServices: raw.question.aws_services || [],
      keywords: raw.answer?.keywords || [],
      createdAt: new Date().toISOString(),
      parsingConfidence: raw.answer?.parsing_confidence,
      hasExplanation: raw.study_metadata?.has_explanation || false
    };
  }

  /**
   * Apply filters to questions
   */
  private applyFilters(questions: Question[], filter?: QuestionFilter): Question[] {
    if (!filter) {
      return questions;
    }

    let filtered = questions;

    if (filter.difficulty) {
      filtered = filtered.filter(q => q.difficulty === filter.difficulty);
    }

    if (filter.topics && filter.topics.length > 0) {
      filtered = filtered.filter(q => 
        filter.topics!.some(topic => q.topics.includes(topic))
      );
    }

    if (filter.serviceCategory) {
      filtered = filtered.filter(q => q.serviceCategory === filter.serviceCategory);
    }

    if (filter.awsServices && filter.awsServices.length > 0) {
      filtered = filtered.filter(q => 
        q.awsServices && filter.awsServices!.some(service => q.awsServices!.includes(service))
      );
    }

    if (filter.hasExplanation !== undefined) {
      filtered = filtered.filter(q => q.hasExplanation === filter.hasExplanation);
    }

    if (filter.questionType) {
      filtered = filtered.filter(q => q.questionType === filter.questionType);
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(q => 
        q.text.toLowerCase().includes(searchTerm) ||
        (q.explanation && q.explanation.toLowerCase().includes(searchTerm)) ||
        q.topics.some(topic => topic.toLowerCase().includes(searchTerm)) ||
        (q.keywords && q.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm)))
      );
    }

    return filtered;
  }

  /**
   * Generate filter metadata from all questions
   */
  private generateFilterMetadata(questions: Question[]): {
    availableTopics: string[];
    availableServiceCategories: string[];
    availableAwsServices: string[];
    difficultyDistribution: { [key: string]: number };
  } {
    const topics = new Set<string>();
    const serviceCategories = new Set<string>();
    const awsServices = new Set<string>();
    const difficultyDistribution: { [key: string]: number } = {};

    questions.forEach(question => {
      // Collect topics
      question.topics.forEach(topic => topics.add(topic));

      // Collect service categories
      if (question.serviceCategory) {
        serviceCategories.add(question.serviceCategory);
      }

      // Collect AWS services
      if (question.awsServices) {
        question.awsServices.forEach(service => awsServices.add(service));
      }

      // Count difficulty distribution
      const difficulty = question.difficulty || 'unknown';
      difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
    });

    return {
      availableTopics: Array.from(topics).sort(),
      availableServiceCategories: Array.from(serviceCategories).sort(),
      availableAwsServices: Array.from(awsServices).sort(),
      difficultyDistribution
    };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }
}