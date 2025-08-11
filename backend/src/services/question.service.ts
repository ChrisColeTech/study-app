// Question service for Study App V3 Backend
// Phase 12: Question Listing Feature

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Question, 
  GetQuestionsRequest, 
  GetQuestionsResponse,
  GetQuestionRequest,
  GetQuestionResponse,
  SearchQuestionsRequest,
  SearchQuestionsResponse,
  SearchQuestionResult,
  SearchHighlights,
  SearchSortOption,
  IQuestionService,
  QuestionDifficulty,
  QuestionType
} from '../shared/types/question.types';

// Re-export the interface for ServiceFactory
export type { IQuestionService };
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class QuestionService implements IQuestionService {
  private logger = createLogger({ component: 'QuestionService' });
  private s3Client: S3Client;
  private bucketName: string;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly QUESTIONS_PREFIX = 'questions/';

  constructor(s3Client: S3Client, bucketName: string) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  /**
   * Get questions with comprehensive filtering
   */
  async getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse> {
    this.logger.info('Getting questions', { 
      provider: request.provider,
      exam: request.exam,
      topic: request.topic,
      difficulty: request.difficulty,
      type: request.type,
      search: request.search,
      limit: request.limit,
      offset: request.offset
    });

    try {
      // Get questions based on provider/exam filters
      let allQuestions: Question[] = [];

      if (request.provider && request.exam) {
        // Load questions for specific provider/exam
        allQuestions = await this.getQuestionsForProviderExam(request.provider, request.exam);
      } else if (request.provider) {
        // Load questions for all exams in provider
        allQuestions = await this.getQuestionsForProvider(request.provider);
      } else {
        // Load all questions from all providers/exams
        allQuestions = await this.getAllQuestions();
      }

      // Apply filters
      let filteredQuestions = this.applyFilters(allQuestions, request);

      // Apply pagination
      const limit = request.limit || 50;
      const offset = request.offset || 0;
      const total = filteredQuestions.length;
      const paginatedQuestions = filteredQuestions.slice(offset, offset + limit);

      // Generate available filter options from all questions
      const filters = this.generateFilterOptions(allQuestions);

      // Strip explanations if not requested
      if (!request.includeExplanations) {
        paginatedQuestions.forEach(q => {
          delete q.explanation;
        });
      }

      // Strip metadata if not requested
      if (!request.includeMetadata) {
        paginatedQuestions.forEach(q => {
          q.metadata = {};
        });
      }

      const response: GetQuestionsResponse = {
        questions: paginatedQuestions,
        total,
        filters,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

      this.logger.info('Questions retrieved successfully', { 
        total: response.total,
        returned: paginatedQuestions.length,
        filters: {
          provider: request.provider,
          exam: request.exam,
          topic: request.topic,
          difficulty: request.difficulty,
          type: request.type
        }
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get questions', error as Error);
      throw new Error('Failed to retrieve questions');
    }
  }

  /**
   * Get individual question by ID
   * Phase 13: Question Details Feature
   */
  async getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse> {
    this.logger.info('Getting question by ID', { 
      questionId: request.questionId,
      includeExplanation: request.includeExplanation,
      includeMetadata: request.includeMetadata
    });

    try {
      // Check individual question cache first
      const cacheKey = `question:${request.questionId}`;
      const cached = this.getFromCache<Question>(cacheKey);
      if (cached) {
        this.logger.debug('Question retrieved from cache', { questionId: request.questionId });
        
        const question = this.processQuestionOutput(cached, request);
        return { question };
      }

      // Search across all question files to find the question
      const question = await this.findQuestionById(request.questionId);
      
      if (!question) {
        this.logger.warn('Question not found', { questionId: request.questionId });
        throw new Error(`Question not found: ${request.questionId}`);
      }

      // Cache the individual question
      this.setCache(cacheKey, question);

      const processedQuestion = this.processQuestionOutput(question, request);
      
      this.logger.info('Question retrieved successfully', { 
        questionId: request.questionId,
        providerId: processedQuestion.providerId,
        examId: processedQuestion.examId
      });

      return { question: processedQuestion };

    } catch (error) {
      this.logger.error('Failed to get question', error as Error, { questionId: request.questionId });
      
      if ((error as Error).message.includes('not found')) {
        throw error; // Re-throw not found errors as-is
      }
      
      throw new Error(`Failed to retrieve question: ${request.questionId}`);
    }
  }

  /**
   * Search questions with full-text search and relevance scoring
   * Phase 14: Question Search Feature
   */
  async searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse> {
    this.logger.info('Searching questions', { 
      query: request.query,
      provider: request.provider,
      exam: request.exam,
      topic: request.topic,
      difficulty: request.difficulty,
      type: request.type,
      tags: request.tags,
      sortBy: request.sortBy,
      limit: request.limit,
      offset: request.offset
    });

    const startTime = Date.now();

    try {
      // Get base questions based on provider/exam filters (same as getQuestions)
      let allQuestions: Question[] = [];

      if (request.provider && request.exam) {
        allQuestions = await this.getQuestionsForProviderExam(request.provider, request.exam);
      } else if (request.provider) {
        allQuestions = await this.getQuestionsForProvider(request.provider);
      } else {
        allQuestions = await this.getAllQuestions();
      }

      // Apply basic filters first (topic, difficulty, type, tags)
      let filteredQuestions = this.applySearchFilters(allQuestions, request);

      // Apply full-text search with relevance scoring
      const searchResults = this.performFullTextSearch(filteredQuestions, request.query, request.highlightMatches);

      // Apply sorting
      const sortedResults = this.applySorting(searchResults, request.sortBy || SearchSortOption.RELEVANCE);

      // Apply pagination
      const limit = request.limit || 20;
      const offset = request.offset || 0;
      const total = sortedResults.length;
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      // Generate available filter options from original filtered questions (before search)
      const filters = this.generateFilterOptions(filteredQuestions);

      // Strip explanations if not requested
      if (!request.includeExplanations) {
        paginatedResults.forEach(result => {
          delete result.explanation;
          if (result.highlights) {
            delete result.highlights.explanation;
          }
        });
      }

      // Strip metadata if not requested
      if (!request.includeMetadata) {
        paginatedResults.forEach(result => {
          result.metadata = {};
        });
      }

      const searchTime = Date.now() - startTime;

      const response: SearchQuestionsResponse = {
        questions: paginatedResults,
        total,
        query: request.query,
        searchTime,
        filters,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

      this.logger.info('Questions searched successfully', { 
        query: request.query,
        total: response.total,
        returned: paginatedResults.length,
        searchTime: searchTime,
        averageScore: paginatedResults.length > 0 
          ? paginatedResults.reduce((sum, r) => sum + r.relevanceScore, 0) / paginatedResults.length 
          : 0
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to search questions', error as Error);
      throw new Error('Failed to search questions');
    }
  }

  /**
   * Apply filters specific to search (excluding full-text search)
   */
  private applySearchFilters(questions: Question[], request: SearchQuestionsRequest): Question[] {
    let filtered = questions;

    // Filter by topic
    if (request.topic) {
      filtered = filtered.filter(q => q.topicId === request.topic);
    }

    // Filter by difficulty
    if (request.difficulty) {
      filtered = filtered.filter(q => q.difficulty === request.difficulty);
    }

    // Filter by type
    if (request.type) {
      filtered = filtered.filter(q => q.type === request.type);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => 
        q.tags && request.tags!.some(tag => q.tags!.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * Perform full-text search with relevance scoring
   */
  private performFullTextSearch(questions: Question[], query: string, highlightMatches: boolean = false): SearchQuestionResult[] {
    const searchTerms = this.tokenizeQuery(query);
    const results: SearchQuestionResult[] = [];

    for (const question of questions) {
      const searchData = this.extractSearchableText(question);
      const { score, highlights } = this.calculateRelevanceScore(searchData, searchTerms, highlightMatches);
      
      if (score > 0) {
        const result: SearchQuestionResult = {
          ...question,
          relevanceScore: score
        };
        
        if (highlightMatches && highlights) {
          result.highlights = highlights;
        }
        
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Tokenize search query into individual terms
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
      .split(/\s+/)
      .filter(term => term.length >= 2) // Minimum 2 characters
      .slice(0, 10); // Limit to 10 terms for performance
  }

  /**
   * Extract searchable text from a question
   */
  private extractSearchableText(question: Question): {
    questionText: string;
    options: string[];
    explanation: string;
    tags: string[];
  } {
    return {
      questionText: question.questionText.toLowerCase(),
      options: question.options.map(opt => opt.toLowerCase()),
      explanation: (question.explanation || '').toLowerCase(),
      tags: (question.tags || []).map(tag => tag.toLowerCase())
    };
  }

  /**
   * Calculate relevance score and generate highlights
   */
  private calculateRelevanceScore(
    searchData: { questionText: string; options: string[]; explanation: string; tags: string[] },
    searchTerms: string[],
    generateHighlights: boolean
  ): { score: number; highlights?: SearchHighlights } {
    let totalScore = 0;
    const highlights: SearchHighlights = {};

    // Field weights for relevance scoring
    const weights = {
      questionText: 1.0,    // Highest weight for question text
      options: 0.8,         // High weight for options
      tags: 0.6,           // Medium weight for tags
      explanation: 0.4      // Lower weight for explanations
    };

    // Track matches for each field
    const fieldMatches: { [key: string]: string[] } = {
      questionText: [],
      options: [],
      explanation: [],
      tags: []
    };

    for (const term of searchTerms) {
      // Question text matches
      const questionMatches = this.findMatches(searchData.questionText, term);
      if (questionMatches.length > 0) {
        totalScore += questionMatches.length * weights.questionText;
        fieldMatches.questionText.push(...questionMatches);
      }

      // Option matches
      for (const option of searchData.options) {
        const optionMatches = this.findMatches(option, term);
        if (optionMatches.length > 0) {
          totalScore += optionMatches.length * weights.options;
          fieldMatches.options.push(...optionMatches);
        }
      }

      // Tag matches (exact match gets bonus)
      for (const tag of searchData.tags) {
        if (tag === term) {
          totalScore += 2.0 * weights.tags; // Exact tag match bonus
          fieldMatches.tags.push(tag);
        } else if (tag.includes(term)) {
          totalScore += weights.tags;
          fieldMatches.tags.push(tag);
        }
      }

      // Explanation matches
      const explanationMatches = this.findMatches(searchData.explanation, term);
      if (explanationMatches.length > 0) {
        totalScore += explanationMatches.length * weights.explanation;
        fieldMatches.explanation.push(...explanationMatches);
      }
    }

    // Normalize score to 0-1 range
    const maxPossibleScore = searchTerms.length * 
      (weights.questionText + weights.options + weights.tags + weights.explanation) * 2;
    const normalizedScore = Math.min(totalScore / maxPossibleScore, 1.0);

    // Generate highlights if requested
    if (generateHighlights && normalizedScore > 0) {
      if (fieldMatches.questionText.length > 0) {
        highlights.questionText = [...new Set(fieldMatches.questionText)];
      }
      if (fieldMatches.options.length > 0) {
        highlights.options = [...new Set(fieldMatches.options)];
      }
      if (fieldMatches.explanation.length > 0) {
        highlights.explanation = [...new Set(fieldMatches.explanation)];
      }
      if (fieldMatches.tags.length > 0) {
        highlights.tags = [...new Set(fieldMatches.tags)];
      }
    }

    return { score: normalizedScore, highlights };
  }

  /**
   * Find matches for a search term in text
   */
  private findMatches(text: string, term: string): string[] {
    const matches: string[] = [];
    const regex = new RegExp(`\\b\\w*${term}\\w*\\b`, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null && matches.length < 5) {
      matches.push(match[0]);
    }

    return matches;
  }

  /**
   * Apply sorting to search results
   */
  private applySorting(results: SearchQuestionResult[], sortBy: SearchSortOption): SearchQuestionResult[] {
    switch (sortBy) {
      case SearchSortOption.RELEVANCE:
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      case SearchSortOption.DIFFICULTY_ASC:
        return results.sort((a, b) => {
          const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
          return (difficultyOrder[a.difficulty] || 1) - (difficultyOrder[b.difficulty] || 1);
        });
      
      case SearchSortOption.DIFFICULTY_DESC:
        return results.sort((a, b) => {
          const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
          return (difficultyOrder[b.difficulty] || 1) - (difficultyOrder[a.difficulty] || 1);
        });
      
      case SearchSortOption.CREATED_ASC:
        return results.sort((a, b) => {
          const aTime = new Date(a.createdAt || '1970-01-01').getTime();
          const bTime = new Date(b.createdAt || '1970-01-01').getTime();
          return aTime - bTime;
        });
      
      case SearchSortOption.CREATED_DESC:
        return results.sort((a, b) => {
          const aTime = new Date(a.createdAt || '1970-01-01').getTime();
          const bTime = new Date(b.createdAt || '1970-01-01').getTime();
          return bTime - aTime;
        });
      
      default:
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  /**
   * Find a specific question by ID across all S3 data
   */
  private async findQuestionById(questionId: string): Promise<Question | null> {
    this.logger.debug('Searching for question across all data', { questionId });

    try {
      // Try to get all questions from cache first (most efficient if cache is warm)
      const allQuestions = this.getFromCache<Question[]>('questions:all');
      if (allQuestions) {
        const question = allQuestions.find(q => q.questionId === questionId);
        if (question) {
          this.logger.debug('Question found in cached all questions', { questionId });
          return question;
        }
      }

      // If not in cache, search through provider/exam structure
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.QUESTIONS_PREFIX,
        Delimiter: '/'
      });

      const listResponse = await this.s3Client.send(listCommand);

      if (listResponse.CommonPrefixes) {
        // Search each provider
        for (const prefix of listResponse.CommonPrefixes) {
          if (prefix.Prefix) {
            const providerId = prefix.Prefix.replace(this.QUESTIONS_PREFIX, '').replace('/', '');
            
            const question = await this.findQuestionInProvider(questionId, providerId);
            if (question) {
              this.logger.debug('Question found in provider', { questionId, providerId });
              return question;
            }
          }
        }
      }

      this.logger.debug('Question not found in any provider', { questionId });
      return null;

    } catch (error) {
      this.logger.error('Error searching for question', error as Error, { questionId });
      throw error;
    }
  }

  /**
   * Search for question within a specific provider
   */
  private async findQuestionInProvider(questionId: string, providerId: string): Promise<Question | null> {
    try {
      // Check if provider questions are cached
      const providerQuestions = this.getFromCache<Question[]>(`questions:${providerId}:all`);
      if (providerQuestions) {
        const question = providerQuestions.find(q => q.questionId === questionId);
        if (question) {
          return question;
        }
      }

      // List exams in the provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${this.QUESTIONS_PREFIX}${providerId}/`,
        Delimiter: '/'
      });

      const listResponse = await this.s3Client.send(listCommand);

      if (listResponse.CommonPrefixes) {
        // Search each exam
        for (const prefix of listResponse.CommonPrefixes) {
          if (prefix.Prefix) {
            const examId = prefix.Prefix.replace(`${this.QUESTIONS_PREFIX}${providerId}/`, '').replace('/', '');
            
            const question = await this.findQuestionInProviderExam(questionId, providerId, examId);
            if (question) {
              return question;
            }
          }
        }
      }

      return null;

    } catch (error) {
      this.logger.debug('Error searching provider for question', { questionId, providerId, error: (error as Error).message });
      return null; // Continue searching other providers
    }
  }

  /**
   * Search for question within a specific provider/exam
   */
  private async findQuestionInProviderExam(questionId: string, providerId: string, examId: string): Promise<Question | null> {
    try {
      // Check if provider/exam questions are cached
      const examQuestions = this.getFromCache<Question[]>(`questions:${providerId}:${examId}`);
      if (examQuestions) {
        const question = examQuestions.find(q => q.questionId === questionId);
        if (question) {
          return question;
        }
      }

      // Load questions from S3 for this provider/exam
      const questions = await this.loadQuestionsFromS3(providerId, examId);
      const question = questions.find(q => q.questionId === questionId);
      
      return question || null;

    } catch (error) {
      this.logger.debug('Error searching provider/exam for question', { 
        questionId, 
        providerId, 
        examId, 
        error: (error as Error).message 
      });
      return null; // Continue searching
    }
  }

  /**
   * Process question output based on request flags
   */
  private processQuestionOutput(question: Question, request: GetQuestionRequest): Question {
    const processedQuestion = { ...question };

    // Strip explanation if not requested (default true for details endpoint)
    if (request.includeExplanation === false) {
      delete processedQuestion.explanation;
    }

    // Strip metadata if not requested (default true for details endpoint)  
    if (request.includeMetadata === false) {
      processedQuestion.metadata = {};
    }

    return processedQuestion;
  }

  /**
   * Apply filters to question list
   */
  private applyFilters(questions: Question[], request: GetQuestionsRequest): Question[] {
    let filtered = questions;

    // Filter by topic
    if (request.topic) {
      filtered = filtered.filter(q => q.topicId === request.topic);
    }

    // Filter by difficulty
    if (request.difficulty) {
      filtered = filtered.filter(q => q.difficulty === request.difficulty);
    }

    // Filter by type
    if (request.type) {
      filtered = filtered.filter(q => q.type === request.type);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => 
        q.tags && request.tags!.some(tag => q.tags!.includes(tag))
      );
    }

    // Apply search filter
    if (request.search) {
      const searchLower = request.search.toLowerCase();
      filtered = filtered.filter(q => 
        q.questionText.toLowerCase().includes(searchLower) ||
        q.options.some(option => option.toLowerCase().includes(searchLower)) ||
        (q.explanation && q.explanation.toLowerCase().includes(searchLower)) ||
        (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    return filtered;
  }

  /**
   * Generate available filter options from all questions
   */
  private generateFilterOptions(questions: Question[]): {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: QuestionDifficulty[];
    types: QuestionType[];
    tags: string[];
  } {
    const providers = [...new Set(questions.map(q => q.providerId))];
    const exams = [...new Set(questions.map(q => q.examId))];
    const topics = [...new Set(questions.map(q => q.topicId).filter(Boolean) as string[])];
    const difficulties = [...new Set(questions.map(q => q.difficulty))];
    const types = [...new Set(questions.map(q => q.type))];
    const tags = [...new Set(questions.flatMap(q => q.tags || []))];

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      topics: topics.sort(),
      difficulties,
      types,
      tags: tags.sort()
    };
  }

  /**
   * Get questions for specific provider/exam
   */
  private async getQuestionsForProviderExam(providerId: string, examId: string): Promise<Question[]> {
    const cacheKey = `questions:${providerId}:${examId}`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { providerId, examId });
      return cached;
    }

    // Load from S3
    const questions = await this.loadQuestionsFromS3(providerId, examId);

    // Cache the result
    this.setCache(cacheKey, questions);

    return questions;
  }

  /**
   * Get questions for all exams in a provider
   */
  private async getQuestionsForProvider(providerId: string): Promise<Question[]> {
    const cacheKey = `questions:${providerId}:all`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Provider questions retrieved from cache', { providerId });
      return cached;
    }

    try {
      // List all exam directories for this provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${this.QUESTIONS_PREFIX}${providerId}/`,
        Delimiter: '/'
      });

      const listResponse = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResponse.CommonPrefixes) {
        for (const prefix of listResponse.CommonPrefixes) {
          if (prefix.Prefix) {
            const examId = prefix.Prefix.replace(`${this.QUESTIONS_PREFIX}${providerId}/`, '').replace('/', '');
            try {
              const questions = await this.loadQuestionsFromS3(providerId, examId);
              allQuestions.push(...questions);
            } catch (error) {
              this.logger.warn('Failed to load questions for exam', { 
                providerId, 
                examId, 
                error: (error as Error).message 
              });
            }
          }
        }
      }

      // Cache the result
      this.setCache(cacheKey, allQuestions);

      return allQuestions;

    } catch (error) {
      this.logger.error('Failed to load provider questions from S3', error as Error, { providerId });
      throw new Error(`Failed to load questions for provider ${providerId}`);
    }
  }

  /**
   * Get all questions from all providers/exams
   */
  private async getAllQuestions(): Promise<Question[]> {
    const cacheKey = 'questions:all';
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('All questions retrieved from cache');
      return cached;
    }

    try {
      // List all provider directories
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.QUESTIONS_PREFIX,
        Delimiter: '/'
      });

      const listResponse = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResponse.CommonPrefixes) {
        for (const prefix of listResponse.CommonPrefixes) {
          if (prefix.Prefix) {
            const providerId = prefix.Prefix.replace(this.QUESTIONS_PREFIX, '').replace('/', '');
            try {
              const providerQuestions = await this.getQuestionsForProvider(providerId);
              allQuestions.push(...providerQuestions);
            } catch (error) {
              this.logger.warn('Failed to load questions for provider', { 
                providerId, 
                error: (error as Error).message 
              });
            }
          }
        }
      }

      // Cache the result
      this.setCache(cacheKey, allQuestions);

      return allQuestions;

    } catch (error) {
      this.logger.error('Failed to load all questions from S3', error as Error);
      throw new Error('Failed to load questions from storage');
    }
  }

  /**
   * Load questions from S3 for specific provider/exam
   */
  private async loadQuestionsFromS3(providerId: string, examId: string): Promise<Question[]> {
    this.logger.debug('Loading questions from S3', { providerId, examId });

    try {
      const key = `${this.QUESTIONS_PREFIX}${providerId}/${examId}/questions.json`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        this.logger.warn('Question file has no content', { key });
        return [];
      }

      const content = await response.Body.transformToString();
      const questions: Question[] = JSON.parse(content);

      // Validate and enrich questions
      const validQuestions = questions.filter(q => {
        if (!q.questionId || !q.providerId || !q.examId || !q.questionText || !q.options) {
          this.logger.warn('Invalid question data', { 
            questionId: q.questionId,
            key,
            missingFields: {
              questionId: !q.questionId,
              providerId: !q.providerId,
              examId: !q.examId,
              questionText: !q.questionText,
              options: !q.options
            }
          });
          return false;
        }
        return true;
      }).map(q => ({
        ...q,
        // Ensure provider and exam IDs match the file path
        providerId,
        examId,
        // Set defaults for missing optional fields
        type: q.type || QuestionType.MULTIPLE_CHOICE,
        difficulty: q.difficulty || QuestionDifficulty.INTERMEDIATE,
        metadata: q.metadata || {}
      }));

      this.logger.debug('Questions loaded successfully', { 
        providerId,
        examId,
        totalQuestions: questions.length,
        validQuestions: validQuestions.length
      });

      return validQuestions;

    } catch (error) {
      this.logger.error('Failed to load questions from S3', error as Error, { providerId, examId });
      
      if ((error as any).name === 'NoSuchKey') {
        this.logger.warn('Question file not found', { providerId, examId });
        return [];
      }
      
      throw error;
    }
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  public getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}