import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { 
  User, 
  UserProfile, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  TokenPayload,
  AuthConfig,
  AuthError,
  InvalidCredentialsError,
  UserExistsError,
  UserNotFoundError,
  AccountInactiveError,
  AccountLockedError,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RefreshTokenInfo,
  InvalidRefreshTokenError,
  ExpiredRefreshTokenError,
  RevokedRefreshTokenError,
  LogoutRequest,
  LogoutResponse,
  BlacklistedToken,
  InvalidAccessTokenError,
  BlacklistedTokenError,
  MissingAuthorizationError
} from './types';
import { UserRepository } from './user-repository';

export class AuthService {
  private userRepository: UserRepository;
  private config: AuthConfig;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    this.config = {
      jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      bcryptSaltRounds: 12,
      maxLoginAttempts: 5,
      lockoutDuration: 30, // 30 minutes
      rateLimitWindow: 15, // 15 minutes
      rateLimitMaxRequests: 10,
      maxBlacklistedTokens: 100
    };
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    console.log(`Attempting login for email: ${request.email}`);
    
    try {
      // Get user by email
      const user = await this.userRepository.getUserByEmail(request.email);
      
      if (!user) {
        console.log(`User not found for email: ${request.email}`);
        throw new UserNotFoundError(request.email);
      }

      // Check if account is active
      if (!user.isActive) {
        console.log(`Account inactive for user: ${user.userId}`);
        throw new AccountInactiveError();
      }

      // Check if account is locked
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        console.log(`Account locked for user: ${user.userId} until ${user.lockedUntil}`);
        throw new AccountLockedError(user.lockedUntil);
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(request.password, user.passwordHash);
      
      if (!isValidPassword) {
        console.log(`Invalid password for user: ${user.userId}`);
        
        // Increment login attempts
        await this.handleFailedLogin(user);
        throw new InvalidCredentialsError();
      }

      console.log(`Successful login for user: ${user.userId}`);
      
      // Reset login attempts on successful login
      await this.handleSuccessfulLogin(user);

      // Generate tokens and store refresh token
      const tokens = await this.generateTokens(user);

      // Create auth response
      const authResponse: AuthResponse = {
        user: this.toUserProfile(user),
        ...tokens,
        tokenType: 'Bearer'
      };

      return authResponse;

    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError('Login failed', 'LOGIN_ERROR', 500);
    }
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    console.log(`Attempting registration for email: ${request.email}`);
    
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.getUserByEmail(request.email);
      if (existingUser) {
        console.log(`User already exists with email: ${request.email}`);
        throw new UserExistsError(request.email);
      }

      // Hash password
      const passwordHash = await this.hashPassword(request.password);

      // Create user
      const userId = await this.generateUserId();
      const now = new Date().toISOString();
      
      const newUser: User = {
        userId,
        email: request.email.toLowerCase().trim(),
        firstName: request.firstName.trim(),
        lastName: request.lastName.trim(),
        passwordHash,
        isActive: true,
        isEmailVerified: false, // Will be handled in Phase 4+
        createdAt: now,
        updatedAt: now,
        timezone: request.timezone || 'UTC',
        language: request.language || 'en'
      };

      console.log(`Creating new user: ${newUser.userId}`);
      
      // Save user to database
      await this.userRepository.createUser(newUser);

      console.log(`User created successfully: ${newUser.userId}`);

      // Generate tokens and store refresh token
      const tokens = await this.generateTokens(newUser);

      // Create auth response
      const authResponse: AuthResponse = {
        user: this.toUserProfile(newUser),
        ...tokens,
        tokenType: 'Bearer'
      };

