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
import type { IGoalsProgressTracker } from '../services/goals-progress-tracker.service';
import type { IProfileService, IAchievementCalculator } from '../shared/types/profile.types';
export type { IAuthService, IUserService, IProviderService, IExamService, ITopicService, IQuestionService, ISessionService, IGoalsService, IGoalsProgressTracker, ISessionOrchestratorService, IAnswerProcessorService, ISessionAnalyzerService, IProfileService, IAchievementCalculator };

// Import repository interfaces
import type { IUserRepository } from '../repositories/user.repository';
import type { ISessionRepository } from '../repositories/session.repository';
import type { IProviderRepository } from '../repositories/provider.repository';
import type { IExamRepository } from '../repositories/exam.repository';
import type { ITopicRepository } from '../repositories/topic.repository';
import type { IQuestionRepository } from '../repositories/question.repository';
import type { IGoalsRepository } from '../repositories/goals.repository';
import type { IHealthRepository } from '../repositories/health.repository';
import type { IProfileRepository } from '../repositories/profile.repository';
import type { IAnalyticsRepository } from '../repositories/analytics.repository';
export type { IUserRepository, ISessionRepository, IProviderRepository, IExamRepository, ITopicRepository, IQuestionRepository, IGoalsRepository, IHealthRepository, IProfileRepository, IAnalyticsRepository };

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
 * Base factory for AWS clients and configuration management
 * Provides foundation infrastructure for domain-specific factories
 */
export class InfrastructureFactory {
  private static instance: InfrastructureFactory;
  private config: ServiceConfig;
  
  // AWS Clients (lazy initialized)
  private _dynamoClient: DynamoDBDocumentClient | null = null;
  private _s3Client: S3Client | null = null;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get InfrastructureFactory singleton instance
   */
  public static getInstance(): InfrastructureFactory {
    if (!InfrastructureFactory.instance) {
      InfrastructureFactory.instance = new InfrastructureFactory();
    }
    return InfrastructureFactory.instance;
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

  /**
   * Reset all clients (useful for testing)
   */
  public reset(): void {
    this._dynamoClient = null;
    this._s3Client = null;
  }
}

/**
 * Authentication domain factory
 * Manages user authentication and user management services
 */
export class AuthenticationFactory {
  private static instance: AuthenticationFactory;
  private infrastructureFactory: InfrastructureFactory;
  
  // Repositories (lazy initialized)
  private _userRepository: IUserRepository | null = null;

  // Services (lazy initialized)
  private _authService: IAuthService | null = null;
  private _userService: IUserService | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
  }

  /**
   * Get AuthenticationFactory singleton instance
   */
  public static getInstance(): AuthenticationFactory {
    if (!AuthenticationFactory.instance) {
      AuthenticationFactory.instance = new AuthenticationFactory();
    }
    return AuthenticationFactory.instance;
  }

