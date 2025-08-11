// Question service for Study App V3 Backend
// Phase 12: Question Listing Feature

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
import { IQuestionRepository } from '../repositories/question.repository';
import { createLogger } from '../shared/logger';

// Re-export the interface for ServiceFactory
export type { IQuestionService };

export class QuestionService implements IQuestionService {
  private logger = createLogger({ component: 'QuestionService' });

  constructor(private questionRepository: IQuestionRepository) {}

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
      // Get questions based on provider/exam filters using repository
      let allQuestions: Question[] = [];

      if (request.provider && request.exam) {
        // Load questions for specific provider/exam
        allQuestions = await this.questionRepository.findByExam(request.provider, request.exam);
      } else if (request.provider) {
        // Load questions for all exams in provider
        allQuestions = await this.questionRepository.findByProvider(request.provider);
      } else {
        // This is expensive - try to avoid loading all questions
        this.logger.warn('Loading all questions - consider adding provider/exam filters');
        // For now, we'll need to implement a findAll method or handle this differently
        throw new Error('Please specify a provider to filter questions');
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
      // Get question from repository
      const question = await this.questionRepository.findById(request.questionId);
      
      if (!question) {
        this.logger.warn('Question not found', { questionId: request.questionId });
        throw new Error(`Question not found: ${request.questionId}`);
      }

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
      // Use repository search if available, otherwise fall back to manual search
      let searchResults: Question[];
      
      if (request.provider && request.exam) {
        // Use repository search method for better performance
        searchResults = await this.questionRepository.searchQuestions(
          request.query, 
          request.provider, 
          request.exam
        );
      } else if (request.provider) {
        searchResults = await this.questionRepository.searchQuestions(
          request.query, 
          request.provider
        );
      } else {
        searchResults = await this.questionRepository.searchQuestions(request.query);
      }

      // Apply additional filtering that wasn't handled by repository search
      let filteredQuestions = this.applySearchFilters(searchResults, request);

      // Apply full-text search with relevance scoring on the filtered results
      const searchQuestionResults = this.performFullTextSearch(filteredQuestions, request.query, request.highlightMatches);

      // Apply sorting
      const sortedResults = this.applySorting(searchQuestionResults, request.sortBy || SearchSortOption.RELEVANCE);

      // Apply pagination
      const limit = request.limit || 20;
      const offset = request.offset || 0;
      const total = sortedResults.length;
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      // Generate available filter options from search results
      const filters = this.generateFilterOptions(searchResults);

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
   * Refresh question cache (admin operation)
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing question cache');

    try {
      this.questionRepository.clearCache();
      
      this.logger.info('Question cache refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh question cache', error as Error);
      throw error;
    }
  }
}