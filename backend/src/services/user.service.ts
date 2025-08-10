// User service for business logic operations

import { IUserRepository } from '../repositories/user.repository';
import { User, CreateUserRequest, UpdateUserRequest, UserResponse } from '../shared/types/user.types';
import { createLogger } from '../shared/logger';

export interface IUserService {
  createUser(userData: CreateUserRequest, passwordHash: string): Promise<UserResponse>;
  getUserById(userId: string): Promise<UserResponse | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(userId: string, updateData: UpdateUserRequest): Promise<UserResponse>;
  deactivateUser(userId: string): Promise<boolean>;
  isEmailTaken(email: string): Promise<boolean>;
}

export class UserService implements IUserService {
  private logger = createLogger({ component: 'UserService' });

  constructor(private userRepository: IUserRepository) {}

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest, passwordHash: string): Promise<UserResponse> {
    this.logger.info('Creating new user', { email: userData.email });

    try {
      // Validate email format
      if (!this.isValidEmail(userData.email)) {
        throw new Error('Invalid email format');
      }

      // Check if email is already taken
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        this.logger.warn('Attempt to create user with existing email', { email: userData.email });
        throw new Error('User with this email already exists');
      }

      // Validate required fields
      this.validateUserData(userData);

      // Create user
      const user = await this.userRepository.create(userData, passwordHash);

      // Convert to UserResponse (exclude passwordHash)
      const userResponse = this.toUserResponse(user);
      
      this.logger.info('User created successfully', { 
        userId: user.userId, 
        email: user.email 
      });

      return userResponse;
    } catch (error) {
      this.logger.error('Failed to create user', error as Error, { email: userData.email });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    this.logger.debug('Fetching user by ID', { userId });

    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        this.logger.debug('User not found', { userId });
        return null;
      }

      if (!user.isActive) {
        this.logger.debug('User is deactivated', { userId });
        return null;
      }

      return this.toUserResponse(user);
    } catch (error) {
      this.logger.error('Failed to fetch user by ID', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user by email (returns full User object for authentication purposes)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    this.logger.debug('Fetching user by email', { email });

    try {
      const user = await this.userRepository.findByEmail(email);
      
      if (!user) {
        this.logger.debug('User not found', { email });
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('Failed to fetch user by email', error as Error, { email });
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updateData: UpdateUserRequest): Promise<UserResponse> {
    this.logger.info('Updating user', { userId, fields: Object.keys(updateData) });

    try {
      // Validate update data
      this.validateUpdateData(updateData);

      // Update user
      const updatedUser = await this.userRepository.update(userId, updateData);

      const userResponse = this.toUserResponse(updatedUser);
      
      this.logger.info('User updated successfully', { userId });
      
      return userResponse;
    } catch (error) {
      this.logger.error('Failed to update user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<boolean> {
    this.logger.info('Deactivating user', { userId });

    try {
      const result = await this.userRepository.delete(userId);
      
      if (result) {
        this.logger.info('User deactivated successfully', { userId });
      } else {
        this.logger.warn('User not found for deactivation', { userId });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to deactivate user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Check if email is already taken
   */
  async isEmailTaken(email: string): Promise<boolean> {
    try {
      const existingUser = await this.userRepository.findByEmail(email);
      return !!existingUser;
    } catch (error) {
      this.logger.error('Failed to check email availability', error as Error, { email });
      throw error;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate user registration data
   */
  private validateUserData(userData: CreateUserRequest): void {
    if (!userData.firstName || !userData.firstName.trim()) {
      throw new Error('First name is required');
    }

    if (!userData.lastName || !userData.lastName.trim()) {
      throw new Error('Last name is required');
    }

    if (userData.firstName.trim().length > 50) {
      throw new Error('First name must be 50 characters or less');
    }

    if (userData.lastName.trim().length > 50) {
      throw new Error('Last name must be 50 characters or less');
    }

    // Validate name contains only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(userData.firstName.trim())) {
      throw new Error('First name contains invalid characters');
    }

    if (!nameRegex.test(userData.lastName.trim())) {
      throw new Error('Last name contains invalid characters');
    }
  }

  /**
   * Validate user update data
   */
  private validateUpdateData(updateData: UpdateUserRequest): void {
    if (updateData.firstName !== undefined) {
      if (!updateData.firstName || !updateData.firstName.trim()) {
        throw new Error('First name cannot be empty');
      }
      if (updateData.firstName.trim().length > 50) {
        throw new Error('First name must be 50 characters or less');
      }
      const nameRegex = /^[a-zA-Z\s\-']+$/;
      if (!nameRegex.test(updateData.firstName.trim())) {
        throw new Error('First name contains invalid characters');
      }
    }

    if (updateData.lastName !== undefined) {
      if (!updateData.lastName || !updateData.lastName.trim()) {
        throw new Error('Last name cannot be empty');
      }
      if (updateData.lastName.trim().length > 50) {
        throw new Error('Last name must be 50 characters or less');
      }
      const nameRegex = /^[a-zA-Z\s\-']+$/;
      if (!nameRegex.test(updateData.lastName.trim())) {
        throw new Error('Last name contains invalid characters');
      }
    }
  }

  /**
   * Convert User to UserResponse (removes sensitive fields)
   */
  private toUserResponse(user: User): UserResponse {
    const response: UserResponse = {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
    };

    if (user.preferences) {
      response.preferences = user.preferences;
    }

    return response;
  }
}