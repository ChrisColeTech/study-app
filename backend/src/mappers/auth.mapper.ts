// Dedicated mapper for authentication data transformations
// Extracted from AuthService to separate concerns

import { UserResponse } from '../shared/types/user.types';
import { AuthUser, LoginResponse } from '../shared/types/auth.types';
import { TokenGenerationResult } from '../services/token.service';

export class AuthMapper {
  /**
   * Transform UserResponse to AuthUser with default roles and permissions
   */
  static toAuthUser(user: UserResponse): AuthUser {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: ['user'], // Default role - will be expanded in future phases
      permissions: [], // Will be populated based on roles in future phases
    };
  }

  /**
   * Create LoginResponse from AuthUser and token data
   */
  static toLoginResponse(user: AuthUser, tokens: TokenGenerationResult): LoginResponse {
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Combined helper to create LoginResponse from UserResponse and tokens
   */
  static createLoginResponse(user: UserResponse, tokens: TokenGenerationResult): LoginResponse {
    const authUser = this.toAuthUser(user);
    return this.toLoginResponse(authUser, tokens);
  }
}
