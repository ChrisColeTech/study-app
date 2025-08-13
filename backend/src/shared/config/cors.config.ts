/**
 * CORS Configuration System
 * 
 * Provides comprehensive CORS configuration with:
 * - Environment-specific settings
 * - Security-first defaults
 * - Configurable allowlists
 * - Performance optimizations
 */

export interface CorsOriginConfig {
  readonly patterns: string[];
  readonly allowCredentials: boolean;
  readonly description: string;
}

export interface CorsMethodConfig {
  readonly allowed: string[];
  readonly preflightCacheDuration: number;
}

export interface CorsHeaderConfig {
  readonly allowed: string[];
  readonly exposed: string[];
  readonly maxAge: number;
}

export interface CorsSecurityConfig {
  readonly strictOriginCheck: boolean;
  readonly validateReferer: boolean;
  readonly requireHttps: boolean;
  readonly blockUnknownOrigins: boolean;
  readonly logViolations: boolean;
}

export interface CorsPerformanceConfig {
  readonly enableCaching: boolean;
  readonly cacheMaxAge: number;
  readonly enableCompression: boolean;
  readonly optimizePreflight: boolean;
}

export interface CorsEnvironmentConfig {
  readonly origins: CorsOriginConfig;
  readonly methods: CorsMethodConfig;
  readonly headers: CorsHeaderConfig;
  readonly security: CorsSecurityConfig;
  readonly performance: CorsPerformanceConfig;
}

export interface CorsValidationResult {
  readonly isValid: boolean;
  readonly origin?: string;
  readonly reason?: string;
  readonly allowCredentials: boolean;
}

/**
 * Comprehensive CORS configuration class with environment-specific settings
 */
export class CorsConfig {
  private static readonly DEVELOPMENT_CONFIG: CorsEnvironmentConfig = {
    origins: {
      patterns: [
        '*', // Allow all origins in development
      ],
      allowCredentials: true,
      description: 'Development - All origins allowed for testing',
    },
    methods: {
      allowed: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      preflightCacheDuration: 3600, // 1 hour
    },
    headers: {
      allowed: [
        'Content-Type',
        'Authorization',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'X-Amz-User-Agent',
        'X-Request-ID',
        'X-Forwarded-For',
        'Accept',
        'Accept-Language',
        'Cache-Control',
      ],
      exposed: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      maxAge: 86400, // 24 hours
    },
    security: {
      strictOriginCheck: false,
      validateReferer: false,
      requireHttps: false,
      blockUnknownOrigins: false,
      logViolations: true,
    },
    performance: {
      enableCaching: true,
      cacheMaxAge: 3600,
      enableCompression: true,
      optimizePreflight: true,
    },
  };

