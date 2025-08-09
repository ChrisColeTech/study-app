import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import AWSClients from '../shared/aws-clients';
import { User, AuthPayload } from '../types';
import UserRepository from '../repositories/user-repository';

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string | null = null;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user: User = {
      userId: uuidv4(),
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.userRepository.create(user);

    // Generate token
    const token = await this.generateToken(user);

    // Remove password from response
    const { passwordHash: _, ...userResponse } = user;

    return { user: userResponse, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const token = await this.generateToken(user);

    // Remove password from response
    const { passwordHash: _, ...userResponse } = user;

    return { user: userResponse, token };
  }

  async verifyToken(token: string): Promise<AuthPayload> {
    const secret = await this.getJWTSecret();
    return jwt.verify(token, secret) as AuthPayload;
  }

  async getUserById(userId: string): Promise<User | null> {
    const user = await this.userRepository.findById(userId);
    if (user && user.passwordHash) {
      const { passwordHash: _, ...userResponse } = user;
      return userResponse;
    }
    return user;
  }

  private async generateToken(user: User): Promise<string> {
    const secret = await this.getJWTSecret();
    const payload: AuthPayload = {
      userId: user.userId,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    return jwt.sign(payload, secret);
  }

  private async getJWTSecret(): Promise<string> {
    if (this.jwtSecret) {
      return this.jwtSecret;
    }

    const secretName = process.env.JWT_SECRET_NAME;
    if (!secretName) {
      throw new Error('JWT_SECRET_NAME environment variable not set');
    }

    try {
      const client = AWSClients.getSecretsClient();
      const response = await client.send(new GetSecretValueCommand({
        SecretId: secretName,
      }));

      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString);
        this.jwtSecret = secret.jwt_secret;
        return this.jwtSecret!;
      }

      throw new Error('JWT secret not found');
    } catch (error) {
      console.error('Error retrieving JWT secret:', error);
      throw new Error('Failed to retrieve JWT secret');
    }
  }
}