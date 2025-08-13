// Question service for Study App V3 Backend
// Phase 12: Question Listing Feature

import {
  Question,
  EnhancedQuestion,
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
  QuestionType,
} from '../shared/types/question.types';
import { IQuestionRepository } from '../repositories/question.repository';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

// Re-export the interface for ServiceFactory
export type { IQuestionService };

export class QuestionService extends BaseService implements IQuestionService {
  constructor(
    private questionRepository: IQuestionRepository,
    private questionSelector: QuestionSelector,
    private questionAnalyzer: QuestionAnalyzer
  ) {
    super();
  }

  /**
   * Get questions with comprehensive filtering
   */
  async getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(request, 'request');

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

        // Delegate filtering and processing to QuestionSelector
        const result = await this.questionSelector.selectQuestions(allQuestions, request);

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
   * Phase 13: Question Details Feature
   */
  async getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(request, 'request');
        this.validateRequired(request.questionId, 'questionId');

        // Get question from repository
        const question = await this.questionRepository.findById(request.questionId);
        const validatedQuestion = this.validateEntityExists(
          question,
          'Question',
          request.questionId
        );

        // Process question output using QuestionSelector
        const processedQuestion = this.questionSelector.processQuestionOutput(
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
   * Search questions with full-text search and relevance scoring
   * Phase 14: Question Search Feature
   */
  async searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(request, 'request');
        this.validateRequired(request.query, 'query');

        const startTime = Date.now();

        // Use repository search if available, otherwise fall back to manual search
        let searchResults: Question[];

        if (request.provider && request.exam) {
          // Use repository search method for better performance
          const result = await this.questionRepository.searchQuestions(
            request.query,
            undefined,
            request.provider,
            request.exam
          );
          searchResults = result.items;
        } else if (request.provider) {
          const result = await this.questionRepository.searchQuestions(
            request.query,
            undefined,
            request.provider
          );
          searchResults = result.items;
        } else {
          const result = await this.questionRepository.searchQuestions(request.query);
          searchResults = result.items;
        }

        // Delegate search processing to QuestionAnalyzer
        const result = await this.questionAnalyzer.performAdvancedSearch(
          searchResults,
          request,
          startTime
        );

        this.logSuccess('Questions searched successfully', {
          query: request.query,
          total: result.total,
          returned: result.questions.length,
          searchTime: result.searchTime,
          averageScore:
            result.questions.length > 0
              ? result.questions.reduce((sum, r) => sum + r.relevanceScore, 0) /
                result.questions.length
              : 0,
          provider: request.provider,
          exam: request.exam,
        });

        return result;
      },
      {
        operation: 'search questions',
        entityType: 'Question',
        requestData: {
          query: request.query,
          provider: request.provider,
          exam: request.exam,
          limit: request.limit,
        },
      }
    );
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

  /**
   * Convert Question to EnhancedQuestion with default metadata and type
   */
  private toEnhancedQuestion(question: Question): EnhancedQuestion {
    return {
      ...question,
      type: QuestionType.MULTIPLE_CHOICE, // Default type
      metadata: {
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        version: question.version || 1,
        reviewStatus: 'APPROVED' as any, // Default to approved
        language: 'en',
        estimatedTime: 60,
        skillLevel: 'intermediate',
        bloomsLevel: 'UNDERSTAND' as any, // Default blooms level
        cognitiveLoad: 'MEDIUM' as any // Default cognitive load
      }
    };
  }
}

/**
 * QuestionSelector - Handles question filtering, selection, and output processing
 * Split from QuestionService for SRP compliance
 */
export class QuestionSelector {
  private logger = createLogger({ component: 'QuestionSelector' });

  constructor() {}

