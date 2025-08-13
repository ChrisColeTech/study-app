// Dedicated mapper for health check data transformations
// Standardized transformation patterns for health-related data objects

// Using generic types since specific health types may not be exported

/**
 * HealthMapper - Dedicated mapper for health check data transformations
 * 
 * Provides standardized transformation patterns for health-related data objects
 * with consistent status reporting and diagnostic information formatting.
 * 
 * @responsibilities
 * - Transform health check results to standardized formats
 * - Create comprehensive health status reports
 * - Format diagnostic information for monitoring systems
 * - Handle health metric aggregation and summary generation
 */
/**
 * HealthMapper - Dedicated mapper for health check data transformations
 * 
 * Provides standardized transformation patterns for health-related data objects
 * with consistent status reporting and diagnostic information formatting.
 * 
 * @responsibilities
 * - Transform health check results to standardized formats
 * - Create comprehensive health status reports
 * - Format diagnostic information for monitoring systems
 * - Handle health metric aggregation and summary generation
 */
export class HealthMapper {
  /**
   * Create comprehensive health status response
   * 
   * @param status - Overall system health status
   * @param details - Detailed health information
   * @param timestamp - Health check timestamp
   * @returns Formatted health status response
   */
  static toHealthStatusResponse(
    status: 'healthy' | 'degraded' | 'unhealthy',
    details: any,
    timestamp: string = new Date().toISOString()
  ): any {
    return {
      status,
      timestamp,
      details,
      version: details.version || '1.0.0',
    };
  }

  /**
   * Create health details object from system checks
   * 
   * @param checks - Individual system health checks
   * @returns Comprehensive health details
   */
  static toHealthDetails(checks: {
    database?: any;
    storage?: any;
    memory?: any;
    dependencies?: any;
    [key: string]: any;
  }): any {
    return {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: checks.database || { status: 'unknown' },
      storage: checks.storage || { status: 'unknown' },
      memory: checks.memory || this.getMemoryInfo(),
      dependencies: checks.dependencies || [],
      ...checks,
    };
  }

  /**
   * Aggregate multiple health checks into overall status
   * 
   * @param checks - Array of individual health check results
   * @returns Overall system health status
   */
  static aggregateHealthStatus(checks: Array<{status: string}>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = checks.map(check => check.status);
    
    if (statuses.some(status => status === 'unhealthy' || status === 'error')) {
      return 'unhealthy';
    }
    
    if (statuses.some(status => status === 'degraded' || status === 'warning')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Format database health check result
   * 
   * @param isConnected - Database connection status
   * @param responseTime - Database response time in ms
   * @param error - Optional error information
   * @returns Formatted database health info
   */
  static formatDatabaseHealth(
    isConnected: boolean,
    responseTime?: number,
    error?: Error
  ): {status: string, responseTime?: number, error?: string} {
    if (!isConnected) {
      return {
        status: 'unhealthy',
        error: error?.message || 'Database connection failed',
      };
    }

    const status = responseTime && responseTime > 5000 ? 'degraded' : 'healthy';
    
    return {
      status,
      ...(responseTime && { responseTime }),
    };
  }

  /**
   * Format storage health check result
   * 
   * @param isAccessible - Storage accessibility status
   * @param responseTime - Storage response time in ms
   * @param error - Optional error information
   * @returns Formatted storage health info
   */
  static formatStorageHealth(
    isAccessible: boolean,
    responseTime?: number,
    error?: Error
  ): {status: string, responseTime?: number, error?: string} {
    if (!isAccessible) {
      return {
        status: 'unhealthy',
        error: error?.message || 'Storage access failed',
      };
    }

    const status = responseTime && responseTime > 3000 ? 'degraded' : 'healthy';
    
    return {
      status,
      ...(responseTime && { responseTime }),
    };
  }

  /**
   * Get current memory usage information
   * 
   * @returns Memory usage statistics
   * @private
   */
  private static getMemoryInfo() {
    const memUsage = process.memoryUsage();
    
    return {
      status: memUsage.heapUsed > 512 * 1024 * 1024 ? 'degraded' : 'healthy', // 512MB threshold
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };
  }

  /**
   * Format uptime in human-readable format
   * 
   * @param uptimeSeconds - Uptime in seconds
   * @returns Formatted uptime string
   */
  static formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format memory usage in human-readable format
   * 
   * @param bytes - Memory usage in bytes
   * @returns Formatted memory string
   */
  static formatMemoryUsage(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    } else {
      return `${mb.toFixed(2)} MB`;
    }
  }

  /**
   * Create health summary for monitoring dashboards
   * 
   * @param healthStatus - Complete health status object
   * @returns Summarized health information
   */
  static createHealthSummary(healthStatus: any): {
    status: string;
    uptime: string;
    issues: string[];
    lastCheck: string;
  } {
    const issues: string[] = [];
    
    if (healthStatus.details.database?.status !== 'healthy') {
      issues.push(`Database: ${healthStatus.details.database?.status || 'unknown'}`);
    }
    
    if (healthStatus.details.storage?.status !== 'healthy') {
      issues.push(`Storage: ${healthStatus.details.storage?.status || 'unknown'}`);
    }
    
    if (healthStatus.details.memory?.status !== 'healthy') {
      issues.push(`Memory: ${healthStatus.details.memory?.status || 'unknown'}`);
    }

    return {
      status: healthStatus.status,
      uptime: this.formatUptime(healthStatus.details.uptime || 0),
      issues,
      lastCheck: healthStatus.timestamp,
    };
  }
}