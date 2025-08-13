// Question domain filtering logic
// Handles filtering for questions, search, difficulty levels, and provider-specific content

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { 
  EnhancedQuestion,
  GetQuestionsRequest,
  SearchQuestionsRequest,
  SearchQuestionResult,
  SearchHighlights,
  QuestionType,
  ReviewStatus,
  BloomsLevel,
  CognitiveLoad,
  SearchSortOption
} from '../shared/types/question.types';
import { DifficultyLevel } from '../shared/types/domain.types';

export interface QuestionFilterRequest extends BaseFilterRequest {
  provider?: string;
  exam?: string;
  topic?: string;
  difficulty?: DifficultyLevel;
  type?: QuestionType;
  reviewStatus?: ReviewStatus;
  bloomsLevel?: BloomsLevel;
  cognitiveLoad?: CognitiveLoad;
  tags?: string[];
  includeExplanations?: boolean;
  includeMetadata?: boolean;
  estimatedTimeMin?: number;
  estimatedTimeMax?: number;
}

export interface QuestionSearchRequest extends QuestionFilterRequest {
  query: string;
  highlightMatches?: boolean;
  sortBy?: SearchSortOption;
}

/**
 * QuestionFilter - Dedicated filter for questions and advanced search functionality
 * 
 * Provides comprehensive filtering and search capabilities for questions including
 * full-text search, relevance scoring, difficulty filtering, and advanced search features.
 */
