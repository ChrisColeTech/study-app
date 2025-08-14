// Question Analytics service for Study App V3 Backend
// Objective 36: QuestionService Optimization - Question performance analytics focused service

import {
  Question,
  SearchQuestionsRequest,
  SearchQuestionsResponse,
  SearchQuestionResult,
  SearchHighlights,
  SearchSortOption,
  QuestionType,
} from '../shared/types/question.types';
import { IQuestionRepository } from '../repositories/question.repository';
import { createLogger } from '../shared/logger';
import { IQuestionSelectionService } from './question-selection.service';

export interface IQuestionAnalyticsService {
  searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse>;
  performAdvancedSearch(
    searchResults: Question[],
    request: SearchQuestionsRequest,
    startTime: number
  ): Promise<SearchQuestionsResponse>;
  getQuestionPerformanceMetrics(questionId: string): Promise<any>;
  analyzeSearchPatterns(searchTerms: string[]): Promise<any>;
}

/**
 * QuestionAnalyticsService - Handles search analysis, relevance scoring, and question performance analytics
 * Split from QuestionService for SRP compliance (Objective 36)
 * Focused on question performance analytics and search algorithms
 */
export class QuestionAnalyticsService implements IQuestionAnalyticsService {
  private logger = createLogger({ component: 'QuestionAnalyticsService' });

  constructor(
    private questionRepository: IQuestionRepository,
    private questionSelectionService: IQuestionSelectionService
  ) {}

  /**
   * Search questions with full-text search and relevance scoring - main entry point
   */
  async searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse> {
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

    // Delegate search processing to advanced search method
    return await this.performAdvancedSearch(searchResults, request, startTime);
  }

  /**
   * Perform advanced search with full-text search and relevance scoring
   */
  async performAdvancedSearch(
    searchResults: Question[],
    request: SearchQuestionsRequest,
    startTime: number
  ): Promise<SearchQuestionsResponse> {
    // Apply additional filtering that wasn't handled by repository search
    let filteredQuestions = this.questionSelectionService.applySearchFilters(searchResults, request);

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
    const filters = this.questionSelectionService.generateFilterOptions(searchResults);

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
   * Get performance metrics for a specific question
   */
  async getQuestionPerformanceMetrics(questionId: string): Promise<any> {
    // TODO: Implement question performance analytics
    // This would include metrics like:
    // - Average response time
    // - Correct answer rate
    // - Difficulty perception vs actual performance
    // - Common wrong answers
    // - User engagement metrics
    
    this.logger.info('Getting question performance metrics', { questionId });
    
    return {
      questionId,
      averageResponseTime: 0,
      correctAnswerRate: 0,
      totalAttempts: 0,
      difficultyRating: 0,
      engagementScore: 0,
      commonWrongAnswers: [],
      performanceTrends: []
    };
  }

  /**
   * Analyze search patterns to improve search algorithms
   */
  async analyzeSearchPatterns(searchTerms: string[]): Promise<any> {
    // TODO: Implement search pattern analysis
    // This would include metrics like:
    // - Most common search terms
    // - Search success rates
    // - Query refinement patterns
    // - Zero-result queries
    
    this.logger.info('Analyzing search patterns', { searchTerms });
    
    return {
      searchTerms,
      frequency: 0,
      successRate: 0,
      averageResults: 0,
      refinementPatterns: [],
      relatedTerms: []
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