// ServiceFactory for dependency injection pattern

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// Import service interfaces
import type { IAuthService } from '../services/auth.service';
import type { IUserService } from '../services/user.service';
import type { IProviderService } from '../services/provider.service';
import type { IExamService } from '../services/exam.service';
import type { ITopicService } from '../services/topic.service';
export type { IAuthService, IUserService, IProviderService, IExamService, ITopicService };

export interface IQuestionService {
  // Question service methods will be added in Phase 2
}

export interface ISessionService {
  // Session service methods will be added in Phase 2
}

export interface IAnalyticsService {
  // Analytics service methods will be added in Phase 2
}

export interface IGoalsService {
  // Goals service methods will be added in Phase 2
}

export interface IHealthService {
  checkHealth(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
    version: string;
    dependencies: {
      database: { status: string; responseTime?: number };
      storage: { status: string; responseTime?: number };
    };
  }>;
  checkDatabaseHealth(): Promise<{ status: string; responseTime?: number }>;
  checkStorageHealth(): Promise<{ status: string; responseTime?: number }>;
}

// Import repository interfaces
import type { IUserRepository } from '../repositories/user.repository';
export type { IUserRepository };

export interface ISessionRepository {
  // Session repository methods will be added in Phase 2
}

export interface IQuestionRepository {
  // Question repository methods will be added in Phase 2
}

export interface IProgressRepository {
  // Progress repository methods will be added in Phase 2
}

export interface IGoalsRepository {
  // Goals repository methods will be added in Phase 2
}

// Configuration interface
export interface ServiceConfig {
  region: string;
  environment: string;
  tables: {
    users: string;
    studySessions: string;
    userProgress: string;
    goals: string;
  };
  buckets: {
    questionData: string;
    assets: string;
  };
}