export class QuestionFilter extends BaseFilter {
  /**
   * Apply all filters to questions list based on request
   */
  static applyFilters(
    questions: EnhancedQuestion[], 
    request: QuestionFilterRequest
  ): FilterResult<EnhancedQuestion> {
    return this.withTiming(() => {
      let filtered = [...questions];

      // Filter by provider
      if (request.provider) {
        filtered = filtered.filter(q => 
          q.providerId.toLowerCase() === request.provider!.toLowerCase()
        );
      }

      // Filter by exam
      if (request.exam) {
        filtered = filtered.filter(q => 
          q.examId.toLowerCase() === request.exam!.toLowerCase()
        );
      }

      // Filter by topic
      if (request.topic) {
        filtered = filtered.filter(q => 
          q.topicId.toLowerCase() === request.topic!.toLowerCase()
        );
      }

      // Filter by difficulty
      if (request.difficulty) {
        filtered = this.filterByEnum(filtered, 'difficulty', request.difficulty);
      }

      // Filter by question type
      if (request.type) {
        filtered = this.filterByEnum(filtered, 'type', request.type);
      }

      // Filter by review status
      if (request.reviewStatus) {
        filtered = filtered.filter(q => q.metadata.reviewStatus === request.reviewStatus);
      }

      // Filter by Bloom's taxonomy level
      if (request.bloomsLevel) {
        filtered = filtered.filter(q => q.metadata.bloomsLevel === request.bloomsLevel);
      }

      // Filter by cognitive load
      if (request.cognitiveLoad) {
        filtered = filtered.filter(q => q.metadata.cognitiveLoad === request.cognitiveLoad);
      }

      // Filter by tags
      if (request.tags && request.tags.length > 0) {
        filtered = this.filterByTags(filtered, request.tags);
      }

      // Filter by estimated time range
      if (request.estimatedTimeMin || request.estimatedTimeMax) {
        filtered = this.filterByTimeRange(filtered, request.estimatedTimeMin, request.estimatedTimeMax);
      }

      // Filter by search term
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'questionText', 'explanation'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'createdAt';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortQuestions(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Advanced search with relevance scoring and highlighting
   */
  static searchQuestions(
    questions: EnhancedQuestion[],
    request: QuestionSearchRequest
  ): FilterResult<SearchQuestionResult> {
    return this.withTiming(() => {
      let filtered = [...questions];

      // First apply basic filters
      const basicFilters = this.applyFilters(filtered, request);
      filtered = basicFilters.filtered;

      // Then apply search with scoring
      const searchResults = this.performTextSearch(filtered, request.query, request.highlightMatches);

      // Sort by relevance or specified criteria
      const sortBy = request.sortBy || SearchSortOption.RELEVANCE;
      const sorted = this.sortSearchResults(searchResults, sortBy);

      return {
        filtered: this.paginate(sorted, request.limit, request.offset),
        total: sorted.length
      };
    });
  }

  /**
   * Filter questions by tags (must have ALL specified tags)
   */
  static filterByTags(questions: EnhancedQuestion[], tags: string[]): EnhancedQuestion[] {
    return questions.filter(question => {
      const questionTags = question.tags || [];
      return tags.every(tag => 
        questionTags.some(qTag => 
          qTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
    });
  }

  /**
   * Filter questions by estimated time range (in seconds)
   */
  static filterByTimeRange(
    questions: EnhancedQuestion[], 
    minTime?: number, 
    maxTime?: number
  ): EnhancedQuestion[] {
    return questions.filter(question => {
      const estimatedTime = question.metadata.estimatedTime;
      if (minTime && estimatedTime < minTime) return false;
      if (maxTime && estimatedTime > maxTime) return false;
      return true;
    });
  }

  /**
   * Perform full-text search with relevance scoring
   */
  private static performTextSearch(
    questions: EnhancedQuestion[], 
    query: string,
    highlightMatches = false
  ): SearchQuestionResult[] {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    return questions.map(question => {
      const relevanceScore = this.calculateRelevanceScore(question, searchTerms);
      const highlights = highlightMatches ? this.generateHighlights(question, searchTerms) : undefined;

      const result: SearchQuestionResult = {
        ...question,
        relevanceScore
      };
      
      if (highlights) {
        result.highlights = highlights;
      }
      
      return result;
    }).filter(result => result.relevanceScore > 0);
  }

  /**
   * Calculate relevance score for search results
   */
  private static calculateRelevanceScore(question: EnhancedQuestion, searchTerms: string[]): number {
    let score = 0;
    const questionText = question.questionText.toLowerCase();
    const explanation = question.explanation?.toLowerCase() || '';
    const tags = (question.tags || []).join(' ').toLowerCase();

    searchTerms.forEach(term => {
      // Question text matches (highest weight)
      if (questionText.includes(term)) {
        score += 10;
        // Bonus for exact phrase matches
        if (questionText.includes(term)) score += 5;
      }

      // Tag matches (high weight)
      if (tags.includes(term)) {
        score += 8;
      }

      // Explanation matches (medium weight)
      if (explanation.includes(term)) {
        score += 3;
      }

      // Option text matches (lower weight)
      question.options.forEach(option => {
        if (option.toLowerCase().includes(term)) {
          score += 2;
        }
      });
    });

    // Normalize score (0-1 range)
    return Math.min(score / (searchTerms.length * 10), 1);
  }

  /**
   * Generate highlighted matches for search results
   */
  private static generateHighlights(
    question: EnhancedQuestion, 
    searchTerms: string[]
  ): SearchHighlights {
    const highlights: SearchHighlights = {};

    // Highlight question text
    const highlightedQuestion = this.highlightText(question.questionText, searchTerms);
    if (highlightedQuestion !== question.questionText) {
      highlights.questionText = [highlightedQuestion];
    }

    // Highlight options
    const highlightedOptions: string[] = [];
    question.options.forEach(option => {
      const highlighted = this.highlightText(option, searchTerms);
      if (highlighted !== option) {
        highlightedOptions.push(highlighted);
      }
    });
    if (highlightedOptions.length > 0) {
      highlights.options = highlightedOptions;
    }

    // Highlight explanation
    if (question.explanation) {
      const highlightedExplanation = this.highlightText(question.explanation, searchTerms);
      if (highlightedExplanation !== question.explanation) {
        highlights.explanation = [highlightedExplanation];
      }
    }

    // Highlight tags
    if (question.tags) {
      const highlightedTags: string[] = [];
      question.tags.forEach(tag => {
        const highlighted = this.highlightText(tag, searchTerms);
        if (highlighted !== tag) {
          highlightedTags.push(highlighted);
        }
      });
      if (highlightedTags.length > 0) {
        highlights.tags = highlightedTags;
      }
    }

    return highlights;
  }

  /**
   * Add highlighting markup to text
   */
  private static highlightText(text: string, searchTerms: string[]): string {
    let highlighted = text;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    return highlighted;
  }

  /**
   * Sort questions with custom logic
   */
  static sortQuestions(questions: EnhancedQuestion[], sortBy: string, sortOrder: string): EnhancedQuestion[] {
    return [...questions].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'difficulty':
          comparison = this.compareDifficulties(a.difficulty, b.difficulty);
          break;
        case 'estimatedTime':
          comparison = a.metadata.estimatedTime - b.metadata.estimatedTime;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        default:
          comparison = a.questionText.localeCompare(b.questionText);
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Sort search results with relevance and other criteria
   */
  private static sortSearchResults(results: SearchQuestionResult[], sortBy: SearchSortOption): SearchQuestionResult[] {
    return [...results].sort((a, b) => {
      switch (sortBy) {
        case SearchSortOption.RELEVANCE:
          return b.relevanceScore - a.relevanceScore;
        case SearchSortOption.DIFFICULTY_ASC:
          return this.compareDifficulties(a.difficulty, b.difficulty);
        case SearchSortOption.DIFFICULTY_DESC:
          return this.compareDifficulties(b.difficulty, a.difficulty);
        case SearchSortOption.CREATED_ASC:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case SearchSortOption.CREATED_DESC:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return b.relevanceScore - a.relevanceScore;
      }
    });
  }

  /**
   * Compare difficulty levels for sorting
   */
  private static compareDifficulties(diffA: DifficultyLevel, diffB: DifficultyLevel): number {
    const difficultyOrder = { 
      [DifficultyLevel.EASY]: 1, 
      [DifficultyLevel.MEDIUM]: 2, 
      [DifficultyLevel.HARD]: 3,
      [DifficultyLevel.BEGINNER]: 1,
      [DifficultyLevel.INTERMEDIATE]: 2,
      [DifficultyLevel.ADVANCED]: 3,
      [DifficultyLevel.EXPERT]: 4
    };
    const orderA = difficultyOrder[diffA] || 999;
    const orderB = difficultyOrder[diffB] || 999;
    return orderA - orderB;
  }

  /**
   * Extract available filter options from questions list
   */
  static extractFilterOptions(questions: EnhancedQuestion[]): {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: DifficultyLevel[];
    types: QuestionType[];
    reviewStatuses: ReviewStatus[];
    bloomsLevels: BloomsLevel[];
    cognitiveLoads: CognitiveLoad[];
    tags: string[];
    timeRanges: { min: number; max: number }[];
  } {
    const providers = this.extractUniqueValues(questions, 'providerId');
    const exams = this.extractUniqueValues(questions, 'examId');
    const topics = this.extractUniqueValues(questions, 'topicId');
    
    // Extract all unique tags
    const allTags = new Set<string>();
    questions.forEach(q => {
      (q.tags || []).forEach(tag => allTags.add(tag));
    });

    // Extract time ranges
    const times = questions.map(q => q.metadata.estimatedTime);
    const timeRanges = this.createTimeRanges(times);

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      topics: topics.sort(),
      difficulties: ['easy', 'medium', 'hard'] as DifficultyLevel[],
      types: Object.values(QuestionType),
      reviewStatuses: Object.values(ReviewStatus),
      bloomsLevels: Object.values(BloomsLevel),
      cognitiveLoads: Object.values(CognitiveLoad),
      tags: Array.from(allTags).sort(),
      timeRanges
    };
  }

  /**
   * Create meaningful time ranges from estimated times
   */
  private static createTimeRanges(times: number[]): { min: number; max: number }[] {
    if (times.length === 0) return [];
    
    const validTimes = times.filter(t => t > 0);
    if (validTimes.length === 0) return [];
    
    const min = Math.min(...validTimes);
    const max = Math.max(...validTimes);
    
    return [
      { min: 0, max: 60 },      // Under 1 minute
      { min: 60, max: 180 },    // 1-3 minutes
      { min: 180, max: 300 },   // 3-5 minutes
      { min: 300, max: 600 },   // 5-10 minutes
      { min: 600, max: max }    // Over 10 minutes
    ];
  }

  /**
   * Validate question filter request parameters
   */
  static validateRequest(request: QuestionFilterRequest | QuestionSearchRequest): string[] {
    const errors: string[] = [];

    // Validate difficulty
    if (request.difficulty && !['easy', 'medium', 'hard'].includes(request.difficulty)) {
      errors.push('Invalid difficulty. Must be: easy, medium, or hard');
    }

    // Validate time range
    if (request.estimatedTimeMin && request.estimatedTimeMax && 
        request.estimatedTimeMin > request.estimatedTimeMax) {
      errors.push('Minimum estimated time must be less than or equal to maximum');
    }

    // Validate search query for search requests
    if ('query' in request && (!request.query || request.query.trim().length === 0)) {
      errors.push('Search query cannot be empty');
    }

    // Validate pagination
    if (request.limit && (request.limit < 1 || request.limit > 1000)) {
      errors.push('Limit must be between 1 and 1000');
    }

    if (request.offset && request.offset < 0) {
      errors.push('Offset must be non-negative');
    }

    return errors;
  }
}