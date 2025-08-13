// Structured logging utility for Lambda functions

import { ConfigurationManager } from '@/shared/service-factory';
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  functionName?: string;
  [key: string]: unknown;
}

export type LogError =
  | Error
  | { name?: string; message: string; stack?: string; [key: string]: unknown }
  | string
  | unknown;

export interface LogEntry {
  level: keyof typeof LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: LogError;
  duration?: number;
}

class Logger {
  private logLevel: LogLevel;
  private context: LogContext;

  constructor(logLevel: LogLevel = LogLevel.INFO, context: LogContext = {}) {
    this.logLevel = logLevel;
    this.context = context;
  }

  public setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: LogError, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  public time(label: string): void {
    this.setContext({ [`timer_${label}_start`]: Date.now() });
  }

  public timeEnd(label: string, message?: string): void {
    const startTime = this.context[`timer_${label}_start`];
    if (typeof startTime === 'number') {
      const duration = Date.now() - startTime;
      this.info(message || `Timer ${label} completed`, { duration });
      delete this.context[`timer_${label}_start`];
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: LogError): void {
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      level: LogLevel[level] as keyof typeof LogLevel,
      message,
      context: { ...this.context, ...context },
      timestamp: new Date().toISOString(),
    };

    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (typeof error === 'string') {
        logEntry.error = { message: error };
      } else if (error && typeof error === 'object' && 'message' in error) {
        logEntry.error = error;
      } else {
        logEntry.error = { message: 'Unknown error', details: error };
      }
    }

    const output = JSON.stringify(logEntry, null, 0);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }
}

// Create default logger instance with centralized configuration
export const logger = (() => {
  const configManager = ConfigurationManager.getInstance();
  const appConfig = configManager.getAppConfig();
  const awsConfig = configManager.getAWSConfig();
  
  const logLevel = LogLevel[appConfig.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
  
  return new Logger(logLevel, {
    functionName: awsConfig.lambda.functionName || 'unknown',
    version: awsConfig.lambda.functionVersion || appConfig.version,
    region: awsConfig.region,
  });
})();

// Factory function for creating context-specific loggers with centralized configuration
export function createLogger(context: LogContext = {}): Logger {
  const configManager = ConfigurationManager.getInstance();
  const appConfig = configManager.getAppConfig();
  const awsConfig = configManager.getAWSConfig();
  
  const logLevel = LogLevel[appConfig.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
  
  return new Logger(logLevel, {
    functionName: awsConfig.lambda.functionName || 'unknown',
    version: awsConfig.lambda.functionVersion || appConfig.version,
    region: awsConfig.region,
    ...context,
  });
}
