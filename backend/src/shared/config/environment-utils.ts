/**
 * Environment Configuration Utilities
 * 
 * Provides utilities for consistent environment variable access and validation
 * All environment variable access should go through these utilities or ConfigurationManager
 */

import { ConfigurationManager, Environment } from './configuration-manager';

/**
 * Environment Detector - provides consistent environment detection
 */
export class EnvironmentDetector {
  private static configManager?: ConfigurationManager;

  /**
   * Get the current environment
   */
  public static getEnvironment(): Environment {
    if (!EnvironmentDetector.configManager) {
      EnvironmentDetector.configManager = ConfigurationManager.getInstance();
    }
    return EnvironmentDetector.configManager.getEnvironment();
  }

  /**
   * Get the environment as a string
   */
  public static getEnvironmentString(): string {
    return EnvironmentDetector.getEnvironment().toString();
  }

  /**
   * Check if running in development
   */
  public static isDevelopment(): boolean {
    return EnvironmentDetector.getEnvironment() === Environment.DEVELOPMENT;
  }

  /**
   * Check if running in production
   */
  public static isProduction(): boolean {
    return EnvironmentDetector.getEnvironment() === Environment.PRODUCTION;
  }

  /**
   * Check if running in staging
   */
  public static isStaging(): boolean {
    return EnvironmentDetector.getEnvironment() === Environment.STAGING;
  }

  /**
   * Check if running in test mode
   */
  public static isTest(): boolean {
    return EnvironmentDetector.getEnvironment() === Environment.TEST;
  }

  /**
   * Check if debug mode is enabled
   */
  public static isDebugMode(): boolean {
    if (!EnvironmentDetector.configManager) {
      EnvironmentDetector.configManager = ConfigurationManager.getInstance();
    }
    return EnvironmentDetector.configManager.shouldIncludeDebugInfo();
  }

  /**
   * Check if running in Lambda environment
   */
  public static isLambdaEnvironment(): boolean {
    if (!EnvironmentDetector.configManager) {
      EnvironmentDetector.configManager = ConfigurationManager.getInstance();
    }
    return EnvironmentDetector.configManager.isLambdaEnvironment();
  }
}

/**
 * AWS Lambda Metadata Accessor - centralized Lambda environment access
 */
export class LambdaMetadataAccessor {
  private static configManager?: ConfigurationManager;

  private static getConfigManager(): ConfigurationManager {
    if (!LambdaMetadataAccessor.configManager) {
      LambdaMetadataAccessor.configManager = ConfigurationManager.getInstance();
    }
    return LambdaMetadataAccessor.configManager;
  }

  /**
   * Get Lambda function name
   */
  public static getFunctionName(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().functionName as string | undefined;
  }

  /**
   * Get Lambda function version
   */
  public static getFunctionVersion(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().functionVersion as string | undefined;
  }

  /**
   * Get Lambda runtime environment
   */
  public static getRuntime(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().runtime as string | undefined;
  }

  /**
   * Get Lambda memory size
   */
  public static getMemorySize(): number | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().memorySize as number | undefined;
  }

  /**
   * Get Lambda timeout
   */
  public static getTimeout(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().timeout as string | undefined;
  }

  /**
   * Get Lambda log group
   */
  public static getLogGroup(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().logGroup as string | undefined;
  }

  /**
   * Get Lambda log stream
   */
  public static getLogStream(): string | undefined {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata().logStream as string | undefined;
  }

  /**
   * Get complete Lambda metadata
   */
  public static getMetadata() {
    return LambdaMetadataAccessor.getConfigManager().getLambdaMetadata();
  }
}

/**
 * Application Metadata Accessor - centralized app metadata access
 */
export class ApplicationMetadataAccessor {
  private static configManager?: ConfigurationManager;

  private static getConfigManager(): ConfigurationManager {
    if (!ApplicationMetadataAccessor.configManager) {
      ApplicationMetadataAccessor.configManager = ConfigurationManager.getInstance();
    }
    return ApplicationMetadataAccessor.configManager;
  }

  /**
   * Get application name
   */
  public static getAppName(): string {
    return ApplicationMetadataAccessor.getConfigManager().getAppMetadata().name as string;
  }

  /**
   * Get application version
   */
  public static getAppVersion(): string {
    return ApplicationMetadataAccessor.getConfigManager().getAppMetadata().version as string;
  }