  /**
   * Select and process questions with filtering and pagination
   */
  async selectQuestions(
    allQuestions: Question[],
    request: GetQuestionsRequest
  ): Promise<GetQuestionsResponse> {
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
        q.explanation = '';
      });
    }

    // Convert to EnhancedQuestions and strip metadata if not requested
    const enhancedQuestions = paginatedQuestions.map(q => this.createEnhancedQuestion(q));
    
    if (!request.includeMetadata) {
      enhancedQuestions.forEach(q => {
        q.metadata = {} as any;
      });
    }

    return {
      questions: enhancedQuestions,
      total,
      filters,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Process question output based on request flags
   */
  processQuestionOutput(question: Question, request: GetQuestionRequest): EnhancedQuestion {
    const enhancedQuestion = this.createEnhancedQuestion(question);

    // Strip explanation if not requested (default true for details endpoint)
    if (request.includeExplanation === false) {
      enhancedQuestion.explanation = '';
    }

    // Strip metadata if not requested (default true for details endpoint)
    if (request.includeMetadata === false) {
      enhancedQuestion.metadata = {} as any;
    }

    return enhancedQuestion;
  }

  /**
   * Apply filters specific to search (excluding full-text search)
   */
  applySearchFilters(questions: Question[], request: SearchQuestionsRequest): Question[] {
    let filtered = questions;

    // Filter by topic
    if (request.topic) {
      filtered = filtered.filter(q => q.topicId === request.topic);
    }

    // Filter by difficulty
    if (request.difficulty) {
      filtered = filtered.filter(q => q.difficulty === request.difficulty);
    }

    // Filter by type (base Questions don't have type, so assume default)
    if (request.type) {
      filtered = filtered.filter(q => (q as any).type === request.type || request.type === QuestionType.MULTIPLE_CHOICE);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => q.tags && request.tags!.some(tag => q.tags!.includes(tag)));
    }

    return filtered;
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

    // Filter by type (base Questions don't have type, so assume default)
    if (request.type) {
      filtered = filtered.filter(q => (q as any).type === request.type || request.type === QuestionType.MULTIPLE_CHOICE);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => q.tags && request.tags!.some(tag => q.tags!.includes(tag)));
    }

    // Apply search filter
    if (request.search) {
      const searchLower = request.search.toLowerCase();
      filtered = filtered.filter(
        q =>
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
  generateFilterOptions(questions: Question[]): {
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
    const types = [...new Set(questions.map(q => (q as any).type || QuestionType.MULTIPLE_CHOICE))];
    const tags = [...new Set(questions.flatMap(q => q.tags || []))];

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      topics: topics.sort(),
      difficulties,
      types,
      tags: tags.sort(),
    };
  }

  /**
   * Convert Question to EnhancedQuestion with default metadata and type
   */
  private createEnhancedQuestion(question: Question): EnhancedQuestion {
    return {
      ...question,
      type: QuestionType.MULTIPLE_CHOICE, // Default type
      metadata: {
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        version: question.version || 1,
        reviewStatus: 'APPROVED' as any, // Default to approved
        language: 'en',
        estimatedTime: 60,
        skillLevel: 'intermediate',
        bloomsLevel: 'UNDERSTAND' as any, // Default blooms level
        cognitiveLoad: 'MEDIUM' as any // Default cognitive load
      }
    };
  }
}

/**
 * QuestionAnalyzer - Handles search analysis, relevance scoring, and text processing
 * Split from QuestionService for SRP compliance
 */
export class QuestionAnalyzer {
  private logger = createLogger({ component: 'QuestionAnalyzer' });

  constructor(private questionSelector: QuestionSelector) {}

