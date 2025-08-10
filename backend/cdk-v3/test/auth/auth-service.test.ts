import { AuthService } from '../../src/lambdas/auth/auth-service';
import { UserRepository } from '../../src/lambdas/auth/user-repository';
import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  InvalidCredentialsError,
  UserExistsError,
  UserNotFoundError,
  AccountInactiveError,
  AccountLockedError,
  RefreshTokenRequest,
  RefreshTokenInfo,
  InvalidRefreshTokenError,
  ExpiredRefreshTokenError,
  RevokedRefreshTokenError,
  LogoutRequest,
  LogoutResponse,
  BlacklistedToken,
  InvalidAccessTokenError,
  BlacklistedTokenError
} from '../../src/lambdas/auth/types';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// Mock the dependencies
jest.mock('../../src/lambdas/auth/user-repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('crypto');

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepo = new mockUserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService(mockUserRepo);
    
    // Setup environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '24h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
  });

  describe('login', () => {
    const validLoginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    it('should successfully login with valid credentials', async () => {
      // Setup mocks
      mockUserRepo.getUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');
      mockJwt.decode.mockReturnValue({ exp: 1672617600, iat: 1672531200 });
      mockUserRepo.updateUser.mockResolvedValue();

      // Execute
      const result = await authService.login(validLoginRequest);

      // Verify
      expect(mockUserRepo.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', expect.objectContaining({
        lastLoginAt: expect.any(String),
        updatedAt: expect.any(String)
      }));

      expect(result).toEqual({
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isActive: true,
          isEmailVerified: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 86400,
        tokenType: 'Bearer'
      });
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockUserRepo.getUserByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginRequest))
        .rejects
        .toThrow(UserNotFoundError);

      expect(mockUserRepo.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw AccountInactiveError when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepo.getUserByEmail.mockResolvedValue(inactiveUser);

      await expect(authService.login(validLoginRequest))
        .rejects
        .toThrow(AccountInactiveError);
    });

    it('should throw AccountLockedError when user is locked', async () => {
      const lockedUser = { 
        ...mockUser, 
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString() 
      };
      mockUserRepo.getUserByEmail.mockResolvedValue(lockedUser);

      await expect(authService.login(validLoginRequest))
        .rejects
        .toThrow(AccountLockedError);
    });

    it('should throw InvalidCredentialsError with wrong password', async () => {
      mockUserRepo.getUserByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.updateUser.mockResolvedValue();

      await expect(authService.login(validLoginRequest))
        .rejects
        .toThrow(InvalidCredentialsError);

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', expect.objectContaining({
        loginAttempts: 1,
        updatedAt: expect.any(String)
      }));
    });

    it('should lock account after max failed attempts', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 4 };
      mockUserRepo.getUserByEmail.mockResolvedValue(userWithAttempts);
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.updateUser.mockResolvedValue();

      await expect(authService.login(validLoginRequest))
        .rejects
        .toThrow(InvalidCredentialsError);

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', expect.objectContaining({
        loginAttempts: 5,
        lockedUntil: expect.any(String),
        updatedAt: expect.any(String)
      }));
    });

    it('should reset login attempts on successful login', async () => {
      const userWithAttempts = { ...mockUser, loginAttempts: 3 };
      mockUserRepo.getUserByEmail.mockResolvedValue(userWithAttempts);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');
      mockJwt.decode.mockReturnValue({ exp: 1672617600, iat: 1672531200 });
      mockUserRepo.updateUser.mockResolvedValue();

      await authService.login(validLoginRequest);

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', expect.objectContaining({
        loginAttempts: 0,
        lastLoginAt: expect.any(String),
        updatedAt: expect.any(String)
      }));
    });
  });

  describe('register', () => {
    const validRegisterRequest: RegisterRequest = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User'
    };

    it('should successfully register a new user', async () => {
      mockUserRepo.getUserByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed-password-123');
      mockUserRepo.createUser.mockResolvedValue();
      mockJwt.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');
      mockJwt.decode.mockReturnValue({ exp: 1672617600, iat: 1672531200 });

      const result = await authService.register(validRegisterRequest);

      expect(mockUserRepo.getUserByEmail).toHaveBeenCalledWith('newuser@example.com');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockUserRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        passwordHash: 'hashed-password-123',
        isActive: true,
        isEmailVerified: false
      }));

      expect(result).toEqual(expect.objectContaining({
        user: expect.objectContaining({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          isActive: true
        }),
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        tokenType: 'Bearer'
      }));
    });

    it('should throw UserExistsError when user already exists', async () => {
      const existingUser: User = {
        userId: 'user-456',
        email: 'newuser@example.com',
        firstName: 'Existing',
        lastName: 'User',
        passwordHash: 'hash',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      mockUserRepo.getUserByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(validRegisterRequest))
        .rejects
        .toThrow(UserExistsError);

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepo.createUser).not.toHaveBeenCalled();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authService.verifyPassword('password123', 'hashed-password');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });

    it('should return false for incorrect password', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await authService.verifyPassword('wrongpassword', 'hashed-password');

      expect(result).toBe(false);
    });

    it('should return false on bcrypt error', async () => {
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const result = await authService.verifyPassword('password123', 'hashed-password');

      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password-123');

      const result = await authService.hashPassword('password123');

      expect(result).toBe('hashed-password-123');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should throw AuthError on hashing failure', async () => {
      mockBcrypt.hash.mockRejectedValue(new Error('Hashing failed'));

      await expect(authService.hashPassword('password123'))
        .rejects
        .toThrow('Password hashing failed');
    });
  });

  describe('generateTokens', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hash',
      isActive: true,
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    it('should generate access and refresh tokens', () => {
      mockJwt.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');
      mockJwt.decode.mockReturnValue({ exp: 1672617600, iat: 1672531200 });

      const result = authService.generateTokens(mockUser);

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 86400
      });

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        'test-jwt-secret',
        { expiresIn: '24h' }
      );
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        'test-refresh-secret',
        { expiresIn: '7d' }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        iat: 1672531200,
        exp: 1672617600,
        type: 'access' as const
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);

      const result = authService.verifyToken('valid-token', 'access');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
    });

    it('should verify valid refresh token', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        iat: 1672531200,
        exp: 1672617600,
        type: 'refresh' as const
      };

      mockJwt.verify.mockReturnValue(mockPayload as any);

      const result = authService.verifyToken('valid-refresh-token', 'refresh');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', 'test-refresh-secret');
    });

    it('should throw error for invalid token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      expect(() => authService.verifyToken('invalid-token'))
        .toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      expect(() => authService.verifyToken('expired-token'))
        .toThrow('Token expired');
    });
  });

  describe('refreshTokens', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      refreshTokens: []
    };

    const mockRefreshTokenInfo: RefreshTokenInfo = {
      tokenId: 'token-id-123',
      hashedToken: 'hashed-refresh-token-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: '2023-01-01T00:00:00.000Z',
      isRevoked: false
    };

    const validRefreshRequest: RefreshTokenRequest = {
      refreshToken: 'valid-refresh-token-123'
    };

    beforeEach(() => {
      // Mock crypto functions
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('1234567890abcdef', 'hex'));
      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashed-refresh-token-123')
      } as any);
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      const userWithRefreshToken = {
        ...mockUser,
        refreshTokens: [mockRefreshTokenInfo]
      };

      // Setup mocks
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(userWithRefreshToken);
      mockUserRepo.updateUser.mockResolvedValue();
      mockJwt.sign
        .mockReturnValueOnce('new-access-token-123')
        .mockReturnValueOnce('new-refresh-token-123');
      mockJwt.decode.mockReturnValue({ exp: 1672617600, iat: 1672531200 });

      // Execute
      const result = await authService.refreshTokens(validRefreshRequest);

      // Verify
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token-123', 'test-refresh-secret');
      expect(mockUserRepo.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepo.updateUser).toHaveBeenCalledTimes(2); // Once for revoke, once for store

      expect(result).toEqual({
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isActive: true,
          isEmailVerified: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        accessToken: 'new-access-token-123',
        refreshToken: 'new-refresh-token-123',
        expiresIn: 86400,
        tokenType: 'Bearer'
      });
    });

    it('should throw InvalidRefreshTokenError for invalid JWT', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(InvalidRefreshTokenError);
    });

    it('should throw InvalidRefreshTokenError for expired JWT', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(InvalidRefreshTokenError);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'nonexistent-user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(null);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(UserNotFoundError);
    });

    it('should throw AccountInactiveError when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(inactiveUser);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(AccountInactiveError);
    });

    it('should throw InvalidRefreshTokenError when token ID is missing', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        iat: 1672531200,
        exp: 1673136000
        // Missing tokenId
      });
      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(InvalidRefreshTokenError);
    });

    it('should throw InvalidRefreshTokenError when token is not found in storage', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'nonexistent-token-id',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue({
        ...mockUser,
        refreshTokens: [mockRefreshTokenInfo]
      });

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(InvalidRefreshTokenError);
    });

    it('should throw RevokedRefreshTokenError when token is revoked', async () => {
      const revokedTokenInfo = { ...mockRefreshTokenInfo, isRevoked: true };
      const userWithRevokedToken = {
        ...mockUser,
        refreshTokens: [revokedTokenInfo]
      };

      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(userWithRevokedToken);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(RevokedRefreshTokenError);
    });

    it('should throw ExpiredRefreshTokenError when token is expired', async () => {
      const expiredTokenInfo = { 
        ...mockRefreshTokenInfo, 
        expiresAt: new Date(Date.now() - 1000).toISOString() 
      };
      const userWithExpiredToken = {
        ...mockUser,
        refreshTokens: [expiredTokenInfo]
      };

      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(userWithExpiredToken);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(ExpiredRefreshTokenError);
    });

    it('should throw InvalidRefreshTokenError when token hash does not match', async () => {
      const userWithRefreshToken = {
        ...mockUser,
        refreshTokens: [mockRefreshTokenInfo]
      };

      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'refresh',
        tokenId: 'token-id-123',
        iat: 1672531200,
        exp: 1673136000
      });
      mockUserRepo.getUserById.mockResolvedValue(userWithRefreshToken);
      
      // Mock different hash to simulate mismatch
      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('different-hash')
      } as any);

      await expect(authService.refreshTokens(validRefreshRequest))
        .rejects
        .toThrow(InvalidRefreshTokenError);
    });
  });

  describe('revokeRefreshToken', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      refreshTokens: [
        {
          tokenId: 'token-id-123',
          hashedToken: 'hashed-token-123',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: '2023-01-01T00:00:00.000Z',
          isRevoked: false
        }
      ]
    };

    it('should successfully revoke a refresh token', async () => {
      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockUserRepo.updateUser.mockResolvedValue();

      await authService.revokeRefreshToken('user-123', 'token-id-123');

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', {
        refreshTokens: [
          {
            tokenId: 'token-id-123',
            hashedToken: 'hashed-token-123',
            expiresAt: mockUser.refreshTokens![0].expiresAt,
            createdAt: '2023-01-01T00:00:00.000Z',
            isRevoked: true
          }
        ]
      });
    });

    it('should handle user not found gracefully', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      await expect(authService.revokeRefreshToken('nonexistent-user', 'token-id-123'))
        .resolves
        .toBeUndefined();

      expect(mockUserRepo.updateUser).not.toHaveBeenCalled();
    });

    it('should handle user with no refresh tokens gracefully', async () => {
      const userWithoutTokens = { ...mockUser, refreshTokens: undefined };
      mockUserRepo.getUserById.mockResolvedValue(userWithoutTokens);

      await expect(authService.revokeRefreshToken('user-123', 'token-id-123'))
        .resolves
        .toBeUndefined();

      expect(mockUserRepo.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('should successfully revoke all refresh tokens', async () => {
      mockUserRepo.updateUser.mockResolvedValue();

      await authService.revokeAllRefreshTokens('user-123');

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', {
        refreshTokens: []
      });
    });

    it('should throw error when update fails', async () => {
      mockUserRepo.updateUser.mockRejectedValue(new Error('Database error'));

      await expect(authService.revokeAllRefreshTokens('user-123'))
        .rejects
        .toThrow('Failed to revoke refresh tokens');
    });
  });

  describe('logout', () => {
    const mockAccessToken = 'valid-access-token-123';
    const mockTokenId = 'token-id-123';
    
    beforeEach(() => {
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'access',
        tokenId: mockTokenId,
        iat: 1672531200,
        exp: 1672617600
      });
      
      mockJwt.decode.mockReturnValue({
        userId: 'user-123',
        exp: 1672617600,
        tokenId: mockTokenId
      });
    });

    it('should successfully logout single token', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: []
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockUserRepo.updateUser.mockResolvedValue();

      const result = await authService.logout(mockAccessToken, false);

      expect(result).toEqual({
        message: 'Logout successful',
        loggedOutTokens: 1
      });

      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', {
        blacklistedTokens: [
          {
            tokenId: mockTokenId,
            userId: 'user-123',
            expiresAt: '2023-01-02T00:00:00.000Z',
            blacklistedAt: expect.any(String),
            reason: 'logout'
          }
        ]
      });
    });

    it('should successfully logout all devices', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        refreshTokens: [
          { tokenId: 'refresh-1', hashedToken: 'hash-1', expiresAt: '2023-01-08T00:00:00.000Z', createdAt: '2023-01-01T00:00:00.000Z', isRevoked: false },
          { tokenId: 'refresh-2', hashedToken: 'hash-2', expiresAt: '2023-01-08T00:00:00.000Z', createdAt: '2023-01-01T00:00:00.000Z', isRevoked: false }
        ],
        blacklistedTokens: [
          { tokenId: 'old-token', userId: 'user-123', expiresAt: '2023-01-02T00:00:00.000Z', blacklistedAt: '2023-01-01T00:00:00.000Z', reason: 'logout' }
        ]
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);
      mockUserRepo.updateUser.mockResolvedValueOnce().mockResolvedValueOnce();

      const result = await authService.logout(mockAccessToken, true);

      expect(result).toEqual({
        message: 'Logout from all devices successful',
        loggedOutTokens: 3
      });

      // Should revoke all refresh tokens and clear blacklisted tokens
      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', {
        refreshTokens: []
      });
      expect(mockUserRepo.updateUser).toHaveBeenCalledWith('user-123', {
        blacklistedTokens: []
      });
    });

    it('should throw error for invalid access token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.logout('invalid-token', false))
        .rejects
        .toThrow('Invalid access token');
    });

    it('should throw error for blacklisted token', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: [
          {
            tokenId: mockTokenId,
            userId: 'user-123',
            expiresAt: '2023-01-02T00:00:00.000Z',
            blacklistedAt: '2023-01-01T00:00:00.000Z',
            reason: 'logout'
          }
        ]
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      await expect(authService.logout(mockAccessToken, false))
        .rejects
        .toThrow('Token has been revoked');
    });

    it('should throw error when user not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      await expect(authService.logout(mockAccessToken, true))
        .rejects
        .toThrow('User not found');
    });
  });

  describe('verifyAccessToken', () => {
    const mockAccessToken = 'valid-access-token-123';
    const mockTokenId = 'token-id-123';

    it('should successfully verify valid access token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'access',
        tokenId: mockTokenId,
        iat: 1672531200,
        exp: 1672617600
      };

      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: []
      };

      mockJwt.verify.mockReturnValue(mockDecoded);
      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      const result = await authService.verifyAccessToken(mockAccessToken);

      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith(mockAccessToken, 'test-jwt-secret');
    });

    it('should throw error for blacklisted token', async () => {
      const mockDecoded = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        type: 'access',
        tokenId: mockTokenId,
        iat: 1672531200,
        exp: 1672617600
      };

      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: [
          {
            tokenId: mockTokenId,
            userId: 'user-123',
            expiresAt: '2023-01-02T00:00:00.000Z',
            blacklistedAt: '2023-01-01T00:00:00.000Z',
            reason: 'logout'
          }
        ]
      };

      mockJwt.verify.mockReturnValue(mockDecoded);
      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      await expect(authService.verifyAccessToken(mockAccessToken))
        .rejects
        .toThrow('Token has been revoked');
    });

    it('should throw error for invalid token signature', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyAccessToken('invalid-token'))
        .rejects
        .toThrow('Invalid access token');
    });
  });

  describe('isTokenBlacklisted', () => {
    const mockTokenId = 'token-id-123';

    it('should return false for non-blacklisted token', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: []
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      const result = await authService.isTokenBlacklisted('user-123', mockTokenId);

      expect(result).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: [
          {
            tokenId: mockTokenId,
            userId: 'user-123',
            expiresAt: '2023-12-31T23:59:59.999Z', // Future expiry
            blacklistedAt: '2023-01-01T00:00:00.000Z',
            reason: 'logout'
          }
        ]
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      const result = await authService.isTokenBlacklisted('user-123', mockTokenId);

      expect(result).toBe(true);
    });

    it('should return false for expired blacklisted token', async () => {
      const mockUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed-password',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        blacklistedTokens: [
          {
            tokenId: mockTokenId,
            userId: 'user-123',
            expiresAt: '2022-12-31T23:59:59.999Z', // Past expiry
            blacklistedAt: '2023-01-01T00:00:00.000Z',
            reason: 'logout'
          }
        ]
      };

      mockUserRepo.getUserById.mockResolvedValue(mockUser);

      const result = await authService.isTokenBlacklisted('user-123', mockTokenId);

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockUserRepo.getUserById.mockResolvedValue(null);

      const result = await authService.isTokenBlacklisted('user-123', mockTokenId);

      expect(result).toBe(false);
    });
  });
});