  /**
   * Get application environment
   */
  public static getEnvironment(): string {
    return ApplicationMetadataAccessor.getConfigManager().getAppMetadata().environment as string;
  }

  /**
   * Check if debug mode is enabled
   */
  public static isDebugMode(): boolean {
    return ApplicationMetadataAccessor.getConfigManager().getAppMetadata().debug as boolean;
  }

  /**
   * Get complete application metadata
   */
  public static getMetadata() {
    return ApplicationMetadataAccessor.getConfigManager().getAppMetadata();
  }
}

/**
 * Configuration Validator - validates configuration values
 */
export class ConfigurationValidator {
  /**
   * Validate that a required environment variable is present
   */
  public static validateRequired(name: string, value: string | undefined): string {
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable ${name} is missing or empty`);
    }
    return value.trim();
  }

  /**
   * Validate a numeric environment variable
   */
  public static validateNumeric(name: string, value: string | undefined, defaultValue?: number): number {
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required numeric environment variable ${name} is missing`);
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${name} must be a valid number, got: ${value}`);
    }

    return parsed;
  }

  /**
   * Validate a boolean environment variable
   */
  public static validateBoolean(name: string, value: string | undefined, defaultValue?: boolean): boolean {
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required boolean environment variable ${name} is missing`);
    }

    const lowered = value.toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lowered)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(lowered)) {
      return false;
    }

    throw new Error(`Environment variable ${name} must be a valid boolean (true/false), got: ${value}`);
  }

  /**
   * Validate an array environment variable (comma-separated)
   */
  public static validateArray(name: string, value: string | undefined, defaultValue?: string[]): string[] {
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required array environment variable ${name} is missing`);
    }

    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }

  /**
   * Validate an enum environment variable
   */
  public static validateEnum<T extends string>(
    name: string, 
    value: string | undefined, 
    allowedValues: readonly T[], 
    defaultValue?: T
  ): T {
    if (!value) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required enum environment variable ${name} is missing`);
    }

    if (allowedValues.includes(value as T)) {
      return value as T;
    }

    throw new Error(
      `Environment variable ${name} must be one of: ${allowedValues.join(', ')}, got: ${value}`
    );
  }
}

/**
 * Feature Flag Accessor - centralized feature flag access
 */
export class FeatureFlagAccessor {
  private static configManager?: ConfigurationManager;

  private static getConfigManager(): ConfigurationManager {
    if (!FeatureFlagAccessor.configManager) {
      FeatureFlagAccessor.configManager = ConfigurationManager.getInstance();
    }
    return FeatureFlagAccessor.configManager;
  }

  /**
   * Check if advanced analytics feature is enabled
   */
  public static isAdvancedAnalyticsEnabled(): boolean {
    return FeatureFlagAccessor.getConfigManager().isFeatureEnabled('enableAdvancedAnalytics');
  }

  /**
   * Check if real-time updates feature is enabled
   */
  public static isRealTimeUpdatesEnabled(): boolean {
    return FeatureFlagAccessor.getConfigManager().isFeatureEnabled('enableRealTimeUpdates');
  }

  /**
   * Check if experimental features are enabled
   */
  public static areExperimentalFeaturesEnabled(): boolean {
    return FeatureFlagAccessor.getConfigManager().isFeatureEnabled('enableExperimentalFeatures');
  }

  /**
   * Check if performance logging is enabled
   */
  public static isPerformanceLoggingEnabled(): boolean {
    return FeatureFlagAccessor.getConfigManager().isFeatureEnabled('enablePerformanceLogging');
  }

  /**
   * Check if detailed error reporting is enabled
   */
  public static isDetailedErrorReportingEnabled(): boolean {
    return FeatureFlagAccessor.getConfigManager().isFeatureEnabled('enableDetailedErrorReporting');
  }
}

// Export commonly used environment detection functions for backward compatibility
export const {
  getEnvironment,
  getEnvironmentString, 
  isDevelopment,
  isProduction,
  isStaging,
  isTest,
  isDebugMode,
  isLambdaEnvironment
} = EnvironmentDetector;

// Export Lambda metadata functions for backward compatibility  
export const {
  getFunctionName,
  getFunctionVersion,
  getRuntime,
  getMemorySize,
  getTimeout,
  getLogGroup,
  getLogStream
} = LambdaMetadataAccessor;

// Export app metadata functions for backward compatibility
export const {
  getAppName,
  getAppVersion
} = ApplicationMetadataAccessor;