  /**
   * Perform advanced search with full-text search and relevance scoring
   */
  async performAdvancedSearch(
    searchResults: Question[],
    request: SearchQuestionsRequest,
    startTime: number
  ): Promise<SearchQuestionsResponse> {
    // Apply additional filtering that wasn't handled by repository search
    let filteredQuestions = this.questionSelector.applySearchFilters(searchResults, request);

    // Apply full-text search with relevance scoring on the filtered results
    const searchQuestionResults = this.performFullTextSearch(
      filteredQuestions,
      request.query,
      request.highlightMatches
    );

    // Apply sorting
    const sortedResults = this.applySorting(
      searchQuestionResults,
      request.sortBy || SearchSortOption.RELEVANCE
    );

    // Apply pagination
    const limit = request.limit || 20;
    const offset = request.offset || 0;
    const total = sortedResults.length;
    const paginatedResults = sortedResults.slice(offset, offset + limit);

    // Generate available filter options from search results
    const filters = this.questionSelector.generateFilterOptions(searchResults);

    // Strip explanations if not requested
    if (!request.includeExplanations) {
      paginatedResults.forEach(result => {
        result.explanation = '';
        if (result.highlights) {
          delete result.highlights.explanation;
        }
      });
    }

    // Strip metadata if not requested
    if (!request.includeMetadata) {
      paginatedResults.forEach(result => {
        result.metadata = {} as any;
      });
    }

    const searchTime = Date.now() - startTime;

    return {
      questions: paginatedResults,
      total,
      query: request.query,
      searchTime,
      filters,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Perform full-text search with relevance scoring
   */
  private performFullTextSearch(
    questions: Question[],
    query: string,
    highlightMatches: boolean = false
  ): SearchQuestionResult[] {
    const searchTerms = this.tokenizeQuery(query);
    const results: SearchQuestionResult[] = [];

    for (const question of questions) {
      const searchData = this.extractSearchableText(question);
      const { score, highlights } = this.calculateRelevanceScore(
        searchData,
        searchTerms,
        highlightMatches
      );

      if (score > 0) {
        const result: SearchQuestionResult = {
          ...question,
          type: QuestionType.MULTIPLE_CHOICE, // Default type
          metadata: {
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
            version: question.version || 1,
            reviewStatus: 'APPROVED' as any,
            language: 'en',
            estimatedTime: 60,
            skillLevel: 'intermediate',
            bloomsLevel: 'UNDERSTAND' as any,
            cognitiveLoad: 'MEDIUM' as any
          },
          relevanceScore: score,
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
   * Apply sorting to search results
   */
  private applySorting(
    results: SearchQuestionResult[],
    sortBy: SearchSortOption
  ): SearchQuestionResult[] {
    switch (sortBy) {
      case SearchSortOption.RELEVANCE:
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      case SearchSortOption.DIFFICULTY_ASC:
        return results.sort((a, b) => {
          const difficultyOrder: { [key: string]: number } = { easy: 0, medium: 1, hard: 2, beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
          return (difficultyOrder[String(a.difficulty).toLowerCase()] || 1) - (difficultyOrder[String(b.difficulty).toLowerCase()] || 1);
        });

      case SearchSortOption.DIFFICULTY_DESC:
        return results.sort((a, b) => {
          const difficultyOrder: { [key: string]: number } = { easy: 0, medium: 1, hard: 2, beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
          return (difficultyOrder[String(b.difficulty).toLowerCase()] || 1) - (difficultyOrder[String(a.difficulty).toLowerCase()] || 1);
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
   * Tokenize search query into individual terms
   */
  private tokenizeQuery(query: string): string[] {
    // Enhanced tokenization with support for phrases and technical terms
    const originalTerms = query
      .toLowerCase()
      .replace(/[^\w\s"'-]/g, ' ') // Keep quotes, hyphens, and apostrophes
      .split(/\s+/)
      .filter(term => term.length >= 2)
      .slice(0, 15); // Increased limit for better search coverage

    // Add phrase handling - preserve quoted phrases
    const phrases: string[] = [];
    const quotedPhrases = query.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      phrases.push(...quotedPhrases.map(phrase => phrase.replace(/"/g, '').toLowerCase()));
    }

    // Combine individual terms and phrases
    const allTerms = [...originalTerms, ...phrases];

    // Remove duplicates and very short terms
    return [...new Set(allTerms)].filter(term => term.length >= 2);
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
      tags: (question.tags || []).map(tag => tag.toLowerCase()),
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

    // Enhanced field weights for relevance scoring
    const weights = {
      questionText: 1.0, // Highest weight for question text
      options: 0.8, // High weight for options
      tags: 0.7, // High weight for tags (increased from 0.6)
      explanation: 0.5, // Medium weight for explanations (increased from 0.4)
    };

    // Position bonuses
    const positionBonus = {
      early: 1.2, // First 50 characters
      middle: 1.0, // Default
      late: 0.8, // Last 50 characters
    };

    // Track matches for each field
    const fieldMatches: { [key: string]: string[] } = {
      questionText: [],
      options: [],
      explanation: [],
      tags: [],
    };

    let termMatchCount = 0; // Track how many terms matched

    for (const term of searchTerms) {
      let termMatched = false;

      // Question text matches with position bonus
      const questionMatches = this.findEnhancedMatches(searchData.questionText, term);
      if (questionMatches.matches.length > 0) {
        const positionMultiplier =
          questionMatches.avgPosition < 50
            ? positionBonus.early
            : questionMatches.avgPosition > searchData.questionText.length - 50
              ? positionBonus.late
              : positionBonus.middle;

        totalScore += questionMatches.matches.length * weights.questionText * positionMultiplier;
        fieldMatches.questionText.push(...questionMatches.matches);
        termMatched = true;
      }

      // Option matches
      let optionMatchScore = 0;
      for (const option of searchData.options) {
        const optionMatches = this.findEnhancedMatches(option, term);
        if (optionMatches.matches.length > 0) {
          optionMatchScore += optionMatches.matches.length * weights.options;
          fieldMatches.options.push(...optionMatches.matches);
          termMatched = true;
        }
      }
      totalScore += optionMatchScore;

      // Enhanced tag matches with fuzzy matching
      for (const tag of searchData.tags) {
        if (tag === term) {
          totalScore += 2.5 * weights.tags; // Increased exact tag match bonus
          fieldMatches.tags.push(tag);
          termMatched = true;
        } else if (tag.includes(term)) {
          totalScore += weights.tags;
          fieldMatches.tags.push(tag);
          termMatched = true;
        } else if (this.fuzzyMatch(tag, term)) {
          totalScore += 0.5 * weights.tags; // Fuzzy match bonus
          fieldMatches.tags.push(tag);
          termMatched = true;
        }
      }

      // Explanation matches
      const explanationMatches = this.findEnhancedMatches(searchData.explanation, term);
      if (explanationMatches.matches.length > 0) {
        totalScore += explanationMatches.matches.length * weights.explanation;
        fieldMatches.explanation.push(...explanationMatches.matches);
        termMatched = true;
      }

      if (termMatched) {
        termMatchCount++;
      }
    }

    // Term coverage bonus - more terms matched = higher score
    const termCoverageBonus = termMatchCount / searchTerms.length;
    totalScore *= 0.5 + 0.5 * termCoverageBonus;

    // Normalize score to 0-1 range with improved scaling
    const maxPossibleScore =
      searchTerms.length *
      (weights.questionText + weights.options + weights.tags + weights.explanation) *
      2.5;
    let normalizedScore = Math.min(totalScore / maxPossibleScore, 1.0);

    // Apply minimum threshold - questions with very low scores are likely irrelevant
    if (normalizedScore < 0.1) {
      normalizedScore = 0;
    }

    // Generate highlights if requested
    if (generateHighlights && normalizedScore > 0) {
      if (fieldMatches.questionText.length > 0) {
        highlights.questionText = [...new Set(fieldMatches.questionText)].slice(0, 10);
      }
      if (fieldMatches.options.length > 0) {
        highlights.options = [...new Set(fieldMatches.options)].slice(0, 10);
      }
      if (fieldMatches.explanation.length > 0) {
        highlights.explanation = [...new Set(fieldMatches.explanation)].slice(0, 10);
      }
      if (fieldMatches.tags.length > 0) {
        highlights.tags = [...new Set(fieldMatches.tags)];
      }
    }

    return { score: normalizedScore, highlights };
  }

  /**
   * Find enhanced matches for a search term in text with position tracking
   */
  private findEnhancedMatches(
    text: string,
    term: string
  ): { matches: string[]; avgPosition: number } {
    const matches: string[] = [];
    const positions: number[] = [];

    // Try multiple matching strategies
    const strategies = [
      // Exact word boundary match
      new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi'),
      // Partial word match
      new RegExp(`\\b\\w*${this.escapeRegex(term)}\\w*\\b`, 'gi'),
      // Substring match for technical terms
      new RegExp(`${this.escapeRegex(term)}`, 'gi'),
    ];

    for (const regex of strategies) {
      let match;
      regex.lastIndex = 0; // Reset regex

      while ((match = regex.exec(text)) !== null && matches.length < 8) {
        const matchText = match[0];
        const position = match.index;

        // Avoid duplicate matches
        if (!matches.includes(matchText.toLowerCase())) {
          matches.push(matchText.toLowerCase());
          positions.push(position);
        }
      }
    }

    const avgPosition =
      positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0;

    return { matches: matches.slice(0, 5), avgPosition };
  }

  /**
   * Find matches for a search term in text (legacy method for backward compatibility)
   */
  private findMatches(text: string, term: string): string[] {
    return this.findEnhancedMatches(text, term).matches;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Simple fuzzy matching for tags
   */
  private fuzzyMatch(text: string, term: string): boolean {
    if (text.length < term.length) return false;

    // Simple Levenshtein distance check
    const maxDistance = Math.floor(term.length / 3); // Allow 1 error per 3 characters
    return this.levenshteinDistance(text, term) <= maxDistance;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
