// Dedicated mapper for authentication data transformations
// Extracted from AuthService to separate concerns

import { UserResponse } from '../shared/types/user.types';
import { AuthUser, LoginResponse } from '../shared/types/auth.types';
import { TokenGenerationResult } from '../services/token.service';

/**
 * AuthMapper - Dedicated mapper for authentication data transformations
 * 
 * Extracted from AuthService to separate concerns and provide standardized
 * transformation patterns for authentication-related data objects.
 * 
 * @responsibilities
 * - Transform UserResponse to AuthUser objects
 * - Create LoginResponse objects from user and token data  
 * - Provide combined helper methods for common auth transformations
 */
export class AuthMapper {
  /**
   * Transform UserResponse to AuthUser with default roles and permissions
   * 
   * @param user - User response object from user service
   * @returns AuthUser object with roles and permissions
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
   * 
   * @param user - Authenticated user object  
   * @param tokens - Token generation result from token service
   * @returns Complete login response with user data and tokens
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
   * 
   * @param user - User response from user service
   * @param tokens - Token generation result from token service  
   * @returns Complete login response with transformed user data and tokens
   */
  static createLoginResponse(user: UserResponse, tokens: TokenGenerationResult): LoginResponse {
    const authUser = this.toAuthUser(user);
    return this.toLoginResponse(authUser, tokens);
  }
}
