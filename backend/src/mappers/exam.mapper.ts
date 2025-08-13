// Dedicated mapper for exam data transformations
// Standardized transformation patterns for exam-related data objects

import {
  Exam,
  GetExamsResponse,
  GetExamResponse
} from '../shared/types/exam.types';

/**
 * ExamMapper - Dedicated mapper for exam data transformations
 * 
 * Provides standardized transformation patterns for exam-related data objects
 * with consistent response formatting and filter option extraction.
 * 
 * @responsibilities
 * - Transform exam objects to response formats
 * - Create exam collection responses with filters and pagination
 * - Extract filter options from exam collections
 */
/**
 * ExamMapper - Dedicated mapper for exam data transformations
 * 
 * Provides standardized transformation patterns for exam-related data objects
 * with consistent response formatting and filter option extraction.
 * 
 * @responsibilities
 * - Transform exam objects to response formats
 * - Create exam collection responses with filters and pagination
 * - Extract filter options from exam collections
 */
export class ExamMapper {
  /**
   * Create GetExamResponse from exam object
   * 
   * @param exam - Exam domain object
   * @param provider - Optional provider context
   * @returns Formatted single exam response
   */
  static toGetExamResponse(exam: Exam, provider?: any): GetExamResponse {
    const response: GetExamResponse = {
      exam,
    };

    if (provider) {
      response.provider = {
        id: provider.id || exam.providerId,
        name: provider.name || exam.providerName,
        fullName: provider.fullName || exam.providerName,
        description: provider.description || '',
        website: provider.website || '',
        category: provider.category || exam.category || 'other',
      };
    }

    return response;
  }

  /**
   * Create GetExamsResponse with pagination and filters
   * 
   * @param exams - Array of exam objects
   * @param total - Total number of exams (before pagination)
   * @param filters - Available filter options
   * @param pagination - Pagination metadata
   * @returns Complete GetExamsResponse
   */
  static toGetExamsResponse(
    exams: Exam[],
    total: number,
    filters: {
      providers: string[];
      categories: string[];
      levels: string[];
    },
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    }
  ): GetExamsResponse {
    return {
      exams,
      total,
      filters,
      pagination,
    };
  }

  /**
   * Extract available filter options from exam collection
   * 
   * @param exams - Array of all exams
   * @returns Filter options object
   */
  static extractFilterOptions(exams: Exam[]): {
    providers: string[];
    categories: string[];
    levels: string[];
  } {
    const providers = [...new Set(exams.map(e => e.providerId))];
    const categories = [...new Set(
      exams.map(e => this.getCategoryFromProvider(e.providerId))
    )].filter(Boolean);
    const levels = [...new Set(exams.map(e => e.level))];

    return {
      providers: providers.sort(),
      categories: categories.sort(),
      levels: levels.sort(),
    };
  }

  /**
   * Sort exams by provider, level, and name
   * 
   * @param exams - Array of exams to sort
   * @returns Sorted exam array
   */
  static sortExams(exams: Exam[]): Exam[] {
    return exams.sort((a, b) => {
      // Sort by provider name first
      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;

      // Then by level order
      const levelOrder = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
      const levelCompare = levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
      if (levelCompare !== 0) return levelCompare;

      // Finally by exam name
      return a.examName.localeCompare(b.examName);
    });
  }

  /**
   * Get category from provider ID (helper method)
   * 
   * @param providerId - Provider identifier
   * @returns Category string
   * @private
   */
  private static getCategoryFromProvider(providerId: string): string {
    const categoryMap: Record<string, string> = {
      aws: 'cloud',
      azure: 'cloud',
      gcp: 'cloud',
      cisco: 'networking',
      comptia: 'general',
    };

    return categoryMap[providerId.toLowerCase()] || 'other';
  }

  /**
   * Calculate exam difficulty score based on level
   * 
   * @param level - Exam level string
   * @returns Difficulty score (1-5)
   */
  static calculateDifficultyScore(level: string): number {
    const difficultyMap: Record<string, number> = {
      foundational: 1,
      associate: 2,
      professional: 4,
      specialty: 3,
      expert: 5,
    };

    return difficultyMap[level.toLowerCase()] || 2;
  }

  /**
   * Format exam duration in human-readable format
   * 
   * @param minutes - Duration in minutes
   * @returns Formatted duration string
   */
  static formatExamDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return remainingMinutes > 0 
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }
}