/**
 * ServiceFactory class for dependency injection and service management
 * Implements singleton pattern with lazy initialization
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: ServiceConfig;
  
  // AWS Clients (lazy initialized)
  private _dynamoClient: DynamoDBDocumentClient | null = null;
  private _s3Client: S3Client | null = null;

  // Services (lazy initialized)
  private _authService: IAuthService | null = null;
  private _userService: IUserService | null = null;
  private _providerService: IProviderService | null = null;
  private _examService: IExamService | null = null;
  private _topicService: ITopicService | null = null;
  private _questionService: IQuestionService | null = null;
  private _sessionService: ISessionService | null = null;
  private _analyticsService: IAnalyticsService | null = null;
  private _goalsService: IGoalsService | null = null;
  private _healthService: IHealthService | null = null;

  // Repositories (lazy initialized)
  private _userRepository: IUserRepository | null = null;
  private _sessionRepository: ISessionRepository | null = null;
  private _questionRepository: IQuestionRepository | null = null;
  private _progressRepository: IProgressRepository | null = null;
  private _goalsRepository: IGoalsRepository | null = null;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get ServiceFactory singleton instance
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): ServiceConfig {
    return {
      region: process.env.AWS_REGION || 'us-east-1',
      environment: process.env.NODE_ENV || 'dev',
      tables: {
        users: process.env.USERS_TABLE_NAME || '',
        studySessions: process.env.STUDY_SESSIONS_TABLE_NAME || '',
        userProgress: process.env.USER_PROGRESS_TABLE_NAME || '',
        goals: process.env.GOALS_TABLE_NAME || '',
      },
      buckets: {
        questionData: process.env.QUESTION_DATA_BUCKET_NAME || '',
        assets: process.env.ASSETS_BUCKET_NAME || '',
      },
    };
  }

  /**
   * Get DynamoDB Document Client
   */
  public getDynamoClient(): DynamoDBDocumentClient {
    if (!this._dynamoClient) {
      const client = new DynamoDBClient({
        region: this.config.region,
      });
      
      this._dynamoClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: {
          convertEmptyValues: false,
          removeUndefinedValues: true,
          convertClassInstanceToMap: false,
        },
        unmarshallOptions: {
          wrapNumbers: false,
        },
      });
    }
    return this._dynamoClient;
  }

  /**
   * Get S3 Client
   */
  public getS3Client(): S3Client {
    if (!this._s3Client) {
      this._s3Client = new S3Client({
        region: this.config.region,
      });
    }
    return this._s3Client;
  }

  /**
   * Get configuration
   */
  public getConfig(): ServiceConfig {
    return this.config;
  }

  /**
   * Get Health Service
   */
  public getHealthService(): IHealthService {
    if (!this._healthService) {
      // Import and instantiate HealthService when needed
      const { HealthService } = require('../services/health.service');
      this._healthService = new HealthService(this);
    }
    return this._healthService!;
  }

  // Phase 2+ service getters (placeholder implementations)
  
  /**
   * Get Auth Service
   */
  public getAuthService(): IAuthService {
    if (!this._authService) {
      const { AuthService } = require('../services/auth.service');
      this._authService = new AuthService(this.getUserService());
    }
    return this._authService!;
  }

  /**
   * Get User Service
   */
  public getUserService(): IUserService {
    if (!this._userService) {
      const { UserService } = require('../services/user.service');
      this._userService = new UserService(this.getUserRepository());
    }
    return this._userService!;
  }

  /**
   * Get Provider Service
   */
  public getProviderService(): IProviderService {
    if (!this._providerService) {
      const { ProviderService } = require('../services/provider.service');
      this._providerService = new ProviderService(this.getS3Client(), this.getConfig().buckets.questionData);
    }
    return this._providerService!;
  }

  /**
   * Get Exam Service
   */
  public getExamService(): IExamService {
    if (!this._examService) {
      const { ExamService } = require('../services/exam.service');
      this._examService = new ExamService(this.getS3Client(), this.getConfig().buckets.questionData);
    }
    return this._examService!;
  }

  /**
   * Get Topic Service
   */
  public getTopicService(): ITopicService {
    if (!this._topicService) {
      const { TopicService } = require('../services/topic.service');
      this._topicService = new TopicService(this.getS3Client(), this.getConfig().buckets.questionData);
    }
    return this._topicService!;
  }

  /**
   * Get Question Service
   */
  public getQuestionService(): IQuestionService {
    if (!this._questionService) {
      // Will be implemented in Phase 2
      throw new Error('QuestionService not implemented yet - Phase 2');
    }
    return this._questionService;
  }

  /**
   * Get Session Service
   */
  public getSessionService(): ISessionService {
    if (!this._sessionService) {
      // Will be implemented in Phase 2
      throw new Error('SessionService not implemented yet - Phase 2');
    }
    return this._sessionService;
  }

  /**
   * Get Analytics Service
   */
  public getAnalyticsService(): IAnalyticsService {
    if (!this._analyticsService) {
      // Will be implemented in Phase 2
      throw new Error('AnalyticsService not implemented yet - Phase 2');
    }
    return this._analyticsService;
  }

  /**
   * Get Goals Service
   */
  public getGoalsService(): IGoalsService {
    if (!this._goalsService) {
      // Will be implemented in Phase 2
      throw new Error('GoalsService not implemented yet - Phase 2');
    }
    return this._goalsService;
  }

  // Repository getters (Phase 2+ implementations)

  /**
   * Get User Repository
   */
  public getUserRepository(): IUserRepository {
    if (!this._userRepository) {
      const { UserRepository } = require('../repositories/user.repository');
      this._userRepository = new UserRepository(this.getDynamoClient(), this.getConfig());
    }
    return this._userRepository!;
  }

  /**
   * Get Session Repository
   */
  public getSessionRepository(): ISessionRepository {
    if (!this._sessionRepository) {
      // Will be implemented in Phase 2
      throw new Error('SessionRepository not implemented yet - Phase 2');
    }
    return this._sessionRepository;
  }

  /**
   * Get Question Repository
   */
  public getQuestionRepository(): IQuestionRepository {
    if (!this._questionRepository) {
      // Will be implemented in Phase 2
      throw new Error('QuestionRepository not implemented yet - Phase 2');
    }
    return this._questionRepository;
  }

  /**
   * Get Progress Repository
   */
  public getProgressRepository(): IProgressRepository {
    if (!this._progressRepository) {
      // Will be implemented in Phase 2
      throw new Error('ProgressRepository not implemented yet - Phase 2');
    }
    return this._progressRepository;
  }

  /**
   * Get Goals Repository
   */
  public getGoalsRepository(): IGoalsRepository {
    if (!this._goalsRepository) {
      // Will be implemented in Phase 2
      throw new Error('GoalsRepository not implemented yet - Phase 2');
    }
    return this._goalsRepository;
  }

  /**
   * Reset all services and clients (useful for testing)
   */
  public reset(): void {
    this._dynamoClient = null;
    this._s3Client = null;
    this._authService = null;
    this._userService = null;
    this._providerService = null;
    this._examService = null;
    this._topicService = null;
    this._questionService = null;
    this._sessionService = null;
    this._analyticsService = null;
    this._goalsService = null;
    this._healthService = null;
    this._userRepository = null;
    this._sessionRepository = null;
    this._questionRepository = null;
    this._progressRepository = null;
    this._goalsRepository = null;
  }
}