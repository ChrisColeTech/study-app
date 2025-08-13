/**
 * Enhanced Configuration Management System
 * 
 * Provides centralized, type-safe configuration management with:
 * - Environment-specific configurations
 * - Comprehensive validation
 * - Performance optimization
 * - Feature flag support
 * - Structured logging configuration
 */

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging', 
  PRODUCTION = 'production',
  TEST = 'test'
}

export interface AWSConfig {
  region: string;
  accountId?: string;
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
  lambda: {
    functionName?: string;
    functionVersion?: string;
    runtime?: string;
    memorySize?: number;
    timeout?: string;
    logGroup?: string;
    logStream?: string;
  };
}

export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
}

export interface ApplicationConfig {
  name: string;
  version: string;
  environment: Environment;
  logLevel: string;
  debug: boolean;
}

export interface CORSConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  strictOriginCheck?: boolean;
  requireHttps?: boolean;
}

export interface DatabaseConfig {
  connectionPool: {
    maxConnections: number;
    minConnections: number;
    timeout: number;
    idleTimeout: number;
  };
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  performanceMonitoring: {
    enabled: boolean;
    slowQueryThreshold: number;
    metricsInterval: number;
  };
}

export interface LoggingConfig {
  level: string;
  format: 'json' | 'text';
  includeTimestamp: boolean;
  includeMetadata: boolean;
  redactSensitive: boolean;
  performance: {
    enabled: boolean;
    slowRequestThreshold: number;
    includeStackTrace: boolean;
  };
  destinations: {
    console: boolean;
    cloudWatch: boolean;
    file?: string;
  };
}

export interface PerformanceConfig {
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    includeMemoryUsage: boolean;
    includeResponseTimes: boolean;
  };
  caching: {
    enabled: boolean;
    defaultTtl: number;
    maxSize: number;
    cleanupInterval: number;
  };
  limits: {
    maxRequestSize: number;
    maxResponseSize: number;
    requestTimeout: number;
  };
}

export interface FeatureFlagsConfig {
  enableAdvancedAnalytics: boolean;
  enableRealTimeUpdates: boolean;
  enableExperimentalFeatures: boolean;
  enablePerformanceLogging: boolean;
  enableDetailedErrorReporting: boolean;
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationInterval: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  headers: {
    enableSecurityHeaders: boolean;
    strictTransportSecurity: boolean;
    contentSecurityPolicy: boolean;
  };
}

export interface AppConfiguration {
  aws: AWSConfig;
  auth: AuthConfig;
  app: ApplicationConfig;
  cors: CORSConfig;
  database: DatabaseConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  featureFlags: FeatureFlagsConfig;
  security: SecurityConfig;
}

export interface ConfigValidationError {
  field: string;
  value: any;
  message: string;
}

