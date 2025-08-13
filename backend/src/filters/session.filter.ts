// Session domain filtering logic
// Handles filtering for study sessions, session status, performance data, and session analytics

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { 
  SessionFilters,
  SessionSummary,
  SessionProgress
} from '../shared/types/session.types';
import { StudySession, StatusType } from '../shared/types/domain.types';

export interface SessionFilterRequest extends BaseFilterRequest {
  providerId?: string;
  examId?: string;
  topicId?: string;
  status?: StatusType;
  sessionType?: 'practice' | 'exam' | 'review';
  dateFrom?: string;
  dateTo?: string;
  minAccuracy?: number;
  maxAccuracy?: number;
  minDuration?: number; // minutes
  maxDuration?: number; // minutes
  isAdaptive?: boolean;
  hasTimeLimit?: boolean;
}

/**
 * SessionFilter - Dedicated filter for study sessions and session analytics
 * 
 * Provides filtering capabilities for session status, performance metrics,
 * date ranges, and session characteristics with support for analytics aggregation.
 */
export class SessionFilter extends BaseFilter {
  /**
   * Apply all filters to sessions list based on request
   */
  static applyFilters(sessions: StudySession[], request: SessionFilterRequest): FilterResult<StudySession> {
    return this.withTiming(() => {
      let filtered = [...sessions];

      // Filter by provider
      if (request.providerId) {
        filtered = filtered.filter(s => s.providerId === request.providerId);
      }

      // Filter by exam
      if (request.examId) {
        filtered = filtered.filter(s => s.examId === request.examId);
      }

      // Filter by topic - disabled (topics not in StudySession interface)
      if (request.topicId) {
        // Note: Topic filtering requires topics field in StudySession
        // filtered = filtered.filter(s => s.topics?.includes(request.topicId!) || false);
      }

      // Filter by status
      if (request.status) {
        filtered = this.filterByEnum(filtered, 'status', request.status);
      }

      // Filter by session type - disabled (sessionType not in StudySession interface)
      if (request.sessionType) {
        // Note: Session type filtering requires sessionType field in StudySession
        // filtered = this.filterByEnum(filtered, 'sessionType', request.sessionType);
      }

      // Filter by date range
      if (request.dateFrom || request.dateTo) {
        filtered = this.filterByDateRange(filtered, 'createdAt', request.dateFrom, request.dateTo);
      }

      // Filter by accuracy range
      if (request.minAccuracy !== undefined || request.maxAccuracy !== undefined) {
        filtered = this.filterByAccuracyRange(filtered, request.minAccuracy, request.maxAccuracy);
      }

      // Filter by duration range
      if (request.minDuration !== undefined || request.maxDuration !== undefined) {
        filtered = this.filterByDurationRange(filtered, request.minDuration, request.maxDuration);
      }

      // Filter by adaptive flag
      if (request.isAdaptive !== undefined) {
        filtered = filtered.filter(s => s.isAdaptive === request.isAdaptive);
      }

      // Filter by time limit - disabled (timeLimit not in StudySession interface)
      if (request.hasTimeLimit !== undefined) {
        // Note: Time limit filtering requires timeLimit field in StudySession
        // filtered = filtered.filter(s => {
        //   const hasLimit = s.timeLimit !== undefined && s.timeLimit > 0;
        //   return hasLimit === request.hasTimeLimit;
        // });
      }

      // Filter by search term
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'sessionId', 'examId', 'providerId'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'createdAt';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortSessions(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter sessions by accuracy percentage range
   */
  static filterByAccuracyRange(
    sessions: StudySession[], 
    minAccuracy?: number, 
    maxAccuracy?: number
  ): StudySession[] {
    return sessions.filter(session => {
      // Only consider completed sessions for accuracy filtering
      if (session.status !== 'completed') return true;
      
      const accuracy = this.calculateSessionAccuracy(session);
      if (minAccuracy !== undefined && accuracy < minAccuracy) return false;
      if (maxAccuracy !== undefined && accuracy > maxAccuracy) return false;
      return true;
    });
  }

  /**
   * Filter sessions by duration range (in minutes)
   */
  static filterByDurationRange(
    sessions: StudySession[], 
    minDuration?: number, 
    maxDuration?: number
  ): StudySession[] {
    return sessions.filter(session => {
      const duration = this.calculateSessionDuration(session);
      if (minDuration !== undefined && duration < minDuration) return false;
      if (maxDuration !== undefined && duration > maxDuration) return false;
      return true;
    });
  }

  /**
   * Calculate session accuracy percentage
   */
  private static calculateSessionAccuracy(session: StudySession): number {
    if (session.totalQuestions === 0) return 0;
    return (session.correctAnswers / session.totalQuestions) * 100;
  }

  /**
   * Calculate session duration in minutes
   */
  private static calculateSessionDuration(session: StudySession): number {
    if (!session.endTime || !session.startTime) return 0;
    
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  /**
   * Sort sessions with custom sorting logic
   */
  static sortSessions(sessions: StudySession[], sortBy: string, sortOrder: string): StudySession[] {
    return [...sessions].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'created':
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'completed':
        case 'completedAt':
          // Note: Using endTime instead of completedAt since it's not in StudySession
          const aCompleted = a.endTime ? new Date(a.endTime).getTime() : 0;
          const bCompleted = b.endTime ? new Date(b.endTime).getTime() : 0;
          comparison = aCompleted - bCompleted;
          break;
        case 'accuracy':
          comparison = this.calculateSessionAccuracy(a) - this.calculateSessionAccuracy(b);
          break;
        case 'duration':
          comparison = this.calculateSessionDuration(a) - this.calculateSessionDuration(b);
          break;
        case 'questionCount':
          comparison = a.totalQuestions - b.totalQuestions;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get session performance statistics
   */
  static getSessionStats(sessions: StudySession[]): {
    total: number;
    completed: number;
    active: number;
    abandoned: number;
    averageAccuracy: number;
    averageDuration: number; // minutes
    totalStudyTime: number; // minutes
    completionRate: number;
  } {
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === StatusType.COMPLETED).length;
    const active = sessions.filter(s => s.status === StatusType.ACTIVE).length;
    const abandoned = sessions.filter(s => s.status === StatusType.ABANDONED).length;

    const completedSessions = sessions.filter(s => s.status === StatusType.COMPLETED);
    let totalAccuracy = 0;
    let totalDuration = 0;

    completedSessions.forEach(session => {
      totalAccuracy += this.calculateSessionAccuracy(session);
      totalDuration += this.calculateSessionDuration(session);
    });

    return {
      total,
      completed,
      active,
      abandoned,
      averageAccuracy: completedSessions.length > 0 ? Math.round(totalAccuracy / completedSessions.length) : 0,
      averageDuration: completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0,
      totalStudyTime: Math.round(totalDuration),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Group sessions by time period for analytics
   */
  static groupSessionsByPeriod(
    sessions: StudySession[], 
    period: 'day' | 'week' | 'month'
  ): Record<string, StudySession[]> {
    const groups: Record<string, StudySession[]> = {};

    sessions.forEach(session => {
      const date = new Date(session.createdAt);
      let key = '';

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const year = date.getFullYear();
          const week = this.getWeekNumber(date);
          key = `${year}-W${week.toString().padStart(2, '0')}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(session);
    });

    return groups;
  }

  /**
   * Get week number for date
   */
  private static getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil(days / 7);
  }

  /**
   * Extract available filter options from sessions list
   */
  static extractFilterOptions(sessions: StudySession[]): {
    providers: string[];
    exams: string[];
    topics: string[];
    statuses: string[];
    sessionTypes: string[];
    accuracyRanges: { min: number; max: number }[];
    durationRanges: { min: number; max: number }[];
  } {
    const providers = this.extractUniqueValues(sessions, 'providerId');
    const exams = this.extractUniqueValues(sessions, 'examId');
    
    // Extract unique topics - disabled (topics not in StudySession interface)
    const allTopics = new Set<string>();
    // sessions.forEach(s => {
    //   (s.topics || []).forEach(topic => allTopics.add(topic));
    // });

    // Calculate ranges
    const accuracies = sessions
      .filter(s => s.status === StatusType.COMPLETED)
      .map(s => this.calculateSessionAccuracy(s));
    
    const durations = sessions
      .filter(s => s.status === StatusType.COMPLETED)
      .map(s => this.calculateSessionDuration(s));

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      topics: Array.from(allTopics).sort(),
      statuses: Object.values(StatusType),
      sessionTypes: ['practice', 'exam', 'review'],
      accuracyRanges: this.createPercentageRanges(accuracies),
      durationRanges: this.createDurationRanges(durations)
    };
  }

  /**
   * Create accuracy percentage ranges
   */
  private static createPercentageRanges(values: number[]): { min: number; max: number }[] {
    return [
      { min: 0, max: 25 },
      { min: 25, max: 50 },
      { min: 50, max: 75 },
      { min: 75, max: 90 },
      { min: 90, max: 100 }
    ];
  }

  /**
   * Create duration ranges in minutes
   */
  private static createDurationRanges(values: number[]): { min: number; max: number }[] {
    return [
      { min: 0, max: 15 },      // Under 15 minutes
      { min: 15, max: 30 },     // 15-30 minutes
      { min: 30, max: 60 },     // 30-60 minutes
      { min: 60, max: 120 },    // 1-2 hours
      { min: 120, max: 999999 } // Over 2 hours
    ];
  }

  /**
   * Validate session filter request parameters
   */
  static validateRequest(request: SessionFilterRequest): string[] {
    const errors: string[] = [];

    // Validate status
    const validStatuses = Object.values(StatusType);
    if (request.status && !validStatuses.includes(request.status)) {
      errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate session type
    const validTypes = ['practice', 'exam', 'review'];
    if (request.sessionType && !validTypes.includes(request.sessionType)) {
      errors.push(`Invalid session type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate accuracy range
    if (request.minAccuracy !== undefined && (request.minAccuracy < 0 || request.minAccuracy > 100)) {
      errors.push('Minimum accuracy must be between 0 and 100');
    }
    if (request.maxAccuracy !== undefined && (request.maxAccuracy < 0 || request.maxAccuracy > 100)) {
      errors.push('Maximum accuracy must be between 0 and 100');
    }
    if (request.minAccuracy !== undefined && request.maxAccuracy !== undefined && 
        request.minAccuracy > request.maxAccuracy) {
      errors.push('Minimum accuracy must be less than or equal to maximum accuracy');
    }

    // Validate duration range
    if (request.minDuration !== undefined && request.minDuration < 0) {
      errors.push('Minimum duration must be non-negative');
    }
    if (request.maxDuration !== undefined && request.maxDuration < 0) {
      errors.push('Maximum duration must be non-negative');
    }
    if (request.minDuration !== undefined && request.maxDuration !== undefined && 
        request.minDuration > request.maxDuration) {
      errors.push('Minimum duration must be less than or equal to maximum duration');
    }

    // Validate date range
    if (request.dateFrom && request.dateTo) {
      const start = new Date(request.dateFrom);
      const end = new Date(request.dateTo);
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