  /**
   * Get User Repository
   */
  public getUserRepository(): IUserRepository {
    if (!this._userRepository) {
      const { UserRepository } = require('../repositories/user.repository');
      this._userRepository = new UserRepository(
        this.infrastructureFactory.getDynamoClient(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._userRepository!;
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
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    this._userRepository = null;
    this._userService = null;
    this._authService = null;
  }
}

/**
 * Study domain factory
 * Manages study sessions, questions, and related repositories/services
 */
export class StudyFactory {
  private static instance: StudyFactory;
  private infrastructureFactory: InfrastructureFactory;
  
  // Repositories (lazy initialized)
  private _sessionRepository: ISessionRepository | null = null;
  private _providerRepository: IProviderRepository | null = null;
  private _examRepository: IExamRepository | null = null;
  private _topicRepository: ITopicRepository | null = null;
  private _questionRepository: IQuestionRepository | null = null;

  // Services (lazy initialized)
  private _providerService: IProviderService | null = null;
  private _examService: IExamService | null = null;
  private _topicService: ITopicService | null = null;
  private _questionService: IQuestionService | null = null;
  private _sessionService: ISessionService | null = null;
  private _sessionOrchestrator: ISessionOrchestratorService | null = null;
  private _answerProcessor: IAnswerProcessorService | null = null;
  private _sessionAnalyzer: ISessionAnalyzerService | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
  }

  /**
   * Get StudyFactory singleton instance
   */
  public static getInstance(): StudyFactory {
    if (!StudyFactory.instance) {
      StudyFactory.instance = new StudyFactory();
    }
    return StudyFactory.instance;
  }

  // Repository getters

  /**
   * Get Session Repository
   */
  public getSessionRepository(): ISessionRepository {
    if (!this._sessionRepository) {
      const { SessionRepository } = require('../repositories/session.repository');
      this._sessionRepository = new SessionRepository(
        this.infrastructureFactory.getDynamoClient(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._sessionRepository!;
  }

  /**
   * Get Provider Repository
   */
  public getProviderRepository(): IProviderRepository {
    if (!this._providerRepository) {
      const { ProviderRepository } = require('../repositories/provider.repository');
      this._providerRepository = new ProviderRepository(
        this.infrastructureFactory.getS3Client(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._providerRepository!;
  }

  /**
   * Get Exam Repository
   */
  public getExamRepository(): IExamRepository {
    if (!this._examRepository) {
      const { ExamRepository } = require('../repositories/exam.repository');
      this._examRepository = new ExamRepository(
        this.infrastructureFactory.getS3Client(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._examRepository!;
  }

  /**
   * Get Topic Repository
   */
  public getTopicRepository(): ITopicRepository {
    if (!this._topicRepository) {
      const { TopicRepository } = require('../repositories/topic.repository');
      this._topicRepository = new TopicRepository(
        this.infrastructureFactory.getS3Client(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._topicRepository!;
  }

  /**
   * Get Question Repository
   */
  public getQuestionRepository(): IQuestionRepository {
    if (!this._questionRepository) {
      const { QuestionRepository } = require('../repositories/question.repository');
      this._questionRepository = new QuestionRepository(
        this.infrastructureFactory.getS3Client(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._questionRepository!;
  }

  // Service getters

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
      const { QuestionService, QuestionSelector, QuestionAnalyzer } = require('../services/question.service');
      
      // Create question selector service
      const questionSelector = new QuestionSelector();
      
      // Create question analyzer service (depends on selector)
      const questionAnalyzer = new QuestionAnalyzer(questionSelector);
      
      // Create main question service with dependencies
      this._questionService = new QuestionService(
        this.getQuestionRepository(),
        questionSelector,
        questionAnalyzer
      );
    }
    return this._questionService!;
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
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    // Reset repositories
    this._sessionRepository = null;
    this._providerRepository = null;
    this._examRepository = null;
    this._topicRepository = null;
    this._questionRepository = null;

    // Reset services
    this._providerService = null;
    this._examService = null;
    this._topicService = null;
    this._questionService = null;
    this._sessionService = null;
    this._sessionOrchestrator = null;
    this._answerProcessor = null;
    this._sessionAnalyzer = null;
  }
}

/**
 * Analytics domain factory
 * Manages analytics services and repositories for performance tracking
 */
export class AnalyticsFactory {
  private static instance: AnalyticsFactory;
  private infrastructureFactory: InfrastructureFactory;
  
  // Repositories (lazy initialized)
  private _analyticsRepository: IAnalyticsRepository | null = null;

  // Services (lazy initialized)
  private _analyticsService: IAnalyticsService | null = null;
  private _progressAnalyzer: IProgressAnalyzer | null = null;
  private _competencyAnalyzer: ICompetencyAnalyzer | null = null;
  private _performanceAnalyzer: IPerformanceAnalyzer | null = null;
  private _insightGenerator: IInsightGenerator | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
  }

  /**
   * Get AnalyticsFactory singleton instance
   */
  public static getInstance(): AnalyticsFactory {
    if (!AnalyticsFactory.instance) {
      AnalyticsFactory.instance = new AnalyticsFactory();
    }
    return AnalyticsFactory.instance;
  }

  /**
   * Get Analytics Repository
   */
  public getAnalyticsRepository(): IAnalyticsRepository {
    if (!this._analyticsRepository) {
      const { AnalyticsRepository } = require('../repositories/analytics.repository');
      this._analyticsRepository = new AnalyticsRepository(
        this.infrastructureFactory.getDynamoClient(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._analyticsRepository!;
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
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    this._analyticsRepository = null;
    this._analyticsService = null;
    this._progressAnalyzer = null;
    this._competencyAnalyzer = null;
    this._performanceAnalyzer = null;
    this._insightGenerator = null;
  }
}

/**
 * Goals domain factory
 * Manages goals and progress tracking services
 */
export class GoalsFactory {
  private static instance: GoalsFactory;
  private infrastructureFactory: InfrastructureFactory;
  private studyFactory: StudyFactory;
  
  // Repositories (lazy initialized)
  private _goalsRepository: IGoalsRepository | null = null;

  // Services (lazy initialized)
  private _goalsService: IGoalsService | null = null;
  private _goalsProgressTracker: IGoalsProgressTracker | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
    this.studyFactory = StudyFactory.getInstance();
  }

  /**
   * Get GoalsFactory singleton instance
   */
  public static getInstance(): GoalsFactory {
    if (!GoalsFactory.instance) {
      GoalsFactory.instance = new GoalsFactory();
    }
    return GoalsFactory.instance;
  }

  /**
   * Get Goals Repository
   */
  public getGoalsRepository(): IGoalsRepository {
    if (!this._goalsRepository) {
      const { GoalsRepository } = require('../repositories/goals.repository');
      this._goalsRepository = new GoalsRepository(
        this.infrastructureFactory.getDynamoClient(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._goalsRepository!;
  }

  /**
   * Get Goals Progress Tracker Service
   */
  public getGoalsProgressTracker(): IGoalsProgressTracker {
    if (!this._goalsProgressTracker) {
      const { GoalsProgressTracker } = require('../services/goals-progress-tracker.service');
      this._goalsProgressTracker = new GoalsProgressTracker(
        this.getGoalsRepository()
      );
    }
    return this._goalsProgressTracker!;
  }

  /**
   * Get Goals Service
   */
  public getGoalsService(): IGoalsService {
    if (!this._goalsService) {
      const { GoalsService } = require('../services/goals.service');
      this._goalsService = new GoalsService(
        this.getGoalsRepository(),
        this.studyFactory.getProviderService(),
        this.studyFactory.getExamService(),
        this.studyFactory.getTopicService(),
        this.getGoalsProgressTracker()
      );
    }
    return this._goalsService!;
  }

  /**
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    this._goalsRepository = null;
    this._goalsService = null;
    this._goalsProgressTracker = null;
  }
}

/**
 * Profile domain factory
 * Manages user profiles and achievement calculations
 */
export class ProfileFactory {
  private static instance: ProfileFactory;
  private infrastructureFactory: InfrastructureFactory;
  
  // Repositories (lazy initialized)
  private _profileRepository: IProfileRepository | null = null;

  // Services (lazy initialized)
  private _profileService: IProfileService | null = null;
  private _achievementCalculator: IAchievementCalculator | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
  }

  /**
   * Get ProfileFactory singleton instance
   */
  public static getInstance(): ProfileFactory {
    if (!ProfileFactory.instance) {
      ProfileFactory.instance = new ProfileFactory();
    }
    return ProfileFactory.instance;
  }

  /**
   * Get Profile Repository
   */
  public getProfileRepository(): IProfileRepository {
    if (!this._profileRepository) {
      const { ProfileRepository } = require('../repositories/profile.repository');
      this._profileRepository = new ProfileRepository(
        this.infrastructureFactory.getDynamoClient(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._profileRepository!;
  }

  /**
   * Get Achievement Calculator Service
   */
  public getAchievementCalculator(): IAchievementCalculator {
    if (!this._achievementCalculator) {
      const { AchievementCalculator } = require('../services/achievement-calculator.service');
      this._achievementCalculator = new AchievementCalculator(
        this.getProfileRepository()
      );
    }
    return this._achievementCalculator!;
  }

  /**
   * Get Profile Service
   */
  public getProfileService(): IProfileService {
    if (!this._profileService) {
      const { ProfileService } = require('../services/profile.service');
      this._profileService = new ProfileService(
        this.getProfileRepository(),
        this.getAchievementCalculator()
      );
    }
    return this._profileService!;
  }

  /**
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    this._profileRepository = null;
    this._profileService = null;
    this._achievementCalculator = null;
  }
}

/**
 * Health domain factory
 * Manages health monitoring and system diagnostics
 */
export class HealthFactory {
  private static instance: HealthFactory;
  private infrastructureFactory: InfrastructureFactory;
  
  // Repositories (lazy initialized)
  private _healthRepository: IHealthRepository | null = null;

  // Services (lazy initialized)
  private _healthService: IHealthService | null = null;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
  }

  /**
   * Get HealthFactory singleton instance
   */
  public static getInstance(): HealthFactory {
    if (!HealthFactory.instance) {
      HealthFactory.instance = new HealthFactory();
    }
    return HealthFactory.instance;
  }

  /**
   * Get Health Repository
   */
  public getHealthRepository(): IHealthRepository {
    if (!this._healthRepository) {
      const { HealthRepository } = require('../repositories/health.repository');
      // Health repository needs the raw DynamoDB client for DescribeTableCommand
      const dynamoClient = new DynamoDBClient({
        region: this.infrastructureFactory.getConfig().region,
      });
      this._healthRepository = new HealthRepository(
        dynamoClient, 
        this.infrastructureFactory.getS3Client(), 
        this.infrastructureFactory.getConfig()
      );
    }
    return this._healthRepository!;
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
   * Reset all services and repositories (useful for testing)
   */
  public reset(): void {
    this._healthRepository = null;
    this._healthService = null;
  }
}

/**
 * Main ServiceFactory class - orchestrates domain-specific factories
 * Maintains backward compatibility while delegating to focused factories
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  
  // Domain-specific factories
  private infrastructureFactory: InfrastructureFactory;
  private authenticationFactory: AuthenticationFactory;
  private studyFactory: StudyFactory;
  private analyticsFactory: AnalyticsFactory;
  private goalsFactory: GoalsFactory;
  private profileFactory: ProfileFactory;
  private healthFactory: HealthFactory;

  private constructor() {
    this.infrastructureFactory = InfrastructureFactory.getInstance();
    this.authenticationFactory = AuthenticationFactory.getInstance();
    this.studyFactory = StudyFactory.getInstance();
    this.analyticsFactory = AnalyticsFactory.getInstance();
    this.goalsFactory = GoalsFactory.getInstance();
    this.profileFactory = ProfileFactory.getInstance();
    this.healthFactory = HealthFactory.getInstance();
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

  // Infrastructure delegation methods

  /**
   * Get DynamoDB Document Client
   */
  public getDynamoClient(): DynamoDBDocumentClient {
    return this.infrastructureFactory.getDynamoClient();
  }

  /**
   * Get S3 Client
   */
  public getS3Client(): S3Client {
    return this.infrastructureFactory.getS3Client();
  }

  /**
   * Get configuration
   */
  public getConfig(): ServiceConfig {
    return this.infrastructureFactory.getConfig();
  }

  // Authentication domain delegation

  /**
   * Get User Repository
   */
  public getUserRepository(): IUserRepository {
    return this.authenticationFactory.getUserRepository();
  }

  /**
   * Get User Service
   */
  public getUserService(): IUserService {
    return this.authenticationFactory.getUserService();
  }

  /**
   * Get Auth Service
   */
  public getAuthService(): IAuthService {
    return this.authenticationFactory.getAuthService();
  }

  // Study domain delegation

  /**
   * Get Session Repository
   */
  public getSessionRepository(): ISessionRepository {
    return this.studyFactory.getSessionRepository();
  }

  /**
   * Get Provider Repository
   */
  public getProviderRepository(): IProviderRepository {
    return this.studyFactory.getProviderRepository();
  }

  /**
   * Get Exam Repository
   */
  public getExamRepository(): IExamRepository {
    return this.studyFactory.getExamRepository();
  }

  /**
   * Get Topic Repository
   */
  public getTopicRepository(): ITopicRepository {
    return this.studyFactory.getTopicRepository();
  }

  /**
   * Get Question Repository
   */
  public getQuestionRepository(): IQuestionRepository {
    return this.studyFactory.getQuestionRepository();
  }

  /**
   * Get Provider Service
   */
  public getProviderService(): IProviderService {
    return this.studyFactory.getProviderService();
  }

  /**
   * Get Exam Service
   */
  public getExamService(): IExamService {
    return this.studyFactory.getExamService();
  }

  /**
   * Get Topic Service
   */
  public getTopicService(): ITopicService {
    return this.studyFactory.getTopicService();
  }

  /**
   * Get Question Service
   */
  public getQuestionService(): IQuestionService {
    return this.studyFactory.getQuestionService();
  }

  /**
   * Get Session Service
   */
  public getSessionService(): ISessionService {
    return this.studyFactory.getSessionService();
  }

  /**
   * Get Session Orchestrator Service
   */
  public getSessionOrchestrator(): ISessionOrchestratorService {
    return this.studyFactory.getSessionOrchestrator();
  }

  /**
   * Get Answer Processor Service
   */
  public getAnswerProcessor(): IAnswerProcessorService {
    return this.studyFactory.getAnswerProcessor();
  }

  /**
   * Get Session Analyzer Service
   */
  public getSessionAnalyzer(): ISessionAnalyzerService {
    return this.studyFactory.getSessionAnalyzer();
  }

  // Analytics domain delegation

  /**
   * Get Analytics Repository
   */
  public getAnalyticsRepository(): IAnalyticsRepository {
    return this.analyticsFactory.getAnalyticsRepository();
  }

  /**
   * Get Analytics Service
   */
  public getAnalyticsService(): IAnalyticsService {
    return this.analyticsFactory.getAnalyticsService();
  }

  /**
   * Get Progress Analyzer Service
   */
  public getProgressAnalyzer(): IProgressAnalyzer {
    return this.analyticsFactory.getProgressAnalyzer();
  }

  /**
   * Get Competency Analyzer Service
   */
  public getCompetencyAnalyzer(): ICompetencyAnalyzer {
    return this.analyticsFactory.getCompetencyAnalyzer();
  }

  /**
   * Get Performance Analyzer Service
   */
  public getPerformanceAnalyzer(): IPerformanceAnalyzer {
    return this.analyticsFactory.getPerformanceAnalyzer();
  }

  /**
   * Get Insight Generator Service
   */
  public getInsightGenerator(): IInsightGenerator {
    return this.analyticsFactory.getInsightGenerator();
  }

  // Goals domain delegation

  /**
   * Get Goals Repository
   */
  public getGoalsRepository(): IGoalsRepository {
    return this.goalsFactory.getGoalsRepository();
  }

  /**
   * Get Goals Service
   */
  public getGoalsService(): IGoalsService {
    return this.goalsFactory.getGoalsService();
  }

  /**
   * Get Goals Progress Tracker Service
   */
  public getGoalsProgressTracker(): IGoalsProgressTracker {
    return this.goalsFactory.getGoalsProgressTracker();
  }

  // Profile domain delegation

  /**
   * Get Profile Repository
   */
  public getProfileRepository(): IProfileRepository {
    return this.profileFactory.getProfileRepository();
  }

  /**
   * Get Profile Service
   */
  public getProfileService(): IProfileService {
    return this.profileFactory.getProfileService();
  }

  /**
   * Get Achievement Calculator Service
   */
  public getAchievementCalculator(): IAchievementCalculator {
    return this.profileFactory.getAchievementCalculator();
  }

  // Health domain delegation

  /**
   * Get Health Repository
   */
  public getHealthRepository(): IHealthRepository {
    return this.healthFactory.getHealthRepository();
  }

  /**
   * Get Health Service
   */
  public getHealthService(): IHealthService {
    return this.healthFactory.getHealthService();
  }

  /**
   * Reset all services and clients (useful for testing)
   */
  public reset(): void {
    this.infrastructureFactory.reset();
    this.authenticationFactory.reset();
    this.studyFactory.reset();
    this.analyticsFactory.reset();
    this.goalsFactory.reset();
    this.profileFactory.reset();
    this.healthFactory.reset();
  }
}