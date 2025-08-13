// User domain filtering logic
// Handles filtering for user management, activity tracking, and user analytics

import { BaseFilter, FilterResult, BaseFilterRequest } from './base.filter';
import { UserResponse, CreateUserRequest } from '../shared/types/user.types';

export interface UserFilterRequest extends BaseFilterRequest {
  isActive?: boolean;
  registeredAfter?: string;
  registeredBefore?: string;
  lastLoginAfter?: string;
  lastLoginBefore?: string;
  language?: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  minProfileCompleteness?: number;
  maxProfileCompleteness?: number;
  hasAvatar?: boolean;
  emailDomain?: string;
}

/**
 * UserFilter - Dedicated filter for user management and user analytics
 * 
 * Provides filtering capabilities for user lists, activity tracking, registration dates,
 * profile completeness, and user segmentation with administrative features.
 */
export class UserFilter extends BaseFilter {
  /**
   * Apply all filters to users list based on request (for admin use)
   */
  static applyFilters(users: UserResponse[], request: UserFilterRequest): FilterResult<UserResponse> {
    return this.withTiming(() => {
      let filtered = [...users];

      // Filter by active status
      if (request.isActive !== undefined) {
        filtered = filtered.filter(user => user.isActive === request.isActive);
      }

      // Filter by registration date range
      if (request.registeredAfter || request.registeredBefore) {
        filtered = this.filterByDateRange(
          filtered, 
          'createdAt', 
          request.registeredAfter, 
          request.registeredBefore
        );
      }

      // Filter by last login date range
      if (request.lastLoginAfter || request.lastLoginBefore) {
        filtered = this.filterByLastLoginRange(filtered, request.lastLoginAfter, request.lastLoginBefore);
      }

      // Filter by language preference - simplified
      if (request.language) {
        // Note: Language filtering requires proper UserPreferences interface
        // For now, this filter is disabled
        // filtered = filtered.filter(user => user.preferences?.language === request.language);
      }

      // Filter by profile completeness range
      if (request.minProfileCompleteness !== undefined || request.maxProfileCompleteness !== undefined) {
        filtered = this.filterByProfileCompleteness(
          filtered, 
          request.minProfileCompleteness, 
          request.maxProfileCompleteness
        );
      }

      // Filter by avatar presence - disabled (avatarUrl not in UserResponse)
      if (request.hasAvatar !== undefined) {
        // Note: Avatar filtering requires avatarUrl field in UserResponse
        // filtered = filtered.filter(user => {
        //   const hasAvatar = user.avatarUrl !== undefined && user.avatarUrl !== null;
        //   return hasAvatar === request.hasAvatar;
        // });
      }

      // Filter by email domain
      if (request.emailDomain) {
        const domain = request.emailDomain.toLowerCase();
        filtered = filtered.filter(user => 
          user.email.toLowerCase().endsWith(`@${domain}`)
        );
      }

      // Filter by search term (name and email)
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'firstName', 'lastName', 'email'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'createdAt';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortUsers(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Apply filters to user responses (public-safe version)
   */
  static applyUserResponseFilters(
    users: UserResponse[], 
    request: UserFilterRequest
  ): FilterResult<UserResponse> {
    return this.withTiming(() => {
      let filtered = [...users];

      // Filter by active status
      if (request.isActive !== undefined) {
        filtered = filtered.filter(user => user.isActive === request.isActive);
      }

      // Filter by registration date range
      if (request.registeredAfter || request.registeredBefore) {
        filtered = this.filterByDateRange(
          filtered, 
          'createdAt', 
          request.registeredAfter, 
          request.registeredBefore
        );
      }

      // Filter by last login date range
      if (request.lastLoginAfter || request.lastLoginBefore) {
        filtered = this.filterByLastLoginRange(filtered, request.lastLoginAfter, request.lastLoginBefore);
      }

      // Filter by language preference - simplified
      if (request.language) {
        // Note: Language filtering requires proper UserPreferences interface
        // For now, this filter is disabled
        // filtered = filtered.filter(user => user.preferences?.language === request.language);
      }

      // Filter by profile completeness range
      if (request.minProfileCompleteness !== undefined || request.maxProfileCompleteness !== undefined) {
        filtered = this.filterByProfileCompleteness(
          filtered, 
          request.minProfileCompleteness, 
          request.maxProfileCompleteness
        );
      }

      // Filter by search term (name and email)
      if (request.search) {
        filtered = this.filterBySearch(filtered, request.search, [
          'firstName', 'lastName', 'email'
        ]);
      }

      // Apply sorting
      const sortBy = request.sortBy || 'createdAt';
      const sortOrder = request.sortOrder || 'desc';
      filtered = this.sortUserResponses(filtered, sortBy, sortOrder);

      return {
        filtered: this.paginate(filtered, request.limit, request.offset),
        total: filtered.length
      };
    });
  }

  /**
   * Filter users by last login date range
   */
  static filterByLastLoginRange(
    users: UserResponse[], 
    afterDate?: string, 
    beforeDate?: string
  ): UserResponse[] {
    return users.filter(user => {
      const lastLogin = user.lastLoginAt;
      if (!lastLogin) return false; // Exclude users who have never logged in
      
      const loginDate = new Date(lastLogin);
      if (afterDate && loginDate < new Date(afterDate)) return false;
      if (beforeDate && loginDate > new Date(beforeDate)) return false;
      return true;
    });
  }

  /**
   * Filter users by profile completeness percentage
   */
  static filterByProfileCompleteness(
    users: UserResponse[], 
    minCompleteness?: number, 
    maxCompleteness?: number
  ): UserResponse[] {
    return users.filter(user => {
      const completeness = this.calculateProfileCompleteness(user);
      if (minCompleteness !== undefined && completeness < minCompleteness) return false;
      if (maxCompleteness !== undefined && completeness > maxCompleteness) return false;
      return true;
    });
  }

  /**
   * Calculate profile completeness percentage
   */
  private static calculateProfileCompleteness(user: UserResponse): number {
    let completed = 0;
    let total = 8; // Total number of profile fields

    // Required fields (always count as completed if user exists)
    completed += 2; // email, createdAt

    // Optional fields
    if (user.firstName) completed++;
    if (user.lastName) completed++;
    if (user.profileCompleteness > 0) completed++; // Use the actual field from UserResponse
    // Note: Other fields like bio, avatarUrl, timezone not available in UserResponse

    return Math.round((completed / total) * 100);
  }

  /**
   * Sort users with custom sorting logic
   */
  static sortUsers(users: UserResponse[], sortBy: string, sortOrder: string): UserResponse[] {
    return [...users].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'firstName':
          comparison = a.firstName.localeCompare(b.firstName);
          break;
        case 'lastName':
          comparison = a.lastName.localeCompare(b.lastName);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'createdAt':
        case 'registered':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'lastLogin':
        case 'lastLoginAt':
          const aLogin = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          const bLogin = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          comparison = aLogin - bLogin;
          break;
        case 'profileCompleteness':
          comparison = this.calculateProfileCompleteness(a) - this.calculateProfileCompleteness(b);
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Sort user responses with custom sorting logic
   */
  static sortUserResponses(users: UserResponse[], sortBy: string, sortOrder: string): UserResponse[] {
    return [...users].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'firstName':
          comparison = a.firstName.localeCompare(b.firstName);
          break;
        case 'lastName':
          comparison = a.lastName.localeCompare(b.lastName);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'createdAt':
        case 'registered':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'lastLogin':
        case 'lastLoginAt':
          const aLogin = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          const bLogin = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          comparison = aLogin - bLogin;
          break;
        case 'profileCompleteness':
          comparison = a.profileCompleteness - b.profileCompleteness;
          break;
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get user statistics for admin dashboard
   */
  static getUserStats(users: UserResponse[]): {
    total: number;
    active: number;
    inactive: number;
    recentRegistrations: number; // Last 7 days
    recentLogins: number; // Last 7 days
    byLanguage: Record<string, number>;
    byProfileCompleteness: Record<string, number>;
    averageProfileCompleteness: number;
    registrationTrend: { date: string; count: number }[];
  } {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      total: users.length,
      active: 0,
      inactive: 0,
      recentRegistrations: 0,
      recentLogins: 0,
      byLanguage: {} as Record<string, number>,
      byProfileCompleteness: { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 } as Record<string, number>,
      averageProfileCompleteness: 0,
      registrationTrend: [] as { date: string; count: number }[]
    };

    let totalCompleteness = 0;

    users.forEach(user => {
      // Count active/inactive
      if (user.isActive) {
        stats.active++;
      } else {
        stats.inactive++;
      }

      // Count recent registrations
      if (new Date(user.createdAt) >= sevenDaysAgo) {
        stats.recentRegistrations++;
      }

      // Count recent logins
      if (user.lastLoginAt && new Date(user.lastLoginAt) >= sevenDaysAgo) {
        stats.recentLogins++;
      }

      // Count by language - disabled (preferences not fully available)
      const language = 'unknown'; // user.preferences?.language not available
      stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

      // Count by profile completeness
      const completeness = this.calculateProfileCompleteness(user);
      totalCompleteness += completeness;

      if (completeness <= 25) stats.byProfileCompleteness['0-25']++;
      else if (completeness <= 50) stats.byProfileCompleteness['26-50']++;
      else if (completeness <= 75) stats.byProfileCompleteness['51-75']++;
      else stats.byProfileCompleteness['76-100']++;
    });

    stats.averageProfileCompleteness = users.length > 0 ? 
      Math.round(totalCompleteness / users.length) : 0;

    // Generate 30-day registration trend
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = users.filter(user => 
        user.createdAt.startsWith(dateStr)
      ).length;
      
      stats.registrationTrend.push({ date: dateStr, count });
    }

    return stats;
  }

  /**
   * Group users by specified criteria
   */
  static groupUsersBy(
    users: UserResponse[], 
    groupBy: 'language' | 'registrationMonth' | 'profileCompleteness' | 'domain'
  ): Record<string, UserResponse[]> {
    const groups: Record<string, UserResponse[]> = {};

    users.forEach(user => {
      let key = '';
      
      switch (groupBy) {
        case 'language':
          key = 'unknown'; // user.preferences?.language not available
          break;
        case 'registrationMonth':
          const date = new Date(user.createdAt);
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'profileCompleteness':
          const completeness = this.calculateProfileCompleteness(user);
          if (completeness <= 25) key = '0-25%';
          else if (completeness <= 50) key = '26-50%';
          else if (completeness <= 75) key = '51-75%';
          else key = '76-100%';
          break;
        case 'domain':
          key = user.email.split('@')[1] || 'unknown';
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(user);
    });

    return groups;
  }

  /**
   * Extract available filter options from users list
   */
  static extractFilterOptions(users: UserResponse[]): {
    languages: string[];
    emailDomains: string[];
    registrationYears: number[];
    profileCompletenessRanges: { min: number; max: number }[];
  } {
    const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja']; // Static list since preferences not available

    const domains = users.map(u => u.email.split('@')[1]).filter(d => d);
    const uniqueDomains = Array.from(new Set(domains));

    const years = users.map(u => new Date(u.createdAt).getFullYear());
    const uniqueYears = Array.from(new Set(years));

    return {
      languages: languages.sort(),
      emailDomains: uniqueDomains.sort(),
      registrationYears: uniqueYears.sort(),
      profileCompletenessRanges: [
        { min: 0, max: 25 },
        { min: 26, max: 50 },
        { min: 51, max: 75 },
        { min: 76, max: 100 }
      ]
    };
  }

  /**
   * Validate user filter request parameters
   */
  static validateRequest(request: UserFilterRequest): string[] {
    const errors: string[] = [];

    // Validate language
    const validLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
    if (request.language && !validLanguages.includes(request.language)) {
      errors.push(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
    }

    // Validate profile completeness range
    if (request.minProfileCompleteness !== undefined && 
        (request.minProfileCompleteness < 0 || request.minProfileCompleteness > 100)) {
      errors.push('Minimum profile completeness must be between 0 and 100');
    }
    if (request.maxProfileCompleteness !== undefined && 
        (request.maxProfileCompleteness < 0 || request.maxProfileCompleteness > 100)) {
      errors.push('Maximum profile completeness must be between 0 and 100');
    }
    if (request.minProfileCompleteness !== undefined && request.maxProfileCompleteness !== undefined && 
        request.minProfileCompleteness > request.maxProfileCompleteness) {
      errors.push('Minimum profile completeness must be less than or equal to maximum');
    }

    // Validate date ranges
    if (request.registeredAfter && request.registeredBefore) {
      const start = new Date(request.registeredAfter);
      const end = new Date(request.registeredBefore);
      if (start > end) {
        errors.push('Registration start date must be before end date');
      }
    }

    if (request.lastLoginAfter && request.lastLoginBefore) {
      const start = new Date(request.lastLoginAfter);
      const end = new Date(request.lastLoginBefore);
      if (start > end) {
        errors.push('Last login start date must be before end date');
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