/**
 * Enhanced Configuration Manager with comprehensive configuration support
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private static configuration: AppConfiguration;
  private static environment: Environment;
  private static isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance of ConfigurationManager
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
      ConfigurationManager.initialize();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Initialize configuration from environment variables
   */
  private static initialize(): void {
    if (ConfigurationManager.isInitialized) return;

    // Determine environment
    const nodeEnv = process.env.NODE_ENV || 'development';
    ConfigurationManager.environment = ConfigurationManager.normalizeEnvironment(nodeEnv);

    // Load and validate configuration
    const config = ConfigurationManager.loadConfiguration();
    ConfigurationManager.validateConfiguration(config);
    ConfigurationManager.configuration = config;
    ConfigurationManager.isInitialized = true;
  }

  /**
   * Force re-initialization (for testing or hot-reload scenarios)
   */
  public static reinitialize(): void {
    ConfigurationManager.isInitialized = false;
    ConfigurationManager.initialize();
  }

  /**
   * Normalize environment string to standard enum value
   */
  private static normalizeEnvironment(env: string): Environment {
    switch (env.toLowerCase()) {
      case 'dev':
      case 'development':
        return Environment.DEVELOPMENT;
      case 'staging':
      case 'stage':
        return Environment.STAGING;
      case 'prod':
      case 'production':
        return Environment.PRODUCTION;
      case 'test':
        return Environment.TEST;
      default:
        return Environment.DEVELOPMENT;
    }
  }

  /**
   * Load configuration from environment variables with intelligent defaults
   */
  private static loadConfiguration(): AppConfiguration {
    const env = ConfigurationManager.environment;
    
    return {
      aws: {
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
        ...(process.env.AWS_ACCOUNT_ID && { accountId: process.env.AWS_ACCOUNT_ID }),
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
        lambda: {
          ...(process.env.AWS_LAMBDA_FUNCTION_NAME && { functionName: process.env.AWS_LAMBDA_FUNCTION_NAME }),
          ...(process.env.AWS_LAMBDA_FUNCTION_VERSION && { functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION }),
          ...(process.env.AWS_EXECUTION_ENV && { runtime: process.env.AWS_EXECUTION_ENV }),
          ...(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE && { memorySize: parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) }),
          ...(process.env.AWS_LAMBDA_FUNCTION_TIMEOUT && { timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT }),
          ...(process.env.AWS_LAMBDA_LOG_GROUP_NAME && { logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME }),
          ...(process.env.AWS_LAMBDA_LOG_STREAM_NAME && { logStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME }),
        }
      },
      auth: {
        jwtSecret: process.env.JWT_SECRET || '',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
      app: {
        name: 'study-app-v3',
        version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
        environment: env,
        logLevel: process.env.LOG_LEVEL || (env === Environment.PRODUCTION ? 'INFO' : 'DEBUG'),
        debug: [Environment.DEVELOPMENT, Environment.TEST].includes(env),
      },
      cors: {
        ...(process.env.CORS_ALLOWED_ORIGINS && { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()) }),
        ...(process.env.CORS_ALLOW_CREDENTIALS === 'true' && { allowCredentials: true }),
        ...(process.env.CORS_ALLOWED_METHODS && { allowedMethods: process.env.CORS_ALLOWED_METHODS.split(',').map(m => m.trim().toUpperCase()) }),
        ...(process.env.CORS_ALLOWED_HEADERS && { allowedHeaders: process.env.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim()) }),
        ...(process.env.CORS_STRICT_ORIGIN_CHECK === 'true' && { strictOriginCheck: true }),
        ...(process.env.CORS_REQUIRE_HTTPS === 'true' && { requireHttps: true }),
      },
      database: ConfigurationManager.getDatabaseConfig(env),
      logging: ConfigurationManager.getLoggingConfig(env),
      performance: ConfigurationManager.getPerformanceConfig(env),
      featureFlags: ConfigurationManager.getFeatureFlagsConfig(env),
      security: ConfigurationManager.getSecurityConfig(env),
    };
  }

  /**
   * Get environment-specific database configuration
   */
  private static getDatabaseConfig(env: Environment): DatabaseConfig {
    switch (env) {
      case Environment.PRODUCTION:
        return {
          connectionPool: {
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '50'),
            minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
            timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
            idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
          },
          retry: {
            maxAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS || '3'),
            backoffMultiplier: parseFloat(process.env.DB_RETRY_BACKOFF || '2.0'),
            initialDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
          },
          performanceMonitoring: {
            enabled: process.env.DB_PERFORMANCE_MONITORING !== 'false',
            slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '5000'),
            metricsInterval: parseInt(process.env.DB_METRICS_INTERVAL || '60000'),
          },
        };
      case Environment.STAGING:
        return {
          connectionPool: {
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
            minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
            timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '20000'),
            idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '180000'),
          },
          retry: {
            maxAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS || '3'),
            backoffMultiplier: parseFloat(process.env.DB_RETRY_BACKOFF || '2.0'),
            initialDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
          },
          performanceMonitoring: {
            enabled: process.env.DB_PERFORMANCE_MONITORING !== 'false',
            slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '3000'),
            metricsInterval: parseInt(process.env.DB_METRICS_INTERVAL || '60000'),
          },
        };
      default:
        return {
          connectionPool: {
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
            minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '1'),
            timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
            idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '60000'),
          },
          retry: {
            maxAttempts: parseInt(process.env.DB_MAX_RETRY_ATTEMPTS || '2'),
            backoffMultiplier: parseFloat(process.env.DB_RETRY_BACKOFF || '1.5'),
            initialDelay: parseInt(process.env.DB_RETRY_DELAY || '500'),
          },
          performanceMonitoring: {
            enabled: process.env.DB_PERFORMANCE_MONITORING === 'true',
            slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '2000'),
            metricsInterval: parseInt(process.env.DB_METRICS_INTERVAL || '30000'),
          },
        };
    }
  }

  /**
   * Get environment-specific logging configuration
   */
  private static getLoggingConfig(env: Environment): LoggingConfig {
    return {
      level: process.env.LOG_LEVEL || (env === Environment.PRODUCTION ? 'INFO' : 'DEBUG'),
      format: (process.env.LOG_FORMAT as 'json' | 'text') || (env === Environment.PRODUCTION ? 'json' : 'text'),
      includeTimestamp: process.env.LOG_INCLUDE_TIMESTAMP !== 'false',
      includeMetadata: process.env.LOG_INCLUDE_METADATA !== 'false',
      redactSensitive: process.env.LOG_REDACT_SENSITIVE !== 'false',
      performance: {
        enabled: process.env.LOG_PERFORMANCE_ENABLED === 'true',
        slowRequestThreshold: parseInt(process.env.LOG_SLOW_REQUEST_THRESHOLD || '5000'),
        includeStackTrace: env !== Environment.PRODUCTION,
      },
      destinations: {
        console: process.env.LOG_CONSOLE !== 'false',
        cloudWatch: env !== Environment.TEST && process.env.LOG_CLOUDWATCH !== 'false',
        ...(process.env.LOG_FILE_PATH && { file: process.env.LOG_FILE_PATH }),
      },
    };
  }

  /**
   * Get environment-specific performance configuration
   */
  private static getPerformanceConfig(env: Environment): PerformanceConfig {
    return {
      monitoring: {
        enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.PERFORMANCE_METRICS_INTERVAL || '60000'),
        includeMemoryUsage: process.env.PERFORMANCE_INCLUDE_MEMORY !== 'false',
        includeResponseTimes: process.env.PERFORMANCE_INCLUDE_RESPONSE_TIMES !== 'false',
      },
      caching: {
        enabled: process.env.CACHING_ENABLED !== 'false',
        defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300000'),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
        cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '600000'),
      },
      limits: {
        maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760'), // 10MB
        maxResponseSize: parseInt(process.env.MAX_RESPONSE_SIZE || '52428800'), // 50MB
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      },
    };
  }

  /**
   * Get environment-specific feature flags configuration
   */
  private static getFeatureFlagsConfig(env: Environment): FeatureFlagsConfig {
    return {
      enableAdvancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS !== 'false',
      enableRealTimeUpdates: process.env.FEATURE_REALTIME_UPDATES === 'true',
      enableExperimentalFeatures: env === Environment.DEVELOPMENT && process.env.FEATURE_EXPERIMENTAL === 'true',
      enablePerformanceLogging: process.env.FEATURE_PERFORMANCE_LOGGING !== 'false',
      enableDetailedErrorReporting: env !== Environment.PRODUCTION && process.env.FEATURE_DETAILED_ERRORS !== 'false',
    };
  }

  /**
   * Get environment-specific security configuration
   */
  private static getSecurityConfig(env: Environment): SecurityConfig {
    return {
      encryption: {
        enabled: env === Environment.PRODUCTION || process.env.SECURITY_ENCRYPTION_ENABLED === 'true',
        algorithm: process.env.SECURITY_ENCRYPTION_ALGORITHM || 'AES-256-GCM',
        keyRotationInterval: parseInt(process.env.SECURITY_KEY_ROTATION_INTERVAL || '2592000000'), // 30 days
      },
      rateLimit: {
        enabled: process.env.SECURITY_RATE_LIMIT_ENABLED !== 'false',
        windowMs: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        maxRequests: parseInt(process.env.SECURITY_RATE_LIMIT_MAX || 
          (env === Environment.PRODUCTION ? '1000' : '100')),
        skipSuccessfulRequests: process.env.SECURITY_RATE_LIMIT_SKIP_SUCCESS === 'true',
      },
      headers: {
        enableSecurityHeaders: process.env.SECURITY_HEADERS_ENABLED !== 'false',
        strictTransportSecurity: env === Environment.PRODUCTION,
        contentSecurityPolicy: process.env.SECURITY_CSP_ENABLED === 'true',
      },
    };
  }

  /**
   * Validate configuration values with comprehensive checks
   */
  private static validateConfiguration(config: AppConfiguration): void {
    const errors: ConfigValidationError[] = [];

    // Validate required AWS configuration
    if (!config.aws.region) {
      errors.push({ field: 'AWS_REGION', value: config.aws.region, message: 'AWS region is required' });
    }

    // Validate table names (required for all environments except test)
    if (ConfigurationManager.environment !== Environment.TEST) {
      if (!config.aws.tables.users) {
        errors.push({ field: 'USERS_TABLE_NAME', value: config.aws.tables.users, message: 'Users table name is required' });
      }
      if (!config.aws.tables.studySessions) {
        errors.push({ field: 'STUDY_SESSIONS_TABLE_NAME', value: config.aws.tables.studySessions, message: 'Study sessions table name is required' });
      }
      if (!config.aws.tables.userProgress) {
        errors.push({ field: 'USER_PROGRESS_TABLE_NAME', value: config.aws.tables.userProgress, message: 'User progress table name is required' });
      }
      if (!config.aws.tables.goals) {
        errors.push({ field: 'GOALS_TABLE_NAME', value: config.aws.tables.goals, message: 'Goals table name is required' });
      }
    }

    // Validate bucket names (required for production and staging)
    if ([Environment.PRODUCTION, Environment.STAGING].includes(ConfigurationManager.environment)) {
      if (!config.aws.buckets.questionData) {
        errors.push({ field: 'QUESTION_DATA_BUCKET_NAME', value: config.aws.buckets.questionData, message: 'Question data bucket name is required for production/staging' });
      }
    }

    // Validate JWT secrets (critical for security)
    if (!config.auth.jwtSecret) {
      errors.push({ field: 'JWT_SECRET', value: undefined, message: 'JWT secret is required' });
    }
    if (!config.auth.jwtRefreshSecret) {
      errors.push({ field: 'JWT_REFRESH_SECRET', value: undefined, message: 'JWT refresh secret is required' });
    }

    // Validate production security requirements
    if (ConfigurationManager.environment === Environment.PRODUCTION) {
      if (config.auth.jwtSecret.includes('default')) {
        errors.push({ field: 'JWT_SECRET', value: '[hidden]', message: 'Production JWT secret cannot contain "default"' });
      }
      if (config.auth.jwtRefreshSecret.includes('default')) {
        errors.push({ field: 'JWT_REFRESH_SECRET', value: '[hidden]', message: 'Production JWT refresh secret cannot contain "default"' });
      }
      if (config.cors.requireHttps !== true) {
        errors.push({ field: 'CORS_REQUIRE_HTTPS', value: config.cors.requireHttps?.toString(), message: 'HTTPS is required in production' });
      }
    }

    // Validate performance configuration
    if (config.performance.limits.maxRequestSize <= 0) {
      errors.push({ field: 'MAX_REQUEST_SIZE', value: config.performance.limits.maxRequestSize, message: 'Max request size must be positive' });
    }
    if (config.performance.limits.requestTimeout <= 0) {
      errors.push({ field: 'REQUEST_TIMEOUT', value: config.performance.limits.requestTimeout, message: 'Request timeout must be positive' });
    }

    // Validate database configuration
    if (config.database.connectionPool.maxConnections <= 0) {
      errors.push({ field: 'DB_MAX_CONNECTIONS', value: config.database.connectionPool.maxConnections, message: 'Max connections must be positive' });
    }

    // Throw validation errors if any exist
    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessage}`);
    }
  }

  // === Public API Methods ===

  /**
   * Get current environment
   */
  public getEnvironment(): Environment {
    return ConfigurationManager.environment;
  }

  /**
   * Get environment name as string
   */
  public getEnvironmentString(): string {
    return ConfigurationManager.environment.toString();
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return ConfigurationManager.environment === Environment.DEVELOPMENT;
  }

  /**
   * Check if running in production mode  
   */
  public isProduction(): boolean {
    return ConfigurationManager.environment === Environment.PRODUCTION;
  }

  /**
   * Check if running in staging mode
   */
  public isStaging(): boolean {
    return ConfigurationManager.environment === Environment.STAGING;
  }

  /**
   * Check if running in test mode
   */
  public isTest(): boolean {
    return ConfigurationManager.environment === Environment.TEST;
  }

  /**
   * Get complete configuration
   */
  public getConfig(): AppConfiguration {
    return { ...ConfigurationManager.configuration };
  }

  /**
   * Get AWS configuration
   */
  public getAWSConfig(): AWSConfig {
    return { ...ConfigurationManager.configuration.aws };
  }

  /**
   * Get authentication configuration
   */
  public getAuthConfig(): AuthConfig {
    return { ...ConfigurationManager.configuration.auth };
  }

  /**
   * Get application configuration
   */
  public getAppConfig(): ApplicationConfig {
    return { ...ConfigurationManager.configuration.app };
  }

  /**
   * Get CORS configuration
   */
  public getCORSConfig(): CORSConfig {
    return { ...ConfigurationManager.configuration.cors };
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig {
    return { ...ConfigurationManager.configuration.database };
  }

  /**
   * Get logging configuration
   */
  public getLoggingConfig(): LoggingConfig {
    return { ...ConfigurationManager.configuration.logging };
  }

  /**
   * Get performance configuration
   */
  public getPerformanceConfig(): PerformanceConfig {
    return { ...ConfigurationManager.configuration.performance };
  }

  /**
   * Get feature flags configuration
   */
  public getFeatureFlagsConfig(): FeatureFlagsConfig {
    return { ...ConfigurationManager.configuration.featureFlags };
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return { ...ConfigurationManager.configuration.security };
  }

  /**
   * Get specific configuration value with fallback
   */
  public get<T>(path: string, fallback?: T): T | undefined {
    const keys = path.split('.');
    let value: any = ConfigurationManager.configuration;
    
    for (const key of keys) {
      value = value && value[key];
      if (value === undefined) break;
    }
    
    return value !== undefined ? value : fallback;
  }

  /**
   * Check if environment should include debug information
   */
  public shouldIncludeDebugInfo(): boolean {
    return [Environment.DEVELOPMENT, Environment.TEST].includes(ConfigurationManager.environment);
  }

  /**
   * Get environment-specific database connection settings (legacy method for compatibility)
   */
  public getDatabaseConnectionSettings(): { maxConnections: number; timeout: number } {
    const dbConfig = this.getDatabaseConfig();
    return {
      maxConnections: dbConfig.connectionPool.maxConnections,
      timeout: dbConfig.connectionPool.timeout,
    };
  }

  // === Convenience Methods ===

  /**
   * Get AWS Lambda function metadata
   */
  public getLambdaMetadata() {
    return {
      functionName: this.get('aws.lambda.functionName'),
      functionVersion: this.get('aws.lambda.functionVersion'),
      runtime: this.get('aws.lambda.runtime'),
      memorySize: this.get('aws.lambda.memorySize'),
      timeout: this.get('aws.lambda.timeout'),
      logGroup: this.get('aws.lambda.logGroup'),
      logStream: this.get('aws.lambda.logStream'),
    };
  }

  /**
   * Get application metadata
   */
  public getAppMetadata() {
    return {
      name: this.get('app.name'),
      version: this.get('app.version'),
      environment: this.getEnvironmentString(),
      debug: this.get('app.debug'),
    };
  }

  /**
   * Check if a feature flag is enabled
   */
  public isFeatureEnabled(feature: keyof FeatureFlagsConfig): boolean {
    return this.get(`featureFlags.${feature}`, false) || false;
  }

  /**
   * Get table name by key
   */
  public getTableName(table: keyof AWSConfig['tables']): string {
    return this.get(`aws.tables.${table}`, '') || '';
  }

  /**
   * Get bucket name by key
   */
  public getBucketName(bucket: keyof AWSConfig['buckets']): string {
    return this.get(`aws.buckets.${bucket}`, '') || '';
  }

  /**
   * Get current log level
   */
  public getLogLevel(): string {
    return this.get('logging.level', 'INFO') || 'INFO';
  }

  /**
   * Check if running in Lambda environment
   */
  public isLambdaEnvironment(): boolean {
    return !!(this.get('aws.lambda.functionName') || process.env.LAMBDA_RUNTIME_DIR);
  }
}