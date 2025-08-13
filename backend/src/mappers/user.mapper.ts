// Dedicated mapper for user data transformations
// Extracted from UserService to separate concerns

import { User, UserResponse } from '../shared/types/user.types';
import { DifficultyLevel } from '../shared/types/domain.types';

export class UserMapper {
  /**
   * Convert User to UserResponse (removes sensitive fields like passwordHash)
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
   * Calculate profile completeness percentage
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

  /**
   * Convert multiple Users to UserResponses
   */
  static toUserResponses(users: User[]): UserResponse[] {
    return users.map(user => this.toUserResponse(user));
  }
}
