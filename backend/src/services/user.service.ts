// Refactored user service using focused validators and mappers
// Eliminates mixed validation/business logic concerns

import { IUserRepository } from '../repositories/user.repository';
import { User, CreateUserRequest, UpdateUserRequest, UserResponse } from '../shared/types/user.types';
import { UserValidator } from '../validators/user.validator';
import { UserMapper } from '../mappers/user.mapper';
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
      // Validate user data using dedicated validator
      UserValidator.validateCreateUserOrThrow(userData);

      // Check if email is already taken
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        this.logger.warn('Attempt to create user with existing email', { email: userData.email });
        throw new Error('User with this email already exists');
      }

      // Create user
      const user = await this.userRepository.create(userData, passwordHash);

      // Convert to UserResponse using dedicated mapper
      const userResponse = UserMapper.toUserResponse(user);
      
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

      return UserMapper.toUserResponse(user);
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
      // Validate update data using dedicated validator
      UserValidator.validateUpdateUserOrThrow(updateData);

      // Update user
      const updatedUser = await this.userRepository.update(userId, updateData);

      // Convert to UserResponse using dedicated mapper
      const userResponse = UserMapper.toUserResponse(updatedUser);
      
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

}