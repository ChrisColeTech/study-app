// Filter Architecture - Centralized Exports
// Provides unified access to all domain-specific filters and base filtering infrastructure

import type { FilterResult } from './base.filter';
import { BaseFilter } from './base.filter';
import { AnalyticsFilter } from './analytics.filter';
import { ExamFilter } from './exam.filter';
import { GoalsFilter } from './goals.filter';
import { ProviderFilter } from './provider.filter';
import { QuestionFilter } from './question.filter';
import { SessionFilter } from './session.filter';
import { TopicFilter } from './topic.filter';
import { UserFilter } from './user.filter';

// Base filter infrastructure
export { BaseFilter } from './base.filter';
export type { FilterResult, BaseFilterRequest, PaginationParams, SortingParams } from './base.filter';

// Domain-specific filters
export { AnalyticsFilter } from './analytics.filter';
export type { AnalyticsFilterRequest } from './analytics.filter';
export { ExamFilter } from './exam.filter';
export type { ExamFilterRequest } from './exam.filter';
export { GoalsFilter } from './goals.filter';
export type { GoalsFilterRequest } from './goals.filter';
export { ProviderFilter } from './provider.filter';
export { QuestionFilter } from './question.filter';
export type { QuestionFilterRequest, QuestionSearchRequest } from './question.filter';
export { SessionFilter } from './session.filter';
export type { SessionFilterRequest } from './session.filter';
export { TopicFilter } from './topic.filter';
export type { TopicFilterRequest } from './topic.filter';
export { UserFilter } from './user.filter';
export type { UserFilterRequest } from './user.filter';

/**
 * Filter Architecture Overview
 * 
 * The filter system provides standardized filtering capabilities across all domains:
 * 
 * Base Infrastructure:
 * - BaseFilter: Common filtering utilities and patterns
 * - FilterResult<T>: Standardized result format with timing metrics
 * - BaseFilterRequest: Common request parameters (pagination, sorting, search)
 * 
 * Domain Filters:
 * - AnalyticsFilter: Progress analytics, performance metrics, time-based filtering
 * - ExamFilter: Exam listings, categories, levels, provider-specific exams
 * - GoalsFilter: Goal status, priority, progress, deadline-based filtering  
 * - ProviderFilter: Provider status, category, search functionality
 * - QuestionFilter: Question search, difficulty, topics, advanced search with scoring
 * - SessionFilter: Session status, performance, date ranges, analytics aggregation
 * - TopicFilter: Topic categories, difficulty, skills, market demand
 * - UserFilter: User management, activity tracking, profile completeness
 * 
 * Key Features:
 * - Consistent API patterns across all filters
 * - Performance timing for optimization
 * - Comprehensive validation with descriptive error messages
 * - Flexible sorting and pagination
 * - Statistical analysis and grouping capabilities
 * - Advanced search with relevance scoring (QuestionFilter)
 * - Filter options extraction for dynamic UI generation
 * 
 * Usage Examples:
 * ```typescript
 * // Basic filtering
 * const result = ExamFilter.applyFilters(exams, {
 *   provider: 'aws',
 *   level: 'associate',
 *   search: 'solution architect'
 * });
 * 
 * // Advanced search with scoring
 * const searchResults = QuestionFilter.searchQuestions(questions, {
 *   query: 'lambda functions',
 *   difficulty: 'medium',
 *   highlightMatches: true
 * });
 * 
 * // Analytics filtering with time ranges
 * const analytics = AnalyticsFilter.filterHistoricalData(data, {
 *   timeframe: 'month',
 *   providerId: 'aws',
 *   startDate: '2025-01-01'
 * });
 * ```
 */

// Filter factory for dynamic filter selection
export class FilterFactory {
  /**
   * Get appropriate filter class for domain
   */
  static getFilter(domain: string): any {
    switch (domain.toLowerCase()) {
      case 'analytics':
        return AnalyticsFilter;
      case 'exam':
      case 'exams':
        return ExamFilter;
      case 'goals':
      case 'goal':
        return GoalsFilter;
      case 'provider':
      case 'providers':
        return ProviderFilter;
      case 'question':
      case 'questions':
        return QuestionFilter;
      case 'session':
      case 'sessions':
        return SessionFilter;
      case 'topic':
      case 'topics':
        return TopicFilter;
      case 'user':
      case 'users':
        return UserFilter;
      default:
        return BaseFilter;
    }
  }

  /**
   * Validate request for any domain filter
   */
  static validateRequest(domain: string, request: any): string[] {
    const FilterClass = this.getFilter(domain) as any;
    if (FilterClass.validateRequest) {
      return FilterClass.validateRequest(request);
    }
    return [];
  }

  /**
   * Extract filter options for any domain
   */
  static extractFilterOptions(domain: string, data: any[]): any {
    const FilterClass = this.getFilter(domain) as any;
    if (FilterClass.extractFilterOptions) {
      return FilterClass.extractFilterOptions(data);
    }
    return {};
  }
}

/**
 * Common filter utilities available across all domains
 */
export class FilterUtils {
  /**
   * Create standardized filter result with timing
   */
  static createResult<T>(
    filtered: T[],
    total: number,
    executionTimeMs?: number
  ): FilterResult<T> {
    const result: FilterResult<T> = {
      filtered,
      total
    };
    
    if (executionTimeMs !== undefined) {
      result.executionTimeMs = executionTimeMs;
    }
    
    return result;
  }

  /**
   * Validate common pagination parameters
   */
  static validatePagination(limit?: number, offset?: number): string[] {
    const errors: string[] = [];

    if (limit !== undefined && (limit < 1 || limit > 1000)) {
      errors.push('Limit must be between 1 and 1000');
    }

    if (offset !== undefined && offset < 0) {
      errors.push('Offset must be non-negative');
    }

    return errors;
  }

  /**
   * Validate common sorting parameters
   */
  static validateSorting(sortOrder?: string): string[] {
    const errors: string[] = [];

    if (sortOrder && !['asc', 'desc', 'ASC', 'DESC'].includes(sortOrder)) {
      errors.push('Sort order must be "asc" or "desc"');
    }

    return errors;
  }

  /**
   * Validate date range parameters
   */
  static validateDateRange(startDate?: string, endDate?: string): string[] {
    const errors: string[] = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime())) {
        errors.push('Invalid start date format');
      }
      
      if (isNaN(end.getTime())) {
        errors.push('Invalid end date format');
      }
      
      if (start > end) {
        errors.push('Start date must be before end date');
      }
    }

    return errors;
  }
}