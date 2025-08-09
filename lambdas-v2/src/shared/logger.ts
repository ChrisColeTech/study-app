/**
 * Structured Logger - V2
 * Provides consistent logging across all Lambda functions
 */
export class Logger {
  private readonly context: string;
  private readonly logLevel: string;

  constructor(context: string) {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  /**
   * Info level logging
   */
  public info(message: string, data?: any): void {
    if (this.shouldLog('INFO')) {
      this.log('INFO', message, data);
    }
  }

  /**
   * Debug level logging
   */
  public debug(message: string, data?: any): void {
    if (this.shouldLog('DEBUG')) {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * Warning level logging
   */
  public warn(message: string, data?: any): void {
    if (this.shouldLog('WARN')) {
      this.log('WARN', message, data);
    }
  }

  /**
   * Error level logging
   */
  public error(message: string, error?: any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    this.log('ERROR', message, errorData);
  }

  /**
   * Performance logging
   */
  public perf(operation: string, duration: number, data?: any): void {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      operation,
      ...data
    });
  }

  /**
   * Core logging method
   */
  private log(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      stage: process.env.STAGE || 'unknown',
      version: '2.0.0',
      ...(data && { data })
    };

    // Use console methods for CloudWatch integration
    switch (level) {
      case 'ERROR':
        console.error(JSON.stringify(logEntry));
        break;
      case 'WARN':
        console.warn(JSON.stringify(logEntry));
        break;
      default:
        console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Check if message should be logged based on log level
   */
  private shouldLog(level: string): boolean {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }
}