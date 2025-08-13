// Unit tests for UserService

import { UserService } from '../../../src/services/user.service';
import { IUserRepository } from '../../../src/repositories/user.repository';
import { CreateUserRequest, User, UpdateUserRequest } from '../../../src/shared/types/user.types';

// Mock UserRepository
const mockUserRepository: jest.Mocked<IUserRepository> = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    const testUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    const testPasswordHash = '$2b$12$hashedpassword';

    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: testPasswordHash,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should create user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await userService.createUser(testUserData, testPasswordHash);

      expect(result).toMatchObject({
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      });
      expect(result).not.toHaveProperty('passwordHash');

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.create).toHaveBeenCalledWith(testUserData, testPasswordHash);
    });

    it('should throw error for invalid email format', async () => {
      const invalidEmailData = { ...testUserData, email: 'invalid-email' };

      await expect(userService.createUser(invalidEmailData, testPasswordHash)).rejects.toThrow(
        'Invalid email format'
      );

      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(userService.createUser(testUserData, testPasswordHash)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty first name', async () => {
      const invalidData = { ...testUserData, firstName: '' };
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.createUser(invalidData, testPasswordHash)).rejects.toThrow(
        'First name is required'
      );
    });

    it('should throw error for empty last name', async () => {
      const invalidData = { ...testUserData, lastName: '  ' };
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.createUser(invalidData, testPasswordHash)).rejects.toThrow(
        'Last name is required'
      );
    });

    it('should throw error for names that are too long', async () => {
      const longName = 'a'.repeat(51);
      const invalidData = { ...testUserData, firstName: longName };
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.createUser(invalidData, testPasswordHash)).rejects.toThrow(
        'First name must be 50 characters or less'
      );
    });

    it('should throw error for names with invalid characters', async () => {
      const invalidData = { ...testUserData, firstName: 'John123' };
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.createUser(invalidData, testPasswordHash)).rejects.toThrow(
        'First name contains invalid characters'
      );
    });

    it('should allow names with valid special characters', async () => {
      const validData = { ...testUserData, firstName: 'Mary-Jane', lastName: "O'Connor" };
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        ...mockUser,
        firstName: 'Mary-Jane',
        lastName: "O'Connor",
      });

      const result = await userService.createUser(validData, testPasswordHash);

      expect(result.firstName).toBe('Mary-Jane');
      expect(result.lastName).toBe("O'Connor");
    });
  });

  describe('getUserById', () => {
    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashedpassword',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should return user when found and active', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById('test-user-id');

      expect(result).toMatchObject({
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      });
      expect(result).not.toHaveProperty('passwordHash');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('test-user-id');
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      const result = await userService.getUserById('test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashedpassword',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should return full user object including password hash', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await userService.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(result?.passwordHash).toBe('hashedpassword');

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      passwordHash: 'hashedpassword',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
      isActive: true,
      preferences: { studyReminderEmail: true },
    };

    it('should update user successfully', async () => {
      mockUserRepository.update.mockResolvedValue(mockUser);

      const updateData: UpdateUserRequest = {
        firstName: 'Jane',
        lastName: 'Smith',
        preferences: { studyReminderEmail: true },
      };

      const result = await userService.updateUser('test-user-id', updateData);

      expect(result).toMatchObject({
        userId: 'test-user-id',
        firstName: 'Jane',
        lastName: 'Smith',
        preferences: { studyReminderEmail: true },
      });
      expect(result).not.toHaveProperty('passwordHash');

      expect(mockUserRepository.update).toHaveBeenCalledWith('test-user-id', updateData);
    });

    it('should throw error for empty first name update', async () => {
      const updateData = { firstName: '  ' };

      await expect(userService.updateUser('test-user-id', updateData)).rejects.toThrow(
        'First name is required'
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for invalid characters in name update', async () => {
      const updateData = { firstName: 'Jane123' };

      await expect(userService.updateUser('test-user-id', updateData)).rejects.toThrow(
        'First name contains invalid characters'
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      mockUserRepository.delete.mockResolvedValue(true);

      const result = await userService.deactivateUser('test-user-id');

      expect(result).toBe(true);
      expect(mockUserRepository.delete).toHaveBeenCalledWith('test-user-id');
    });

    it('should return false when user not found', async () => {
      mockUserRepository.delete.mockResolvedValue(false);

      const result = await userService.deactivateUser('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('isEmailTaken', () => {
    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: 'hashedpassword',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should return true when email is taken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await userService.isEmailTaken('test@example.com');

      expect(result).toBe(true);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return false when email is not taken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.isEmailTaken('available@example.com');

      expect(result).toBe(false);
    });
  });
});
