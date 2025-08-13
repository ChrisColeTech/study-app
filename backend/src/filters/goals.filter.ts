// Goals domain filtering logic  
// Handles filtering for user goals, goal progress, priorities, and status management

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { 
  Goal, 
  GetGoalsRequest,
  GoalType,
  GoalPriority, 
  GoalStatus,
  GoalTargetType
} from '../shared/types/goals.types';

export interface GoalsFilterRequest extends BaseFilterRequest {
  status?: GoalStatus[];
  type?: GoalType[];
  priority?: GoalPriority[];
  examId?: string;
  topicId?: string;
  providerId?: string;
  isArchived?: boolean;
  dueSoon?: boolean; // Goals due within next 7 days
  overdue?: boolean; // Goals past deadline
}

/**
 * GoalsFilter - Dedicated filter for user goals and goal management
 * 
 * Provides filtering capabilities for goal status, type, priority, deadlines,
 * and progress tracking with support for archived goals and date-based filtering.
 */
export class GoalsFilter extends BaseFilter {
  /**
   * Apply all filters to goals list based on request
   */
  static applyFilters(goals: Goal[], request: GoalsFilterRequest): FilterResult<Goal> {
    return this.withTiming(() => {
      let filtered = [...goals];

      // Filter by archived status
      filtered = this.filterByArchivedStatus(filtered, request.isArchived);

      // Filter by status
      if (request.status && request.status.length > 0) {
        filtered = this.filterByEnum(filtered, 'status', request.status);
      }

      // Filter by type
      if (request.type && request.type.length > 0) {
        filtered = this.filterByEnum(filtered, 'type', request.type);
      }

      // Filter by priority
      if (request.priority && request.priority.length > 0) {
        filtered = this.filterByEnum(filtered, 'priority', request.priority);
      }

      // Filter by exam, topic, or provider
      if (request.examId) {
        filtered = filtered.filter(goal => goal.examId === request.examId);
      }

      if (request.topicId) {
        filtered = filtered.filter(goal => goal.topicId === request.topicId);
      }

      if (request.providerId) {
        filtered = filtered.filter(goal => goal.providerId === request.providerId);
      }

      // Filter by due date conditions
      if (request.dueSoon) {
        filtered = this.filterDueSoon(filtered);
      }

      if (request.overdue) {
        filtered = this.filterOverdue(filtered);
      }

      // Filter by search term
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'title', 'description'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'createdAt';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortGoals(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter goals by archived status
   */
  static filterByArchivedStatus(goals: Goal[], isArchived?: boolean): Goal[] {
    if (isArchived === undefined) return goals;
    return goals.filter(goal => goal.isArchived === isArchived);
  }

  /**
   * Filter goals that are due within the next 7 days
   */
  static filterDueSoon(goals: Goal[]): Goal[] {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return goals.filter(goal => {
      if (!goal.deadline) return false;
      const deadline = new Date(goal.deadline);
      return deadline <= sevenDaysFromNow && deadline >= new Date();
    });
  }

  /**
   * Filter goals that are overdue (past deadline)
   */
  static filterOverdue(goals: Goal[]): Goal[] {
    const now = new Date();
    
    return goals.filter(goal => {
      if (!goal.deadline || goal.status === 'completed') return false;
      return new Date(goal.deadline) < now;
    });
  }

  /**
   * Sort goals with custom sorting logic
   */
  static sortGoals(goals: Goal[], sortBy: string, sortOrder: string): Goal[] {
    return [...goals].sort((a, b) => {
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
        case 'deadline':
          const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          comparison = aDeadline - bDeadline;
          break;
        case 'priority':
          comparison = this.comparePriorities(a.priority, b.priority);
          break;
        case 'progress':
        case 'progressPercentage':
          comparison = a.progressPercentage - b.progressPercentage;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Compare goal priorities for proper ordering (high > medium > low)
   */
  private static comparePriorities(priorityA: GoalPriority, priorityB: GoalPriority): number {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const orderA = priorityOrder[priorityA] || 0;
    const orderB = priorityOrder[priorityB] || 0;
    return orderB - orderA; // High priority first
  }

  /**
   * Get goal completion statistics
   */
  static getCompletionStats(goals: Goal[]): {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
    completionRate: number;
  } {
    const total = goals.length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const inProgress = goals.filter(g => g.status === 'active').length;
    const notStarted = goals.filter(g => g.status === 'paused').length;
    const overdue = this.filterOverdue(goals).length;
    
    return {
      total,
      completed,
      inProgress: inProgress, // active goals
      notStarted: notStarted, // paused goals  
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Extract available filter options from goals list
   */
  static extractFilterOptions(goals: Goal[]): {
    statuses: GoalStatus[];
    types: GoalType[];
    priorities: GoalPriority[];
    providers: string[];
    exams: string[];
    topics: string[];
  } {
    const providers = this.extractUniqueValues(goals, 'providerId', id => id !== undefined);
    const exams = this.extractUniqueValues(goals, 'examId', id => id !== undefined);
    const topics = this.extractUniqueValues(goals, 'topicId', id => id !== undefined);

    return {
      statuses: ['active', 'completed', 'paused', 'abandoned'] as GoalStatus[],
      types: ['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'] as GoalType[],
      priorities: ['high', 'medium', 'low'] as GoalPriority[],
      providers: providers.sort(),
      exams: exams.sort(),
      topics: topics.sort()
    };
  }

  /**
   * Group goals by category for dashboard display
   */
  static groupGoalsByCategory(goals: Goal[]): {
    byStatus: Record<GoalStatus, Goal[]>;
    byPriority: Record<GoalPriority, Goal[]>;
    byType: Record<GoalType, Goal[]>;
    upcoming: Goal[]; // Due within 7 days
    overdue: Goal[];
  } {
    const byStatus = {} as Record<GoalStatus, Goal[]>;
    const byPriority = {} as Record<GoalPriority, Goal[]>;
    const byType = {} as Record<GoalType, Goal[]>;

    // Initialize categories
    (['active', 'completed', 'paused', 'abandoned'] as GoalStatus[])
      .forEach(status => { byStatus[status] = []; });
    (['high', 'medium', 'low'] as GoalPriority[])
      .forEach(priority => { byPriority[priority] = []; });
    (['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'] as GoalType[])
      .forEach(type => { byType[type] = []; });

    // Group goals
    goals.forEach(goal => {
      byStatus[goal.status].push(goal);
      byPriority[goal.priority].push(goal);
      byType[goal.type].push(goal);
    });

    return {
      byStatus,
      byPriority,
      byType,
      upcoming: this.filterDueSoon(goals),
      overdue: this.filterOverdue(goals)
    };
  }

  /**
   * Validate goals filter request parameters
   */
  static validateRequest(request: GoalsFilterRequest): string[] {
    const errors: string[] = [];

    // Validate status values
    const validStatuses = ['active', 'completed', 'paused', 'abandoned'];
    if (request.status) {
      const invalidStatuses = request.status.filter(s => !validStatuses.includes(s));
      if (invalidStatuses.length > 0) {
        errors.push(`Invalid status values: ${invalidStatuses.join(', ')}`);
      }
    }

    // Validate type values
    const validTypes = ['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'];
    if (request.type) {
      const invalidTypes = request.type.filter(t => !validTypes.includes(t));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid type values: ${invalidTypes.join(', ')}`);
      }
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    if (request.priority) {
      const invalidPriorities = request.priority.filter(p => !validPriorities.includes(p));
      if (invalidPriorities.length > 0) {
        errors.push(`Invalid priority values: ${invalidPriorities.join(', ')}`);
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