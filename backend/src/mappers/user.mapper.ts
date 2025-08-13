// Dedicated mapper for user data transformations
// Extracted from UserService to separate concerns

import { User, UserResponse } from '../shared/types/user.types';

export class UserMapper {
  /**
   * Convert User to UserResponse (removes sensitive fields like passwordHash)
   */
  static toUserResponse(user: User): UserResponse {
    const response: UserResponse = {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
    };

    // Include optional preferences if they exist
    if (user.preferences) {
      response.preferences = user.preferences;
    }

    return response;
  }

  /**
   * Convert multiple Users to UserResponses
   */
  static toUserResponses(users: User[]): UserResponse[] {
    return users.map(user => this.toUserResponse(user));
  }
}
