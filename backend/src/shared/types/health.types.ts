// Health check type definitions for detailed system diagnostics

import { IBaseRepository } from './repository.types';

export interface SystemResourceUsage {
  cpu: {
    usage: number;
    loadAverage?: number[];
  };
  memory: {
    used: number;
    total: number;
    external: number;
    percentage: number;
    rss: number;
    arrayBuffers: number;
  };
  heap: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  };
}

export interface LambdaEnvironmentInfo {
  functionName?: string;
  functionVersion?: string;
  runtime?: string;
  memorySize?: string;
  timeout?: string;
  logGroup?: string;
  logStream?: string;
  remainingTime?: number;
  region?: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput?: number;
  errorRate?: number;
  availability?: number;
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
}

export interface ServiceDiagnostics {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: string;
  error?: string;
  details?: {
    region?: string;
    endpoint?: string;
    version?: string;
    configuration?: Record<string, any>;
  };
  metrics?: PerformanceMetrics;
}

export interface DatabaseDiagnostics extends ServiceDiagnostics {
  service: 'dynamodb';
  details?: {
    region?: string;
    endpoint?: string;
    tables?: {
      name: string;
      status: string;
      itemCount?: number;
      sizeBytes?: number;
      readCapacity?: number;
      writeCapacity?: number;
    }[];
  };
}

export interface StorageDiagnostics extends ServiceDiagnostics {
  service: 's3';
  details?: {
    region?: string;
    endpoint?: string;
    buckets?: {
      name: string;
      status: string;
      objectCount?: number;
      sizeBytes?: number;
      region?: string;
    }[];
  };
}

export interface LambdaDiagnostics extends ServiceDiagnostics {
  service: 'lambda';
  details?: {
    region?: string;
    functionName?: string;
    runtime?: string;
    memorySize?: number;
    timeout?: number;
    codeSize?: number;
    lastModified?: string;
    state?: string;
    environment?: Record<string, string>;
  };
}

export interface CloudWatchDiagnostics extends ServiceDiagnostics {
  service: 'cloudwatch';
  details?: {
    region?: string;
    endpoint?: string;
    logGroups?: {
      name: string;
      retentionInDays?: number;
      sizeBytes?: number;
    }[];
  };
}

export interface DetailedHealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  requestId?: string;
  totalResponseTime: number;
  overallAvailability: number;

  // System information
  system: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    uptime: number;
    pid: number;
  };

  // Resource usage
  resources: SystemResourceUsage;

  // Lambda environment
  lambda: LambdaEnvironmentInfo;

  // Service diagnostics
  services: {
    database: DatabaseDiagnostics;
    storage: StorageDiagnostics;
    lambda?: LambdaDiagnostics;
    cloudwatch?: CloudWatchDiagnostics;
  };

  // Performance metrics
  performance: {
    overall: PerformanceMetrics;
    byService: Record<string, PerformanceMetrics>;
  };

  // Connectivity tests
  connectivity: {
    internet: boolean;
    aws: boolean;
    dns: boolean;
  };

  // Configuration validation
  configuration: {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    tables: Record<string, boolean>;
    buckets: Record<string, boolean>;
    environment: Record<string, any>;
  };

  // Alerts and recommendations
  alerts?: {
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    service?: string;
    timestamp: string;
  }[];

  recommendations?: {
    priority: 'low' | 'medium' | 'high';
    category: 'performance' | 'security' | 'cost' | 'reliability';
    message: string;
    action?: string;
  }[];
}

export interface HealthCheckOptions {
  includeSystemMetrics?: boolean;
  includePerformanceAnalysis?: boolean;
  includeConnectivityTests?: boolean;
  includeConfigurationValidation?: boolean;
  includeDetailedDiagnostics?: boolean;
  timeout?: number;
  services?: string[];
}

export interface ServiceDependency {
  name: string;
  type: 'database' | 'storage' | 'api' | 'cache' | 'messaging';
  critical: boolean;
  endpoint?: string;
  timeout?: number;
  retries?: number;
}

// Health monitoring alerts
export interface HealthAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
}

// Health trends for analysis
export interface HealthTrend {
  service: string;
  metric: string;
  values: { timestamp: string; value: number }[];
  trend: 'improving' | 'stable' | 'degrading';
  analysis?: string;
}

// Export additional interfaces for repository and service
export interface IDetailedHealthRepository extends IHealthRepository {
  checkLambdaHealth(): Promise<LambdaDiagnostics>;
  checkCloudWatchHealth(): Promise<CloudWatchDiagnostics>;
  getSystemMetrics(): Promise<SystemResourceUsage>;
  testConnectivity(): Promise<{ internet: boolean; aws: boolean; dns: boolean }>;
  validateConfiguration(): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }>;
  getPerformanceMetrics(service?: string): Promise<PerformanceMetrics>;
  getHealthTrends(service?: string, hours?: number): Promise<HealthTrend[]>;
}

export interface IDetailedHealthService extends IHealthService {
  getDetailedHealthCheck(options?: HealthCheckOptions): Promise<DetailedHealthCheckResult>;
  getSystemDiagnostics(): Promise<SystemResourceUsage>;
  getServiceDiagnostics(service?: string): Promise<ServiceDiagnostics[]>;
  testServiceConnectivity(): Promise<{ internet: boolean; aws: boolean; dns: boolean }>;
  validateSystemConfiguration(): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }>;
  getPerformanceAnalysis(): Promise<PerformanceMetrics>;
  getHealthAlerts(): Promise<HealthAlert[]>;
  getHealthTrends(hours?: number): Promise<HealthTrend[]>;
}

// Re-export base interfaces
export interface IHealthRepository extends IBaseRepository {
  /**
   * Check DynamoDB health status
   * @returns Promise<ServiceDiagnostics> - DynamoDB health diagnostics
   * @throws RepositoryError
   */
  checkDynamoDbHealth(): Promise<ServiceDiagnostics>;

  /**
   * Check S3 health status
   * @returns Promise<ServiceDiagnostics> - S3 health diagnostics
   * @throws RepositoryError
   */
  checkS3Health(): Promise<ServiceDiagnostics>;

  /**
   * Check all AWS services health status
   * @returns Promise<ServiceDiagnostics[]> - All services health diagnostics
   * @throws RepositoryError
   */
  checkAllServices(): Promise<ServiceDiagnostics[]>;
}

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
  checkDatabaseHealth(): Promise<ServiceDiagnostics>;
  checkStorageHealth(): Promise<ServiceDiagnostics>;
}
