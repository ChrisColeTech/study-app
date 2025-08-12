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
import type { IQuestionService } from '../services/question.service';
import type { ISessionService } from '../services/session.service';
import type { ISessionOrchestrator as ISessionOrchestratorService } from '../services/session-orchestrator.service';
import type { IAnswerProcessor as IAnswerProcessorService } from '../services/answer-processor.service';
import type { ISessionAnalyzer as ISessionAnalyzerService } from '../services/session-analyzer.service';
import type { IGoalsService } from '../services/goals.service';
export type { IAuthService, IUserService, IProviderService, IExamService, ITopicService, IQuestionService, ISessionService, IGoalsService, ISessionOrchestratorService, IAnswerProcessorService, ISessionAnalyzerService };

// Import repository interfaces
import type { IUserRepository } from '../repositories/user.repository';
import type { ISessionRepository } from '../repositories/session.repository';
import type { IProviderRepository } from '../repositories/provider.repository';
import type { IExamRepository } from '../repositories/exam.repository';
import type { ITopicRepository } from '../repositories/topic.repository';
import type { IQuestionRepository } from '../repositories/question.repository';
import type { IGoalsRepository } from '../repositories/goals.repository';
import type { IHealthRepository } from '../repositories/health.repository';
import type { IAnalyticsRepository } from '../repositories/analytics.repository';
export type { IUserRepository, ISessionRepository, IProviderRepository, IExamRepository, ITopicRepository, IQuestionRepository, IGoalsRepository, IHealthRepository, IAnalyticsRepository };

// Import analytics service interface from types
import type { 
  IAnalyticsService,
  IProgressAnalyzer,
  ICompetencyAnalyzer,
  IPerformanceAnalyzer,
  IInsightGenerator
} from '../shared/types/analytics.types';
export type { IAnalyticsService, IProgressAnalyzer, ICompetencyAnalyzer, IPerformanceAnalyzer, IInsightGenerator };