  private static readonly STAGING_CONFIG: CorsEnvironmentConfig = {
    origins: {
      patterns: [
        'https://staging.study-app-v3.com',
        'https://staging-api.study-app-v3.com',
        'https://localhost:3000', // For local frontend testing
        'https://127.0.0.1:3000',
      ],
      allowCredentials: true,
      description: 'Staging - Restricted to staging domains and localhost',
    },
    methods: {
      allowed: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      preflightCacheDuration: 7200, // 2 hours
    },
    headers: {
      allowed: [
        'Content-Type',
        'Authorization',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'X-Request-ID',
        'Accept',
        'Accept-Language',
      ],
      exposed: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
      ],
      maxAge: 86400,
    },
    security: {
      strictOriginCheck: true,
      validateReferer: true,
      requireHttps: true,
      blockUnknownOrigins: true,
      logViolations: true,
    },
    performance: {
      enableCaching: true,
      cacheMaxAge: 7200,
      enableCompression: true,
      optimizePreflight: true,
    },
  };

  private static readonly PRODUCTION_CONFIG: CorsEnvironmentConfig = {
    origins: {
      patterns: [
        'https://study-app-v3.com',
        'https://www.study-app-v3.com',
        'https://api.study-app-v3.com',
      ],
      allowCredentials: true,
      description: 'Production - Strict allowlist of production domains',
    },
    methods: {
      allowed: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      preflightCacheDuration: 86400, // 24 hours
    },
    headers: {
      allowed: [
        'Content-Type',
        'Authorization',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'X-Request-ID',
        'Accept',
      ],
      exposed: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
      ],
      maxAge: 86400,
    },
    security: {
      strictOriginCheck: true,
      validateReferer: true,
      requireHttps: true,
      blockUnknownOrigins: true,
      logViolations: true,
    },
    performance: {
      enableCaching: true,
      cacheMaxAge: 86400,
      enableCompression: true,
      optimizePreflight: true,
    },
  };

  private static config: CorsEnvironmentConfig;
  private static environment: string;

  /**
   * Initialize CORS configuration for the specified environment
   */
  public static initialize(environment: string): void {
    CorsConfig.environment = environment.toLowerCase();
    
    switch (CorsConfig.environment) {
      case 'production':
      case 'prod':
        CorsConfig.config = { ...CorsConfig.PRODUCTION_CONFIG };
        break;
      case 'staging':
      case 'stage':
        CorsConfig.config = { ...CorsConfig.STAGING_CONFIG };
        break;
      case 'development':
      case 'dev':
      default:
        CorsConfig.config = { ...CorsConfig.DEVELOPMENT_CONFIG };
        break;
    }

    // Override with environment variables if provided
    CorsConfig.applyEnvironmentOverrides();
  }

  /**
   * Apply environment variable overrides to configuration
   */
  private static applyEnvironmentOverrides(): void {
    // Override origins from environment variable
    if (process.env.CORS_ALLOWED_ORIGINS) {
      const origins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim());
      CorsConfig.config.origins.patterns = origins;
    }

    // Override credentials setting
    if (process.env.CORS_ALLOW_CREDENTIALS !== undefined) {
      CorsConfig.config.origins.allowCredentials = process.env.CORS_ALLOW_CREDENTIALS === 'true';
    }

    // Override methods
    if (process.env.CORS_ALLOWED_METHODS) {
      const methods = process.env.CORS_ALLOWED_METHODS.split(',').map(m => m.trim().toUpperCase());
      CorsConfig.config.methods.allowed = methods;
    }

    // Override headers
    if (process.env.CORS_ALLOWED_HEADERS) {
      const headers = process.env.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim());
      CorsConfig.config.headers.allowed = headers;
    }

    // Override security settings
    if (process.env.CORS_STRICT_ORIGIN_CHECK !== undefined) {
      CorsConfig.config.security.strictOriginCheck = process.env.CORS_STRICT_ORIGIN_CHECK === 'true';
    }

    if (process.env.CORS_REQUIRE_HTTPS !== undefined) {
      CorsConfig.config.security.requireHttps = process.env.CORS_REQUIRE_HTTPS === 'true';
    }
  }

  /**
   * Get the current CORS configuration
   */
  public static getConfig(): CorsEnvironmentConfig {
    if (!CorsConfig.config) {
      CorsConfig.initialize(process.env.NODE_ENV || 'development');
    }
    return CorsConfig.config;
  }

  /**
   * Get environment-specific CORS headers
   */
  public static getCorsHeaders(origin?: string): Record<string, string> {
    const config = CorsConfig.getConfig();
    const validationResult = CorsConfig.validateOrigin(origin);

    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': config.methods.allowed.join(','),
      'Access-Control-Allow-Headers': config.headers.allowed.join(','),
      'Access-Control-Expose-Headers': config.headers.exposed.join(','),
      'Access-Control-Max-Age': config.methods.preflightCacheDuration.toString(),
    };

    // Set origin based on validation result
    if (validationResult.isValid && validationResult.origin) {
      headers['Access-Control-Allow-Origin'] = validationResult.origin;
    } else if (config.origins.patterns.includes('*')) {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    // Set credentials header if allowed and origin is valid
    if (validationResult.allowCredentials && validationResult.origin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }

  /**
   * Validate an origin against the configured allowlist
   */
  public static validateOrigin(origin?: string): CorsValidationResult {
    const config = CorsConfig.getConfig();

    if (!origin) {
      return {
        isValid: !config.security.blockUnknownOrigins,
        allowCredentials: false,
        reason: 'No origin provided',
      };
    }

    // Check for wildcard
    if (config.origins.patterns.includes('*')) {
      return {
        isValid: true,
        origin: '*',
        allowCredentials: false,
        reason: 'Wildcard origin allowed',
      };
    }

    // Check exact matches
    for (const pattern of config.origins.patterns) {
      if (origin === pattern) {
        return {
          isValid: true,
          origin,
          allowCredentials: config.origins.allowCredentials,
          reason: 'Exact origin match',
        };
      }
    }

    // Check pattern matches (basic wildcard support)
    for (const pattern of config.origins.patterns) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(origin)) {
          return {
            isValid: true,
            origin,
            allowCredentials: config.origins.allowCredentials,
            reason: 'Pattern origin match',
          };
        }
      }
    }

    // HTTPS requirement check
    if (config.security.requireHttps && !origin.startsWith('https://')) {
      return {
        isValid: false,
        allowCredentials: false,
        reason: 'HTTPS required but origin uses HTTP',
      };
    }

    return {
      isValid: false,
      allowCredentials: false,
      reason: 'Origin not in allowlist',
    };
  }

  /**
   * Get preflight response headers
   */
  public static getPreflightHeaders(origin?: string): Record<string, string> {
    const config = CorsConfig.getConfig();
    const corsHeaders = CorsConfig.getCorsHeaders(origin);

    return {
      ...corsHeaders,
      'Access-Control-Max-Age': config.performance.enableCaching 
        ? config.performance.cacheMaxAge.toString()
        : '0',
      'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    };
  }

  /**
   * Check if a method is allowed
   */
  public static isMethodAllowed(method: string): boolean {
    const config = CorsConfig.getConfig();
    return config.methods.allowed.includes(method.toUpperCase());
  }

  /**
   * Check if headers are allowed
   */
  public static areHeadersAllowed(headers: string[]): boolean {
    const config = CorsConfig.getConfig();
    const allowedHeaders = config.headers.allowed.map(h => h.toLowerCase());
    
    return headers.every(header => 
      allowedHeaders.includes(header.toLowerCase())
    );
  }

  /**
   * Get security configuration
   */
  public static getSecurityConfig(): CorsSecurityConfig {
    return CorsConfig.getConfig().security;
  }

  /**
   * Get performance configuration
   */
  public static getPerformanceConfig(): CorsPerformanceConfig {
    return CorsConfig.getConfig().performance;
  }

  /**
   * Get current environment name
   */
  public static getEnvironment(): string {
    return CorsConfig.environment || 'development';
  }

  /**
   * Log CORS validation result if logging is enabled
   */
  public static logValidation(
    origin: string | undefined,
    result: CorsValidationResult,
    logger?: { warn: (message: string, meta?: any) => void }
  ): void {
    const config = CorsConfig.getConfig();
    
    if (config.security.logViolations && !result.isValid && logger) {
      logger.warn('CORS validation failed', {
        origin,
        reason: result.reason,
        environment: CorsConfig.environment,
        strictMode: config.security.strictOriginCheck,
      });
    }
  }
}