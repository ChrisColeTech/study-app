// Analytics domain filtering logic
// Handles filtering for analytics data, progress metrics, and performance data

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { 
  ProgressAnalyticsRequest,
  HistoricalPerformance,
  TopicCompetency,
  ProviderCompetency
} from '../shared/types/analytics.types';

export interface AnalyticsFilterRequest extends BaseFilterRequest {
  timeframe?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  providerId?: string;
  examId?: string;
  topics?: string[];
  startDate?: string;
  endDate?: string;
}

/**
 * AnalyticsFilter - Dedicated filter for analytics and performance data
 * 
 * Provides filtering capabilities for analytics requests, historical data,
 * competency analysis, and performance metrics with time-based filtering.
 */
export class AnalyticsFilter extends BaseFilter {
  /**
   * Apply all filters to analytics request parameters
   */
  static applyRequestFilters(request: ProgressAnalyticsRequest): ProgressAnalyticsRequest {
    const filtered = { ...request };

    // Apply default timeframe if not specified
    if (!filtered.timeframe) {
      filtered.timeframe = 'month';
    }

    // Apply default pagination
    if (!filtered.limit) {
      filtered.limit = 50;
    }
    if (!filtered.offset) {
      filtered.offset = 0;
    }

    return filtered;
  }

  /**
   * Filter historical performance data by timeframe and criteria
   */
  static filterHistoricalData(
    data: HistoricalPerformance[],
    request: AnalyticsFilterRequest
  ): FilterResult<HistoricalPerformance> {
    return this.withTiming(() => {
      let filtered = [...data];

      // Filter by date range
      if (request.startDate || request.endDate) {
        filtered = this.filterByDateRange(filtered, 'date', request.startDate, request.endDate);
      }

      // Filter by timeframe
      if (request.timeframe && request.timeframe !== 'all') {
        filtered = this.filterByTimeframe(filtered, request.timeframe);
      }

      // Filter by search (searches topic names)
      if (request.search) {
        filtered = filtered.filter(item =>
          item.topicsFocused.some(topic =>
            topic.toLowerCase().includes(request.search!.toLowerCase())
          )
        );
      }

      // Sort by date (newest first by default)
      const sortBy = request.sortBy || 'date';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortItems(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter topic competencies by performance criteria
   */
  static filterTopicCompetencies(
    competencies: TopicCompetency[],
    request: AnalyticsFilterRequest
  ): FilterResult<TopicCompetency> {
    return this.withTiming(() => {
      let filtered = [...competencies];

      // Filter by provider
      if (request.providerId) {
        filtered = filtered.filter(c => c.providerId === request.providerId);
      }

      // Filter by exam
      if (request.examId) {
        filtered = filtered.filter(c => c.examId === request.examId);
      }

      // Filter by specific topics
      if (request.topics && request.topics.length > 0) {
        filtered = filtered.filter(c => request.topics!.includes(c.topicId));
      }

      // Filter by search (topic name)
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, ['topicName']);
      }

      // Sort by accuracy or improvement rate
      const sortBy = request.sortBy || 'currentAccuracy';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortItems(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter provider competencies by performance criteria
   */
  static filterProviderCompetencies(
    competencies: ProviderCompetency[],
    request: AnalyticsFilterRequest
  ): FilterResult<ProviderCompetency> {
    return this.withTiming(() => {
      let filtered = [...competencies];

      // Filter by specific provider
      if (request.providerId) {
        filtered = filtered.filter(c => c.providerId === request.providerId);
      }

      // Filter by search (provider name)
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, ['providerName']);
      }

      // Sort by overall accuracy
      const sortBy = request.sortBy || 'overallAccuracy';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortItems(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter data by timeframe relative to current date
   */
  private static filterByTimeframe(
    data: HistoricalPerformance[],
    timeframe: 'week' | 'month' | 'quarter' | 'year'
  ): HistoricalPerformance[] {
    const now = new Date();
    let cutoffDate = new Date();

    switch (timeframe) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter(item => new Date(item.date) >= cutoffDate);
  }

  /**
   * Extract available filter options from analytics data
   */
  static extractFilterOptions(data: {
    historicalData?: HistoricalPerformance[];
    topicCompetencies?: TopicCompetency[];
    providerCompetencies?: ProviderCompetency[];
  }): {
    timeframes: string[];
    providers: string[];
    exams: string[];
    topics: string[];
  } {
    const providers = new Set<string>();
    const exams = new Set<string>();
    const topics = new Set<string>();

    // Extract from topic competencies
    if (data.topicCompetencies) {
      data.topicCompetencies.forEach(comp => {
        providers.add(comp.providerId);
        exams.add(comp.examId);
        topics.add(comp.topicId);
      });
    }

    // Extract from provider competencies
    if (data.providerCompetencies) {
      data.providerCompetencies.forEach(comp => {
        providers.add(comp.providerId);
      });
    }

    return {
      timeframes: ['week', 'month', 'quarter', 'year', 'all'],
      providers: Array.from(providers).sort(),
      exams: Array.from(exams).sort(),
      topics: Array.from(topics).sort()
    };
  }

  /**
   * Validate analytics filter request parameters
   */
  static validateRequest(request: AnalyticsFilterRequest): string[] {
    const errors: string[] = [];

    // Validate timeframe
    if (request.timeframe && !['week', 'month', 'quarter', 'year', 'all'].includes(request.timeframe)) {
      errors.push('Invalid timeframe. Must be: week, month, quarter, year, or all');
    }

    // Validate date range
    if (request.startDate && request.endDate) {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      if (start > end) {
        errors.push('Start date must be before end date');
      }
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