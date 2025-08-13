/**
 * Configuration Module - Centralized Configuration Management
 * 
 * Provides type-safe, centralized configuration management with:
 * - Environment-specific configurations
 * - Comprehensive validation
 * - Feature flags
 * - Performance and security settings
 * - Utility functions for common configuration access patterns
 */

// Core configuration management
export {
  ConfigurationManager,
  Environment,
  type AppConfiguration,
  type AWSConfig,
  type AuthConfig,
  type ApplicationConfig,
  type CORSConfig,
  type DatabaseConfig,
  type LoggingConfig,
  type PerformanceConfig,
  type FeatureFlagsConfig,
  type SecurityConfig,
  type ConfigValidationError,
} from './configuration-manager';

// Environment detection and metadata access utilities
export {
  EnvironmentDetector,
  LambdaMetadataAccessor,
  ApplicationMetadataAccessor,
  ConfigurationValidator,
  FeatureFlagAccessor,
  // Convenience exports for backward compatibility
  getEnvironment,
  getEnvironmentString,
  isDevelopment,
  isProduction,
  isStaging,
  isTest,
  isDebugMode,
  isLambdaEnvironment,
  getFunctionName,
  getFunctionVersion,
  getRuntime,
  getMemorySize,
  getTimeout,
  getLogGroup,
  getLogStream,
  getAppName,
  getAppVersion,
} from './environment-utils';

// Re-export existing CORS configuration for compatibility
export { CorsConfig } from './cors.config';