      return authResponse;

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError('Registration failed', 'REGISTRATION_ERROR', 500);
    }
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  async hashPassword(plainPassword: string): Promise<string> {
    try {
      return await bcrypt.hash(plainPassword, this.config.bcryptSaltRounds);
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new AuthError('Password hashing failed', 'HASH_ERROR', 500);
    }
  }

  async generateTokens(user: User, deviceInfo?: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const tokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'type'> = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      // Generate access token with unique token ID
      const accessTokenId = this.generateTokenId();
      const accessToken = jwt.sign(
        { ...tokenPayload, type: 'access', tokenId: accessTokenId } as jwt.JwtPayload,
        this.config.jwtSecret,
        { expiresIn: this.config.jwtExpiresIn } as jwt.SignOptions
      ) as string;

      // Generate refresh token with unique token ID
      const refreshTokenId = this.generateTokenId();
      const refreshToken = jwt.sign(
        { ...tokenPayload, type: 'refresh', tokenId: refreshTokenId } as jwt.JwtPayload,
        this.config.jwtRefreshSecret,
        { expiresIn: this.config.jwtRefreshExpiresIn } as jwt.SignOptions
      ) as string;

      // Store refresh token info in user record
      await this.storeRefreshToken(user.userId, {
        tokenId: refreshTokenId,
        hashedToken: this.hashRefreshToken(refreshToken),
        expiresAt: this.calculateRefreshTokenExpiry(),
        createdAt: new Date().toISOString(),
        isRevoked: false,
        deviceInfo
      });

      // Calculate expiration time in seconds
      const decoded = jwt.decode(accessToken) as any;
      const expiresIn = decoded.exp - decoded.iat;

      return {
        accessToken,
        refreshToken,
        expiresIn
      };

    } catch (error) {
      console.error('Token generation error:', error);
      throw new AuthError('Token generation failed', 'TOKEN_ERROR', 500);
    }
  }

  verifyToken(token: string, type: 'access' | 'refresh' = 'access'): TokenPayload {
    try {
      const secret = type === 'access' ? this.config.jwtSecret : this.config.jwtRefreshSecret;
      const decoded = jwt.verify(token, secret) as TokenPayload;
      
      if (decoded.type !== type) {
        throw new AuthError(`Invalid token type. Expected ${type}`, 'INVALID_TOKEN_TYPE', 401);
      }
      
      return decoded;
    } catch (error) {
      console.error('Token verification error:', error);
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid token', 'INVALID_TOKEN', 401);
      }
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token expired', 'TOKEN_EXPIRED', 401);
      }
      
      throw new AuthError('Token verification failed', 'TOKEN_ERROR', 401);
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      // First verify the token signature and expiry
      const decoded = this.verifyToken(token, 'access');
      
      // Check if token is blacklisted
      const tokenId = (decoded as any).tokenId;
      if (tokenId) {
        const isBlacklisted = await this.isTokenBlacklisted(decoded.userId, tokenId);
        if (isBlacklisted) {
          console.log(`Access token ${tokenId} is blacklisted for user: ${decoded.userId}`);
          throw new BlacklistedTokenError();
        }
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      console.error('Access token verification error:', error);
      throw new InvalidAccessTokenError();
    }
  }

  async refreshTokens(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    console.log('Attempting token refresh');
    
    try {
      // Verify and decode the refresh token
      const decoded = this.verifyToken(request.refreshToken, 'refresh');
      console.log(`Token refresh for user: ${decoded.userId}`);

      // Get the user
      const user = await this.userRepository.getUserById(decoded.userId);
      if (!user) {
        console.log(`User not found during token refresh: ${decoded.userId}`);
        throw new UserNotFoundError();
      }

      // Check if account is still active
      if (!user.isActive) {
        console.log(`Account inactive during token refresh: ${user.userId}`);
        throw new AccountInactiveError();
      }

      // Verify the refresh token exists and is valid
      const tokenId = (decoded as any).tokenId;
      if (!tokenId) {
        console.log('Invalid refresh token - missing token ID');
        throw new InvalidRefreshTokenError();
      }

      const isValidRefreshToken = await this.validateStoredRefreshToken(user.userId, tokenId, request.refreshToken);
      if (!isValidRefreshToken) {
        console.log(`Invalid refresh token for user: ${user.userId}`);
        throw new InvalidRefreshTokenError();
      }

      // Revoke the used refresh token (token rotation)
      await this.revokeRefreshToken(user.userId, tokenId);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      console.log(`Token refresh successful for user: ${user.userId}`);

      // Create refresh response
      const refreshResponse: RefreshTokenResponse = {
        user: this.toUserProfile(user),
        ...tokens,
        tokenType: 'Bearer'
      };

      return refreshResponse;

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new InvalidRefreshTokenError();
      }
      
      throw new AuthError('Token refresh failed', 'REFRESH_ERROR', 500);
    }
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    console.log(`Revoking refresh token: ${tokenId} for user: ${userId}`);
    
    try {
      const user = await this.userRepository.getUserById(userId);
      if (!user || !user.refreshTokens) {
        return;
      }

      const updatedTokens = user.refreshTokens.map(token => 
        token.tokenId === tokenId 
          ? { ...token, isRevoked: true } 
          : token
      );

      await this.userRepository.updateUser(userId, { 
        refreshTokens: updatedTokens 
      });

      console.log(`Refresh token revoked: ${tokenId}`);
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      // Don't throw error - this is a cleanup operation
    }
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    console.log(`Revoking all refresh tokens for user: ${userId}`);
    
    try {
      await this.userRepository.updateUser(userId, { 
        refreshTokens: [] 
      });

      console.log(`All refresh tokens revoked for user: ${userId}`);
    } catch (error) {
      console.error('Error revoking all refresh tokens:', error);
      throw new AuthError('Failed to revoke refresh tokens', 'REVOKE_ERROR', 500);
    }
  }

  async logout(accessToken: string, logoutAll: boolean = false): Promise<LogoutResponse> {
    console.log('Processing logout request');
    
    try {
      // Verify the access token first
      const decoded = await this.verifyAccessToken(accessToken);
      const userId = decoded.userId;
      const tokenId = (decoded as any).tokenId;

      console.log(`Logout request for user: ${userId}, tokenId: ${tokenId}, logoutAll: ${logoutAll}`);

      if (logoutAll) {
        // Logout from all devices
        return await this.logoutAllDevices(userId);
      } else {
        // Logout from current device only
        return await this.logoutSingleToken(userId, tokenId, accessToken);
      }

    } catch (error) {
      console.error('Logout error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError('Logout failed', 'LOGOUT_ERROR', 500);
    }
  }

  async logoutSingleToken(userId: string, tokenId: string, accessToken: string): Promise<LogoutResponse> {
    try {
      // Blacklist the access token
      if (tokenId) {
        await this.blacklistToken(userId, tokenId, accessToken);
      }

      console.log(`Single token logout successful for user: ${userId}`);

      return {
        message: 'Logout successful',
        loggedOutTokens: 1
      };

    } catch (error) {
      console.error('Single token logout error:', error);
      throw new AuthError('Logout failed', 'LOGOUT_ERROR', 500);
    }
  }

  async logoutAllDevices(userId: string): Promise<LogoutResponse> {
    try {
      // Get user to count existing tokens
      const user = await this.userRepository.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      // Count tokens that will be revoked
      const refreshTokenCount = user.refreshTokens?.length || 0;
      const blacklistedTokenCount = user.blacklistedTokens?.length || 0;

      // Revoke all refresh tokens
      await this.revokeAllRefreshTokens(userId);

      // Clear all blacklisted tokens (they are now all invalidated anyway)
      await this.userRepository.updateUser(userId, {
        blacklistedTokens: []
      });

      console.log(`All devices logout successful for user: ${userId}, revoked ${refreshTokenCount} refresh tokens`);

      return {
        message: 'Logout from all devices successful',
        loggedOutTokens: refreshTokenCount + blacklistedTokenCount
      };

    } catch (error) {
      console.error('Logout all devices error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError('Logout from all devices failed', 'LOGOUT_ALL_ERROR', 500);
    }
  }

  async blacklistToken(userId: string, tokenId: string, token: string): Promise<void> {
    console.log(`Blacklisting access token: ${tokenId} for user: ${userId}`);
    
    try {
      // Decode token to get expiry
      const decoded = jwt.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000).toISOString();

      const blacklistedToken: BlacklistedToken = {
        tokenId,
        userId,
        expiresAt,
        blacklistedAt: new Date().toISOString(),
        reason: 'logout'
      };

      const user = await this.userRepository.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      const currentBlacklistedTokens = user.blacklistedTokens || [];
      
      // Remove expired tokens to keep the array clean
      const activeBlacklistedTokens = currentBlacklistedTokens.filter(token => 
        new Date(token.expiresAt) > new Date()
      );

      // Limit number of blacklisted tokens per user
      const maxTokens = this.config.maxBlacklistedTokens || 100;
      const tokensToKeep = activeBlacklistedTokens.slice(-maxTokens + 1); // Keep most recent

      const updatedBlacklistedTokens = [...tokensToKeep, blacklistedToken];

      await this.userRepository.updateUser(userId, {
        blacklistedTokens: updatedBlacklistedTokens
      });

      console.log(`Access token blacklisted: ${tokenId}`);
    } catch (error) {
      console.error('Error blacklisting token:', error);
      throw new AuthError('Failed to blacklist token', 'BLACKLIST_ERROR', 500);
    }
  }

  async isTokenBlacklisted(userId: string, tokenId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.getUserById(userId);
      if (!user || !user.blacklistedTokens) {
        return false;
      }

      const blacklistedToken = user.blacklistedTokens.find(token => token.tokenId === tokenId);
      if (!blacklistedToken) {
        return false;
      }

      // Check if the blacklisted token has expired (cleanup)
      if (new Date(blacklistedToken.expiresAt) <= new Date()) {
        // Token has naturally expired, no need to keep it blacklisted
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false; // Default to allowing the token if we can't check
    }
  }

  private async validateStoredRefreshToken(userId: string, tokenId: string, refreshToken: string): Promise<boolean> {
    try {
      const user = await this.userRepository.getUserById(userId);
      if (!user || !user.refreshTokens) {
        return false;
      }

      const storedToken = user.refreshTokens.find(token => token.tokenId === tokenId);
      if (!storedToken) {
        console.log(`Refresh token not found: ${tokenId}`);
        return false;
      }

      // Check if token is revoked
      if (storedToken.isRevoked) {
        console.log(`Refresh token revoked: ${tokenId}`);
        throw new RevokedRefreshTokenError();
      }

      // Check if token is expired
      if (new Date(storedToken.expiresAt) <= new Date()) {
        console.log(`Refresh token expired: ${tokenId}`);
        throw new ExpiredRefreshTokenError();
      }

      // Verify the token hash
      const tokenHash = this.hashRefreshToken(refreshToken);
      if (storedToken.hashedToken !== tokenHash) {
        console.log(`Refresh token hash mismatch: ${tokenId}`);
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      console.error('Error validating refresh token:', error);
      return false;
    }
  }

  private async storeRefreshToken(userId: string, tokenInfo: RefreshTokenInfo): Promise<void> {
    try {
      const user = await this.userRepository.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      const currentTokens = user.refreshTokens || [];
      
      // Remove expired tokens to keep the array clean
      const activeTokens = currentTokens.filter(token => 
        !token.isRevoked && new Date(token.expiresAt) > new Date()
      );

      // Limit number of active refresh tokens per user (security measure)
      const maxTokens = 5;
      const tokensToKeep = activeTokens.slice(-maxTokens + 1); // Keep most recent

      const updatedTokens = [...tokensToKeep, tokenInfo];

      await this.userRepository.updateUser(userId, {
        refreshTokens: updatedTokens
      });

      console.log(`Refresh token stored for user: ${userId}, tokenId: ${tokenInfo.tokenId}`);
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw new AuthError('Failed to store refresh token', 'STORE_ERROR', 500);
    }
  }

  private generateTokenId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private calculateRefreshTokenExpiry(): string {
    const expiry = new Date();
    
    // Parse refresh token expiry configuration
    const expiryConfig = this.config.jwtRefreshExpiresIn;
    
    if (expiryConfig.endsWith('d')) {
      const days = parseInt(expiryConfig.slice(0, -1));
      expiry.setDate(expiry.getDate() + days);
    } else if (expiryConfig.endsWith('h')) {
      const hours = parseInt(expiryConfig.slice(0, -1));
      expiry.setHours(expiry.getHours() + hours);
    } else if (expiryConfig.endsWith('m')) {
      const minutes = parseInt(expiryConfig.slice(0, -1));
      expiry.setMinutes(expiry.getMinutes() + minutes);
    } else {
      // Default to 7 days
      expiry.setDate(expiry.getDate() + 7);
    }
    
    return expiry.toISOString();
  }

  private async handleSuccessfulLogin(user: User): Promise<void> {
    try {
      const updates: Partial<User> = {
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Reset login attempts if they exist
      if (user.loginAttempts && user.loginAttempts > 0) {
        updates.loginAttempts = 0;
      }

      // Clear lockout if it exists
      if (user.lockedUntil) {
        updates.lockedUntil = undefined;
      }

      await this.userRepository.updateUser(user.userId, updates);
    } catch (error) {
      console.error('Error handling successful login:', error);
      // Don't throw error here as login was successful
    }
  }

  private async handleFailedLogin(user: User): Promise<void> {
    try {
      const loginAttempts = (user.loginAttempts || 0) + 1;
      const updates: Partial<User> = {
        loginAttempts,
        updatedAt: new Date().toISOString()
      };

      // Lock account if max attempts reached
      if (loginAttempts >= this.config.maxLoginAttempts) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + this.config.lockoutDuration);
        updates.lockedUntil = lockoutUntil.toISOString();
        
        console.log(`Locking account for user: ${user.userId} until ${updates.lockedUntil}`);
      }

      await this.userRepository.updateUser(user.userId, updates);
    } catch (error) {
      console.error('Error handling failed login:', error);
      // Don't throw error here to maintain original error flow
    }
  }

  private async generateUserId(): Promise<string> {
    // Generate a UUID-like string for user ID
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `user-${timestamp}-${randomStr}`;
  }

  private toUserProfile(user: User): UserProfile {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      profilePicture: user.profilePicture,
      timezone: user.timezone,
      language: user.language
    };
  }
}