// Dedicated mapper for user data transformations
// Extracted from UserService to separate concerns

import { User, UserResponse } from '../shared/types/user.types';
import { DifficultyLevel } from '../shared/types/domain.types';

/**
 * UserMapper - Dedicated mapper for user data transformations
 * 
 * Extracted from UserService to separate concerns and provide standardized
 * transformation patterns for user-related data objects.
 * 
 * @responsibilities
 * - Transform User to UserResponse (removes sensitive fields)
 * - Calculate profile completeness metrics
 * - Handle array transformations for user collections
 */
export class UserMapper {
  /**
   * Convert User to UserResponse (removes sensitive fields like passwordHash)
   * 
   * @param user - Internal user object with all fields
   * @returns Sanitized user response safe for API consumption
   */
  static toUserResponse(user: User): UserResponse {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
      preferences: user.preferences || {
        studyMode: 'practice',
        difficulty: DifficultyLevel.MEDIUM,
        timePerQuestion: 60,
        showExplanations: true,
        shuffleQuestions: false,
        shuffleAnswers: false
      },
      profileCompleteness: this.calculateProfileCompleteness(user),
      lastLoginAt: user.updatedAt // Use updatedAt as proxy for last login
    };
  }

  /**
   * Convert multiple Users to UserResponses
   * 
   * @param users - Array of internal user objects
   * @returns Array of sanitized user responses
   */
  static toUserResponses(users: User[]): UserResponse[] {
    return users.map(user => this.toUserResponse(user));
  }

  /**
   * Calculate profile completeness percentage based on filled fields
   * 
   * @param user - User object to analyze
   * @returns Percentage (0-100) representing profile completeness
   * @private
   */
  private static calculateProfileCompleteness(user: User): number {
    let completeness = 0;
    const totalFields = 6;

    // Required fields
    if (user.email) completeness++;
    if (user.firstName) completeness++;
    if (user.lastName) completeness++;
    if (user.preferences) completeness++;
    
    // Optional fields
    if (user.isActive) completeness++;
    completeness++; // Always count basic profile as partially complete

    return Math.round((completeness / totalFields) * 100);
  }
}