export interface IHealthService {
  checkHealth(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
    version: string;
    dependencies?: { [key: string]: any };
    error?: string;
    totalTime?: number;
  }>;
  checkDatabaseHealth(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }>;
  checkStorageHealth(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }>;
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
  s3: {
    bucketName: string;
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

  // Repositories (lazy initialized)
  private _userRepository: IUserRepository | null = null;
  private _sessionRepository: ISessionRepository | null = null;
  private _providerRepository: IProviderRepository | null = null;
  private _examRepository: IExamRepository | null = null;
  private _topicRepository: ITopicRepository | null = null;
  private _questionRepository: IQuestionRepository | null = null;
  private _goalsRepository: IGoalsRepository | null = null;
  private _healthRepository: IHealthRepository | null = null;
  private _analyticsRepository: IAnalyticsRepository | null = null;

  // Services (lazy initialized)
  private _authService: IAuthService | null = null;
  private _userService: IUserService | null = null;
  private _providerService: IProviderService | null = null;
  private _examService: IExamService | null = null;
  private _topicService: ITopicService | null = null;
  private _questionService: IQuestionService | null = null;
  private _sessionService: ISessionService | null = null;
  private _sessionOrchestrator: ISessionOrchestratorService | null = null;
  private _answerProcessor: IAnswerProcessorService | null = null;
  private _sessionAnalyzer: ISessionAnalyzerService | null = null;
  private _analyticsService: IAnalyticsService | null = null;
  private _progressAnalyzer: IProgressAnalyzer | null = null;
  private _competencyAnalyzer: ICompetencyAnalyzer | null = null;
  private _performanceAnalyzer: IPerformanceAnalyzer | null = null;
  private _insightGenerator: IInsightGenerator | null = null;
  private _goalsService: IGoalsService | null = null;
  private _healthService: IHealthService | null = null;

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
    const questionDataBucket = process.env.QUESTION_DATA_BUCKET_NAME || '';
    return {
      region: process.env.AWS_REGION || 'us-east-1',
      environment: process.env.NODE_ENV || 'dev',
      tables: {
        users: process.env.USERS_TABLE_NAME || '',
        studySessions: process.env.STUDY_SESSIONS_TABLE_NAME || '',
        userProgress: process.env.USER_PROGRESS_TABLE_NAME || '',
        goals: process.env.GOALS_TABLE_NAME || '',
      },
      s3: {
        bucketName: questionDataBucket,
      },
      buckets: {
        questionData: questionDataBucket,
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

  // Repository getters

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
      const { SessionRepository } = require('../repositories/session.repository');
      this._sessionRepository = new SessionRepository(this.getDynamoClient(), this.getConfig());
    }
    return this._sessionRepository!;
  }

  /**
   * Get Provider Repository
   */
  public getProviderRepository(): IProviderRepository {
    if (!this._providerRepository) {
      const { ProviderRepository } = require('../repositories/provider.repository');
      this._providerRepository = new ProviderRepository(this.getS3Client(), this.getConfig());
    }
    return this._providerRepository!;
  }

  /**
   * Get Exam Repository
   */
  public getExamRepository(): IExamRepository {
    if (!this._examRepository) {
      const { ExamRepository } = require('../repositories/exam.repository');
      this._examRepository = new ExamRepository(this.getS3Client(), this.getConfig());
    }
    return this._examRepository!;
  }

  /**
   * Get Topic Repository
   */
  public getTopicRepository(): ITopicRepository {
    if (!this._topicRepository) {
      const { TopicRepository } = require('../repositories/topic.repository');
      this._topicRepository = new TopicRepository(this.getS3Client(), this.getConfig());
    }
    return this._topicRepository!;
  }

  /**
   * Get Question Repository
   */
  public getQuestionRepository(): IQuestionRepository {
    if (!this._questionRepository) {
      const { QuestionRepository } = require('../repositories/question.repository');
      this._questionRepository = new QuestionRepository(this.getS3Client(), this.getConfig());
    }
    return this._questionRepository!;
  }

  /**
   * Get Goals Repository
   */
  public getGoalsRepository(): IGoalsRepository {
    if (!this._goalsRepository) {
      const { GoalsRepository } = require('../repositories/goals.repository');
      this._goalsRepository = new GoalsRepository(this.getDynamoClient(), this.getConfig());
    }
    return this._goalsRepository!;
  }

  /**
   * Get Health Repository
   */
  public getHealthRepository(): IHealthRepository {
    if (!this._healthRepository) {
      const { HealthRepository } = require('../repositories/health.repository');
      // Health repository needs the raw DynamoDB client for DescribeTableCommand
      const dynamoClient = new DynamoDBClient({
        region: this.config.region,
      });
      this._healthRepository = new HealthRepository(dynamoClient, this.getS3Client(), this.getConfig());
    }
    return this._healthRepository!;
  }

  // Service getters
  
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
      this._providerService = new ProviderService(this.getProviderRepository());
    }
    return this._providerService!;
  }

  /**
   * Get Exam Service
   */
  public getExamService(): IExamService {
    if (!this._examService) {
      const { ExamService } = require('../services/exam.service');
      this._examService = new ExamService(this.getExamRepository());
    }
    return this._examService!;
  }

  /**
   * Get Topic Service
   */
  public getTopicService(): ITopicService {
    if (!this._topicService) {
      const { TopicService } = require('../services/topic.service');
      this._topicService = new TopicService(this.getTopicRepository());
    }
    return this._topicService!;
  }

  /**
   * Get Question Service
   */
  public getQuestionService(): IQuestionService {
    if (!this._questionService) {
      const { QuestionService } = require('../services/question.service');
      this._questionService = new QuestionService(this.getQuestionRepository());
    }
    return this._questionService!;
  }

  /**
   * Get Session Service
   */
  public getSessionService(): ISessionService {
    if (!this._sessionService) {
      const { SessionService } = require('../services/session.service');
      this._sessionService = new SessionService(
        this.getSessionRepository(),
        this.getSessionOrchestrator(),
        this.getAnswerProcessor(),
        this.getProviderService(),
        this.getExamService(),
        this.getTopicService(),
        this.getQuestionService()
      );
    }
    return this._sessionService!;
  }

  /**
   * Get Session Orchestrator Service
   */
  public getSessionOrchestrator(): ISessionOrchestratorService {
    if (!this._sessionOrchestrator) {
      const { SessionOrchestrator } = require('../services/session-orchestrator.service');
      this._sessionOrchestrator = new SessionOrchestrator(
        this.getProviderService(),
        this.getExamService(),
        this.getTopicService(),
        this.getQuestionService()
      );
    }
    return this._sessionOrchestrator!;
  }

  /**
   * Get Answer Processor Service
   */
  public getAnswerProcessor(): IAnswerProcessorService {
    if (!this._answerProcessor) {
      const { AnswerProcessor } = require('../services/answer-processor.service');
      this._answerProcessor = new AnswerProcessor(
        this.getSessionRepository(),
        this.getSessionOrchestrator(),
        this.getSessionAnalyzer(),
        this.getTopicService(),
        this.getQuestionService()
      );
    }
    return this._answerProcessor!;
  }

  /**
   * Get Session Analyzer Service
   */
  public getSessionAnalyzer(): ISessionAnalyzerService {
    if (!this._sessionAnalyzer) {
      const { SessionAnalyzer } = require('../services/session-analyzer.service');
      this._sessionAnalyzer = new SessionAnalyzer();
    }
    return this._sessionAnalyzer!;
  }

  /**
   * Get Health Service
   */
  public getHealthService(): IHealthService {
    if (!this._healthService) {
      const { HealthService } = require('../services/health.service');
      this._healthService = new HealthService(this.getHealthRepository());
    }
    return this._healthService!;
  }

  /**
   * Get Analytics Repository
   */
  public getAnalyticsRepository(): IAnalyticsRepository {
    if (!this._analyticsRepository) {
      const { AnalyticsRepository } = require('../repositories/analytics.repository');
      this._analyticsRepository = new AnalyticsRepository(this.getDynamoClient(), this.getConfig());
    }
    return this._analyticsRepository!;
  }

  /**
   * Get Analytics Service
   */
  public getAnalyticsService(): IAnalyticsService {
    if (!this._analyticsService) {
      const { AnalyticsService } = require('../services/analytics.service');
      this._analyticsService = new AnalyticsService(
        this.getAnalyticsRepository(),
        this.getProgressAnalyzer(),
        this.getCompetencyAnalyzer(),
        this.getPerformanceAnalyzer(),
        this.getInsightGenerator()
      );
    }
    return this._analyticsService!;
  }

  /**
   * Get Progress Analyzer Service
   */
  public getProgressAnalyzer(): IProgressAnalyzer {
    if (!this._progressAnalyzer) {
      const { ProgressAnalyzer } = require('../services/progress-analyzer.service');
      this._progressAnalyzer = new ProgressAnalyzer(
        this.getAnalyticsRepository()
      );
    }
    return this._progressAnalyzer!;
  }

  /**
   * Get Competency Analyzer Service
   */
  public getCompetencyAnalyzer(): ICompetencyAnalyzer {
    if (!this._competencyAnalyzer) {
      const { CompetencyAnalyzer } = require('../services/competency-analyzer.service');
      this._competencyAnalyzer = new CompetencyAnalyzer(
        this.getAnalyticsRepository()
      );
    }
    return this._competencyAnalyzer!;
  }

  /**
   * Get Performance Analyzer Service
   */
  public getPerformanceAnalyzer(): IPerformanceAnalyzer {
    if (!this._performanceAnalyzer) {
      const { PerformanceAnalyzer } = require('../services/performance-analyzer.service');
      this._performanceAnalyzer = new PerformanceAnalyzer(
        this.getAnalyticsRepository()
      );
    }
    return this._performanceAnalyzer!;
  }

  /**
   * Get Insight Generator Service
   */
  public getInsightGenerator(): IInsightGenerator {
    if (!this._insightGenerator) {
      const { InsightGenerator } = require('../services/insight-generator.service');
      this._insightGenerator = new InsightGenerator(
        this.getAnalyticsRepository()
      );
    }
    return this._insightGenerator!;
  }

  /**
   * Get Goals Service
   */
  public getGoalsService(): IGoalsService {
    if (!this._goalsService) {
      const { GoalsService } = require('../services/goals.service');
      this._goalsService = new GoalsService(
        this.getGoalsRepository(),
        this.getProviderService(),
        this.getExamService(),
        this.getTopicService()
      );
    }
    return this._goalsService!;
  }

  /**
   * Reset all services and clients (useful for testing)
   */
  public reset(): void {
    this._dynamoClient = null;
    this._s3Client = null;
    
    // Reset repositories
    this._userRepository = null;
    this._sessionRepository = null;
    this._providerRepository = null;
    this._examRepository = null;
    this._topicRepository = null;
    this._questionRepository = null;
    this._goalsRepository = null;
    this._healthRepository = null;
    this._analyticsRepository = null;

    // Reset services
    this._authService = null;
    this._userService = null;
    this._providerService = null;
    this._examService = null;
    this._topicService = null;
    this._questionService = null;
    this._sessionService = null;
    this._sessionOrchestrator = null;
    this._answerProcessor = null;
    this._sessionAnalyzer = null;
    this._analyticsService = null;
    this._progressAnalyzer = null;
    this._competencyAnalyzer = null;
    this._performanceAnalyzer = null;
    this._insightGenerator = null;
    this._goalsService = null;
    this._healthService = null;
  }
}