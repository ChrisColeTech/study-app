// Topic domain filtering logic
// Handles filtering for topics, categories, provider-specific topics, and skill validation

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { Topic, GetTopicsRequest } from '../shared/types/topic.types';

export interface TopicFilterRequest extends BaseFilterRequest {
  provider?: string;
  exam?: string;
  category?: string;
  level?: string;
  difficultyLevel?: number; // 1-5 scale
  minDifficulty?: number;
  maxDifficulty?: number;
  marketDemand?: 'high' | 'medium' | 'low';
  studyTimeMin?: number; // hours
  studyTimeMax?: number; // hours
  skillsValidated?: string[];
}

/**
 * TopicFilter - Dedicated filter for topics and topic categorization
 * 
 * Provides filtering capabilities for topic listings, categories, difficulty levels,
 * provider-specific topics, and skills validation with market demand analysis.
 */
export class TopicFilter extends BaseFilter {
  /**
   * Apply all filters to topics list based on request
   */
  static applyFilters(topics: Topic[], request: TopicFilterRequest): FilterResult<Topic> {
    return this.withTiming(() => {
      let filtered = [...topics];

      // Filter by provider
      if (request.provider) {
        filtered = filtered.filter(topic => 
          topic.providerId.toLowerCase() === request.provider!.toLowerCase() ||
          topic.providerName.toLowerCase().includes(request.provider!.toLowerCase())
        );
      }

      // Filter by exam
      if (request.exam) {
        filtered = filtered.filter(topic => 
          topic.examId.toLowerCase() === request.exam!.toLowerCase() ||
          topic.examCode.toLowerCase().includes(request.exam!.toLowerCase())
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

      // Filter by difficulty level
      if (request.difficultyLevel !== undefined) {
        filtered = filtered.filter(topic => 
          topic.metadata.difficultyLevel === request.difficultyLevel
        );
      }

      // Filter by difficulty range
      if (request.minDifficulty !== undefined || request.maxDifficulty !== undefined) {
        filtered = this.filterByDifficultyRange(filtered, request.minDifficulty, request.maxDifficulty);
      }

      // Filter by market demand
      if (request.marketDemand) {
        filtered = filtered.filter(topic => 
          topic.metadata.marketDemand === request.marketDemand
        );
      }

      // Filter by study time range
      if (request.studyTimeMin !== undefined || request.studyTimeMax !== undefined) {
        filtered = this.filterByStudyTimeRange(filtered, request.studyTimeMin, request.studyTimeMax);
      }

      // Filter by skills validated
      if (request.skillsValidated && request.skillsValidated.length > 0) {
        filtered = this.filterBySkills(filtered, request.skillsValidated);
      }

      // Filter by search term
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'name', 'description', 'providerName', 'examName'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'name';
      const sortOrder = request.sortOrder || 'asc';
      filtered = this.sortTopics(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter topics by category
   */
  static filterByCategory(topics: Topic[], category: string): Topic[] {
    return topics.filter(topic => 
      topic.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Filter topics by certification level
   */
  static filterByLevel(topics: Topic[], level: string): Topic[] {
    return topics.filter(topic => 
      topic.level.toLowerCase() === level.toLowerCase()
    );
  }

  /**
   * Filter topics by difficulty level range (1-5 scale)
   */
  static filterByDifficultyRange(
    topics: Topic[], 
    minDifficulty?: number, 
    maxDifficulty?: number
  ): Topic[] {
    return topics.filter(topic => {
      const difficulty = topic.metadata.difficultyLevel;
      if (!difficulty) return true; // Include topics without difficulty info
      
      if (minDifficulty !== undefined && difficulty < minDifficulty) return false;
      if (maxDifficulty !== undefined && difficulty > maxDifficulty) return false;
      return true;
    });
  }

  /**
   * Filter topics by recommended study time range (in hours)
   */
  static filterByStudyTimeRange(
    topics: Topic[], 
    minTime?: number, 
    maxTime?: number
  ): Topic[] {
    return topics.filter(topic => {
      const studyTime = topic.metadata.studyTimeRecommended;
      if (!studyTime) return true; // Include topics without study time info
      
      if (minTime !== undefined && studyTime < minTime) return false;
      if (maxTime !== undefined && studyTime > maxTime) return false;
      return true;
    });
  }

  /**
   * Filter topics by skills validated (must have ALL specified skills)
   */
  static filterBySkills(topics: Topic[], skills: string[]): Topic[] {
    return topics.filter(topic => {
      const topicSkills = topic.skillsValidated.map(s => s.toLowerCase());
      return skills.every(skill => 
        topicSkills.some(topicSkill => 
          topicSkill.includes(skill.toLowerCase())
        )
      );
    });
  }

  /**
   * Sort topics with custom sorting logic
   */
  static sortTopics(topics: Topic[], sortBy: string, sortOrder: string): Topic[] {
    return [...topics].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'provider':
        case 'providerName':
          comparison = a.providerName.localeCompare(b.providerName);
          break;
        case 'exam':
        case 'examName':
          comparison = a.examName.localeCompare(b.examName);
          break;
        case 'level':
          comparison = a.level.localeCompare(b.level);
          break;
        case 'category':
          const aCat = a.category || '';
          const bCat = b.category || '';
          comparison = aCat.localeCompare(bCat);
          break;
        case 'difficulty':
        case 'difficultyLevel':
          const aDiff = a.metadata.difficultyLevel || 0;
          const bDiff = b.metadata.difficultyLevel || 0;
          comparison = aDiff - bDiff;
          break;
        case 'studyTime':
        case 'studyTimeRecommended':
          const aTime = a.metadata.studyTimeRecommended || 0;
          const bTime = b.metadata.studyTimeRecommended || 0;
          comparison = aTime - bTime;
          break;
        case 'popularity':
        case 'popularityRank':
          const aRank = a.metadata.popularityRank || 999999;
          const bRank = b.metadata.popularityRank || 999999;
          comparison = aRank - bRank; // Lower rank number = higher popularity
          break;
        case 'marketDemand':
          comparison = this.compareMarketDemand(a.metadata.marketDemand, b.metadata.marketDemand);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Compare market demand for sorting (high > medium > low)
   */
  private static compareMarketDemand(demandA?: string, demandB?: string): number {
    const demandOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const orderA = demandOrder[demandA as keyof typeof demandOrder] || 0;
    const orderB = demandOrder[demandB as keyof typeof demandOrder] || 0;
    return orderB - orderA; // High demand first
  }

  /**
   * Get topic statistics for analytics
   */
  static getTopicStats(topics: Topic[]): {
    total: number;
    byProvider: Record<string, number>;
    byExam: Record<string, number>;
    byCategory: Record<string, number>;
    byLevel: Record<string, number>;
    byMarketDemand: Record<string, number>;
    averageDifficulty: number;
    averageStudyTime: number;
  } {
    const stats = {
      total: topics.length,
      byProvider: {} as Record<string, number>,
      byExam: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      byMarketDemand: {} as Record<string, number>,
      averageDifficulty: 0,
      averageStudyTime: 0
    };

    let totalDifficulty = 0;
    let totalStudyTime = 0;
    let difficultyCount = 0;
    let studyTimeCount = 0;

    topics.forEach(topic => {
      // Count by provider
      stats.byProvider[topic.providerName] = (stats.byProvider[topic.providerName] || 0) + 1;

      // Count by exam
      stats.byExam[topic.examName] = (stats.byExam[topic.examName] || 0) + 1;

      // Count by category
      if (topic.category) {
        stats.byCategory[topic.category] = (stats.byCategory[topic.category] || 0) + 1;
      }

      // Count by level
      stats.byLevel[topic.level] = (stats.byLevel[topic.level] || 0) + 1;

      // Count by market demand
      if (topic.metadata.marketDemand) {
        stats.byMarketDemand[topic.metadata.marketDemand] = 
          (stats.byMarketDemand[topic.metadata.marketDemand] || 0) + 1;
      }

      // Calculate averages
      if (topic.metadata.difficultyLevel) {
        totalDifficulty += topic.metadata.difficultyLevel;
        difficultyCount++;
      }

      if (topic.metadata.studyTimeRecommended) {
        totalStudyTime += topic.metadata.studyTimeRecommended;
        studyTimeCount++;
      }
    });

    stats.averageDifficulty = difficultyCount > 0 ? Math.round((totalDifficulty / difficultyCount) * 10) / 10 : 0;
    stats.averageStudyTime = studyTimeCount > 0 ? Math.round((totalStudyTime / studyTimeCount) * 10) / 10 : 0;

    return stats;
  }

  /**
   * Group topics by specified criteria
   */
  static groupTopicsBy(
    topics: Topic[], 
    groupBy: 'provider' | 'exam' | 'category' | 'level' | 'marketDemand'
  ): Record<string, Topic[]> {
    const groups: Record<string, Topic[]> = {};

    topics.forEach(topic => {
      let key = '';
      
      switch (groupBy) {
        case 'provider':
          key = topic.providerName;
          break;
        case 'exam':
          key = topic.examName;
          break;
        case 'category':
          key = topic.category || 'Uncategorized';
          break;
        case 'level':
          key = topic.level;
          break;
        case 'marketDemand':
          key = topic.metadata.marketDemand || 'Unknown';
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(topic);
    });

    return groups;
  }

  /**
   * Extract available filter options from topics list
   */
  static extractFilterOptions(topics: Topic[]): {
    providers: string[];
    exams: string[];
    categories: string[];
    levels: string[];
    difficultyLevels: number[];
    marketDemands: string[];
    skillsValidated: string[];
    studyTimeRanges: { min: number; max: number }[];
  } {
    const providers = this.extractUniqueValues(topics, 'providerName');
    const exams = this.extractUniqueValues(topics, 'examName');
    const categories = this.extractUniqueValues(topics, 'category', cat => cat !== undefined && cat !== null);
    const levels = this.extractUniqueValues(topics, 'level');

    // Extract difficulty levels
    const difficultyLevels = this.extractUniqueValues(
      topics, 
      'metadata',
      metadata => metadata.difficultyLevel !== undefined
    ).map(metadata => metadata.difficultyLevel).sort();

    // Extract market demands
    const marketDemands = this.extractUniqueValues(
      topics,
      'metadata',
      metadata => metadata.marketDemand !== undefined
    ).map(metadata => metadata.marketDemand);

    // Extract all unique skills
    const allSkills = new Set<string>();
    topics.forEach(topic => {
      topic.skillsValidated.forEach(skill => allSkills.add(skill));
    });

    // Extract study time ranges
    const studyTimes = topics
      .map(t => t.metadata.studyTimeRecommended)
      .filter(time => time !== undefined) as number[];

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      categories: categories.sort(),
      levels: levels.sort(),
      difficultyLevels: Array.from(new Set(difficultyLevels)).sort(),
      marketDemands: Array.from(new Set(marketDemands)).sort(),
      skillsValidated: Array.from(allSkills).sort(),
      studyTimeRanges: this.createStudyTimeRanges(studyTimes)
    };
  }

  /**
   * Create study time ranges in hours
   */
  private static createStudyTimeRanges(times: number[]): { min: number; max: number }[] {
    if (times.length === 0) return [];

    return [
      { min: 0, max: 10 },      // Under 10 hours
      { min: 10, max: 25 },     // 10-25 hours
      { min: 25, max: 50 },     // 25-50 hours
      { min: 50, max: 100 },    // 50-100 hours
      { min: 100, max: 99999 }  // Over 100 hours
    ];
  }

  /**
   * Validate topic filter request parameters
   */
  static validateRequest(request: TopicFilterRequest): string[] {
    const errors: string[] = [];

    // Validate difficulty level
    if (request.difficultyLevel !== undefined && 
        (request.difficultyLevel < 1 || request.difficultyLevel > 5)) {
      errors.push('Difficulty level must be between 1 and 5');
    }

    // Validate difficulty range
    if (request.minDifficulty !== undefined && 
        (request.minDifficulty < 1 || request.minDifficulty > 5)) {
      errors.push('Minimum difficulty must be between 1 and 5');
    }
    if (request.maxDifficulty !== undefined && 
        (request.maxDifficulty < 1 || request.maxDifficulty > 5)) {
      errors.push('Maximum difficulty must be between 1 and 5');
    }
    if (request.minDifficulty !== undefined && request.maxDifficulty !== undefined && 
        request.minDifficulty > request.maxDifficulty) {
      errors.push('Minimum difficulty must be less than or equal to maximum difficulty');
    }

    // Validate market demand
    const validDemands = ['high', 'medium', 'low'];
    if (request.marketDemand && !validDemands.includes(request.marketDemand)) {
      errors.push(`Invalid market demand. Must be one of: ${validDemands.join(', ')}`);
    }

    // Validate study time range
    if (request.studyTimeMin !== undefined && request.studyTimeMin < 0) {
      errors.push('Minimum study time must be non-negative');
    }
    if (request.studyTimeMax !== undefined && request.studyTimeMax < 0) {
      errors.push('Maximum study time must be non-negative');
    }
    if (request.studyTimeMin !== undefined && request.studyTimeMax !== undefined && 
        request.studyTimeMin > request.studyTimeMax) {
      errors.push('Minimum study time must be less than or equal to maximum study time');
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