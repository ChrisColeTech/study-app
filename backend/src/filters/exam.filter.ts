// Exam domain filtering logic
// Handles filtering for exam listings, categories, levels, and provider-specific exams

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { Exam, GetExamsRequest } from '../shared/types/exam.types';

export interface ExamFilterRequest extends BaseFilterRequest {
  provider?: string;
  category?: string;
  level?: 'foundational' | 'associate' | 'professional' | 'specialty' | 'expert';
  includeInactive?: boolean;
  minDuration?: number;
  maxDuration?: number;
  minQuestionCount?: number;
  maxQuestionCount?: number;
}

/**
 * ExamFilter - Dedicated filter for exam data and exam-related searches
 * 
 * Provides filtering capabilities for exam listings, categories, difficulty levels,
 * provider-specific exams, and exam characteristics like duration and question count.
 */
export class ExamFilter extends BaseFilter {
  /**
   * Apply all filters to exam list based on request
   */
  static applyFilters(exams: Exam[], request: ExamFilterRequest): FilterResult<Exam> {
    return this.withTiming(() => {
      let filtered = [...exams];

      // Filter by active status
      filtered = this.filterByStatus(filtered, request.includeInactive);

      // Filter by provider
      if (request.provider) {
        filtered = filtered.filter(exam => 
          exam.providerId.toLowerCase() === request.provider!.toLowerCase() ||
          exam.providerName.toLowerCase().includes(request.provider!.toLowerCase())
        );
      }

      // Filter by category
      if (request.category) {
        filtered = this.filterByCategory(filtered, request.category);
      }

      // Filter by level
      if (request.level) {
        filtered = this.filterByLevel(filtered, request.level);
      }

      // Filter by duration range
      if (request.minDuration || request.maxDuration) {
        filtered = this.filterByDurationRange(filtered, request.minDuration, request.maxDuration);
      }

      // Filter by question count range
      if (request.minQuestionCount || request.maxQuestionCount) {
        filtered = this.filterByQuestionCountRange(filtered, request.minQuestionCount, request.maxQuestionCount);
      }

      // Filter by search term
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'examName', 'examCode', 'description', 'providerName'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'examName';
      const sortOrder = request.sortOrder || 'asc';
      filtered = this.sortExams(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter exams by active status
   */
  static filterByStatus(exams: Exam[], includeInactive = false): Exam[] {
    if (includeInactive) return exams;
    return exams.filter(exam => exam.isActive);
  }

  /**
   * Filter exams by category
   */
  static filterByCategory(exams: Exam[], category: string): Exam[] {
    return exams.filter(exam => 
      exam.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Filter exams by certification level
   */
  static filterByLevel(
    exams: Exam[], 
    level: 'foundational' | 'associate' | 'professional' | 'specialty' | 'expert'
  ): Exam[] {
    return exams.filter(exam => exam.level === level);
  }

  /**
   * Filter exams by duration range (in minutes)
   */
  static filterByDurationRange(
    exams: Exam[], 
    minDuration?: number, 
    maxDuration?: number
  ): Exam[] {
    return exams.filter(exam => {
      if (!exam.duration) return true; // Include exams without duration info
      
      if (minDuration && exam.duration < minDuration) return false;
      if (maxDuration && exam.duration > maxDuration) return false;
      return true;
    });
  }

  /**
   * Filter exams by question count range
   */
  static filterByQuestionCountRange(
    exams: Exam[], 
    minCount?: number, 
    maxCount?: number
  ): Exam[] {
    return exams.filter(exam => {
      const count = exam.questionCount;
      if (!count) return true; // Include exams without question count info
      
      if (minCount && count < minCount) return false;
      if (maxCount && count > maxCount) return false;
      return true;
    });
  }

  /**
   * Sort exams with custom sorting logic
   */
  static sortExams(exams: Exam[], sortBy: string, sortOrder: string): Exam[] {
    return [...exams].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
        case 'examName':
          comparison = a.examName.localeCompare(b.examName);
          break;
        case 'provider':
        case 'providerName':
          comparison = a.providerName.localeCompare(b.providerName);
          break;
        case 'level':
          comparison = this.compareLevels(a.level, b.level);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'questionCount':
          comparison = (a.questionCount || 0) - (b.questionCount || 0);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        default:
          comparison = a.examName.localeCompare(b.examName);
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Compare exam levels for proper ordering
   */
  private static compareLevels(
    levelA: string, 
    levelB: string
  ): number {
    const levelOrder = {
      'foundational': 1,
      'associate': 2,
      'professional': 3,
      'specialty': 4,
      'expert': 5
    };

    const orderA = levelOrder[levelA as keyof typeof levelOrder] || 999;
    const orderB = levelOrder[levelB as keyof typeof levelOrder] || 999;
    
    return orderA - orderB;
  }

  /**
   * Extract available filter options from exam list
   */
  static extractFilterOptions(exams: Exam[]): {
    providers: string[];
    categories: string[];
    levels: string[];
    durationRanges: { min: number; max: number }[];
    questionCountRanges: { min: number; max: number }[];
  } {
    const providers = this.extractUniqueValues(exams, 'providerName');
    const categories = this.extractUniqueValues(exams, 'category');
    const levels = this.extractUniqueValues(exams, 'level');
    
    // Calculate duration ranges
    const durations = exams
      .map(e => e.duration)
      .filter(d => d !== undefined) as number[];
    
    const questionCounts = exams
      .map(e => e.questionCount)
      .filter(q => q !== undefined) as number[];

    return {
      providers: providers.sort(),
      categories: categories.sort(),
      levels: ['foundational', 'associate', 'professional', 'specialty', 'expert'],
      durationRanges: this.createRanges(durations),
      questionCountRanges: this.createRanges(questionCounts)
    };
  }

  /**
   * Create meaningful ranges from numeric data
   */
  private static createRanges(values: number[]): { min: number; max: number }[] {
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range <= 0) return [{ min, max }];
    
    const step = Math.ceil(range / 4); // Create ~4 ranges
    const ranges = [];
    
    for (let i = min; i < max; i += step) {
      ranges.push({
        min: i,
        max: Math.min(i + step - 1, max)
      });
    }
    
    return ranges;
  }

  /**
   * Validate exam filter request parameters
   */
  static validateRequest(request: ExamFilterRequest): string[] {
    const errors: string[] = [];

    // Validate level
    const validLevels = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
    if (request.level && !validLevels.includes(request.level)) {
      errors.push(`Invalid level. Must be one of: ${validLevels.join(', ')}`);
    }

    // Validate duration range
    if (request.minDuration && request.maxDuration && request.minDuration > request.maxDuration) {
      errors.push('Minimum duration must be less than or equal to maximum duration');
    }

    // Validate question count range
    if (request.minQuestionCount && request.maxQuestionCount && 
        request.minQuestionCount > request.maxQuestionCount) {
      errors.push('Minimum question count must be less than or equal to maximum question count');
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