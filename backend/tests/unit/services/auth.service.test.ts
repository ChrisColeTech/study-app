// Unit tests for AuthService

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../../../src/services/auth.service';
import { IUserService } from '../../../src/services/user.service';
import { CreateUserRequest, UserResponse, User } from '../../../src/shared/types/user.types';
import { LoginRequest } from '../../../src/shared/types/auth.types';

// Mock UserService
const mockUserService: jest.Mocked<IUserService> = {
  createUser: jest.fn(),
  getUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  deactivateUser: jest.fn(),
  isEmailTaken: jest.fn(),
};

// Mock bcryptjs
jest.mock('bcryptjs');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    // Create service instance
    authService = new AuthService(mockUserService);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
  });

  describe('registerUser', () => {
    const testUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockUserResponse: UserResponse = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should register user successfully', async () => {
      const hashedPassword = '$2b$12$hashedpassword';
      const mockToken = 'mock-jwt-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockUserService.createUser.mockResolvedValue(mockUserResponse);
      mockJwt.sign.mockReturnValueOnce(mockToken).mockReturnValueOnce(mockRefreshToken);
      mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await authService.registerUser(testUserData);

      expect(result).toMatchObject({
        user: {
          userId: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          roles: ['user'],
          permissions: [],
        },
        accessToken: mockToken,
        refreshToken: mockRefreshToken,
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockUserService.createUser).toHaveBeenCalledWith(testUserData, hashedPassword);
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw error for weak password', async () => {
      const weakPasswordData = { ...testUserData, password: 'weak' };

      await expect(authService.registerUser(weakPasswordData))
        .rejects.toThrow('Password must be at least 8 characters long');

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should throw error for password without uppercase letter', async () => {
      const noUppercaseData = { ...testUserData, password: 'password123!' };

      await expect(authService.registerUser(noUppercaseData))
        .rejects.toThrow('Password must contain at least one uppercase letter');
    });

    it('should throw error for password without lowercase letter', async () => {
      const noLowercaseData = { ...testUserData, password: 'PASSWORD123!' };

      await expect(authService.registerUser(noLowercaseData))
        .rejects.toThrow('Password must contain at least one lowercase letter');
    });

    it('should throw error for password without number', async () => {
      const noNumberData = { ...testUserData, password: 'Password!' };

      await expect(authService.registerUser(noNumberData))
        .rejects.toThrow('Password must contain at least one number');
    });

    it('should throw error for password without special character', async () => {
      const noSpecialData = { ...testUserData, password: 'Password123' };

      await expect(authService.registerUser(noSpecialData))
        .rejects.toThrow('Password must contain at least one special character');
    });

    it('should throw error for password too long', async () => {
      const longPasswordData = { ...testUserData, password: 'P'.repeat(129) + 'assword123!' };

      await expect(authService.registerUser(longPasswordData))
        .rejects.toThrow('Password must be 128 characters or less');
    });
  });

  describe('loginUser', () => {
    const loginData: LoginRequest = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockUser: User = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: '$2b$12$hashedpassword',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    const mockUserResponse: UserResponse = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should login user successfully', async () => {
      const mockToken = 'mock-jwt-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockUserService.getUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockUserService.getUserById.mockResolvedValue(mockUserResponse);
      mockJwt.sign.mockReturnValueOnce(mockToken).mockReturnValueOnce(mockRefreshToken);
      mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await authService.loginUser(loginData);

      expect(result).toMatchObject({
        user: {
          userId: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          roles: ['user'],
          permissions: [],
        },
        accessToken: mockToken,
        refreshToken: mockRefreshToken,
      });

      expect(mockUserService.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('Password123!', '$2b$12$hashedpassword');
      expect(mockUserService.getUserById).toHaveBeenCalledWith('test-user-id');
    });

    it('should throw error for non-existent user', async () => {
      mockUserService.getUserByEmail.mockResolvedValue(null);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Invalid email or password');

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserService.getUserByEmail.mockResolvedValue(inactiveUser);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Invalid email or password');

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for incorrect password', async () => {
      mockUserService.getUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'study-app-v3',
        iss: 'study-app-v3-auth',
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      const result = await authService.validateToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should throw error for expired token', async () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      mockJwt.verify.mockImplementation(() => { throw error; });

      await expect(authService.validateToken('expired-token'))
        .rejects.toThrow('Token expired');
    });

    it('should throw error for invalid token', async () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      mockJwt.verify.mockImplementation(() => { throw error; });

      await expect(authService.validateToken('invalid-token'))
        .rejects.toThrow('Invalid token');
    });

    it('should throw generic error for other JWT errors', async () => {
      const error = new Error('Other error');
      error.name = 'OtherError';
      mockJwt.verify.mockImplementation(() => { throw error; });

      await expect(authService.validateToken('problematic-token'))
        .rejects.toThrow('Token validation failed');
    });
  });

  describe('refreshToken', () => {
    const mockUserResponse: UserResponse = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      isActive: true,
    };

    it('should refresh token successfully', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'study-app-v3',
        iss: 'study-app-v3-auth',
      };

      const mockNewToken = 'new-access-token';
      const mockNewRefreshToken = 'new-refresh-token';

      mockJwt.verify.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(mockUserResponse);
      mockJwt.sign.mockReturnValueOnce(mockNewToken).mockReturnValueOnce(mockNewRefreshToken);
      mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toMatchObject({
        user: {
          userId: 'test-user-id',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
        },
        accessToken: mockNewToken,
        refreshToken: mockNewRefreshToken,
      });

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', 'test-refresh-secret');
      expect(mockUserService.getUserById).toHaveBeenCalledWith('test-user-id');
    });

    it('should throw error for expired refresh token', async () => {
      const error = new Error('Refresh token expired');
      error.name = 'TokenExpiredError';
      mockJwt.verify.mockImplementation(() => { throw error; });

      await expect(authService.refreshToken('expired-refresh-token'))
        .rejects.toThrow('Refresh token expired');
    });

    it('should throw error when user not found or inactive', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'study-app-v3',
        iss: 'study-app-v3-auth',
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockUserService.getUserById.mockResolvedValue(null);

      await expect(authService.refreshToken('valid-refresh-token'))
        .rejects.toThrow('User not found or inactive');
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const hashedPassword = '$2b$12$hashedpassword';
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await authService.hashPassword('password123');

      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should throw error when bcrypt fails', async () => {
      mockBcrypt.hash.mockRejectedValue(new Error('Bcrypt error'));

      await expect(authService.hashPassword('password123'))
        .rejects.toThrow('Password processing failed');
    });
  });

  describe('verifyPassword', () => {
    it('should verify password successfully', async () => {
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authService.verifyPassword('password123', '$2b$12$hashedpassword');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', '$2b$12$hashedpassword');
    });

    it('should return false for incorrect password', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await authService.verifyPassword('wrongpassword', '$2b$12$hashedpassword');

      expect(result).toBe(false);
    });

    it('should return false when bcrypt fails', async () => {
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const result = await authService.verifyPassword('password123', '$2b$12$hashedpassword');

      expect(result).toBe(false);
    });
  });
});