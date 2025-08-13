import { logger } from '../logger';

type Logger = typeof logger;

export interface PipelineStage {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface RequestLifecycleMetrics {
  requestId: string;
  totalTime: number;
  stages: PipelineStage[];
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    final?: NodeJS.MemoryUsage;
    peak: number;
  };
  errors: number;
  completed: boolean;
}

/**
 * Request Lifecycle Tracker
 * Tracks performance metrics and timing throughout the request processing pipeline
 */
export class RequestLifecycleTracker {
  private requestId: string;
  private logger: Logger;
  private startTime: number;
  private stages: Map<string, PipelineStage> = new Map();
  private memoryUsage: RequestLifecycleMetrics['memoryUsage'];
  private errors: number = 0;
  private completed: boolean = false;

  constructor(requestId: string, logger: Logger) {
    this.requestId = requestId;
    this.logger = logger;
    this.startTime = Date.now();
    this.memoryUsage = {
      initial: process.memoryUsage(),
      peak: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Start tracking a new pipeline stage
   */
  start(stageName: string, metadata?: Record<string, any>): void {
    const stage: PipelineStage = {
      name: stageName,
      startTime: Date.now(),
      ...(metadata && { metadata }),
    };

    this.stages.set(stageName, stage);
    
    // Track peak memory usage
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.memoryUsage.peak) {
      this.memoryUsage.peak = currentMemory;
    }

    this.logger.debug(`Pipeline stage started: ${stageName}`, {
      requestId: this.requestId,
      stage: stageName,
      metadata,
    });
  }

  /**
   * Complete a pipeline stage
   */
  complete(stageName: string, metadata?: Record<string, any>): void {
    const stage = this.stages.get(stageName);
    if (!stage) {
      this.logger.warn(`Attempted to complete unknown stage: ${stageName}`, {
        requestId: this.requestId,
      });
      return;
    }

    const endTime = Date.now();
    stage.endTime = endTime;
    stage.duration = endTime - stage.startTime;
    
    if (metadata) {
      stage.metadata = { ...stage.metadata, ...metadata };
    }

    // Track peak memory usage
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.memoryUsage.peak) {
      this.memoryUsage.peak = currentMemory;
    }

    this.logger.debug(`Pipeline stage completed: ${stageName}`, {
      requestId: this.requestId,
      stage: stageName,
      duration: stage.duration,
      metadata: stage.metadata,
    });
  }

  /**
   * Record an error in a pipeline stage
   */
  error(stageName: string, error: Error, metadata?: Record<string, any>): void {
    const stage = this.stages.get(stageName);
    if (stage) {
      stage.error = error;
      stage.endTime = Date.now();
      stage.duration = stage.endTime - stage.startTime;
      
      if (metadata) {
        stage.metadata = { ...stage.metadata, ...metadata };
      }
    } else {
      // Create a new stage for the error
      this.start(stageName, metadata);
      const newStage = this.stages.get(stageName)!;
      newStage.error = error;
      newStage.endTime = Date.now();
      newStage.duration = newStage.endTime - newStage.startTime;
    }

    this.errors++;

    this.logger.error(`Pipeline stage error: ${stageName}`, error, {
      requestId: this.requestId,
      stage: stageName,
      metadata,
    });
  }

  /**
   * Finish the request lifecycle tracking
   */
  finish(): void {
    this.completed = true;
    this.memoryUsage.final = process.memoryUsage();

    const totalTime = Date.now() - this.startTime;
    const completedStages = Array.from(this.stages.values()).filter(s => s.endTime);
    const failedStages = Array.from(this.stages.values()).filter(s => s.error);

    this.logger.info('Request lifecycle completed', {
      requestId: this.requestId,
      totalTime,
      stagesCompleted: completedStages.length,
      stagesFailed: failedStages.length,
      errors: this.errors,
      memoryPeak: Math.round(this.memoryUsage.peak / 1024 / 1024), // MB
      memoryFinal: Math.round((this.memoryUsage.final?.heapUsed || 0) / 1024 / 1024), // MB
    });
  }

  /**
   * Get comprehensive metrics for the request lifecycle
   */
  getMetrics(): RequestLifecycleMetrics {
    const totalTime = Date.now() - this.startTime;
    const stages = Array.from(this.stages.values());

    return {
      requestId: this.requestId,
      totalTime,
      stages,
      memoryUsage: this.memoryUsage,
      errors: this.errors,
      completed: this.completed,
    };
  }

  /**
   * Get performance summary for logging
   */
  getPerformanceSummary(): Record<string, any> {
    const metrics = this.getMetrics();
    const completedStages = metrics.stages.filter(s => s.endTime);
    const averageStageTime = completedStages.length > 0 
      ? completedStages.reduce((sum, s) => sum + (s.duration || 0), 0) / completedStages.length 
      : 0;

    return {
      totalTime: metrics.totalTime,
      stagesCount: metrics.stages.length,
      averageStageTime: Math.round(averageStageTime),
      errors: metrics.errors,
      memoryUsageMB: Math.round(metrics.memoryUsage.peak / 1024 / 1024),
      completed: metrics.completed,
    };
  }

  /**
   * Check if request is performing within acceptable limits
   */
  isPerformanceAcceptable(): { acceptable: boolean; issues: string[] } {
    const metrics = this.getMetrics();
    const issues: string[] = [];

    // Check total request time (should be under 5 seconds for most APIs)
    if (metrics.totalTime > 5000) {
      issues.push(`Request time ${metrics.totalTime}ms exceeds 5s limit`);
    }

    // Check memory usage (should not exceed 256MB for Lambda)
    const memoryMB = metrics.memoryUsage.peak / 1024 / 1024;
    if (memoryMB > 256) {
      issues.push(`Memory usage ${Math.round(memoryMB)}MB exceeds 256MB limit`);
    }

    // Check for any failed stages
    if (metrics.errors > 0) {
      issues.push(`${metrics.errors} pipeline errors occurred`);
    }

    // Check for slow stages (any stage over 1 second)
    const slowStages = metrics.stages.filter(s => (s.duration || 0) > 1000);
    if (slowStages.length > 0) {
      issues.push(`${slowStages.length} stages exceeded 1s: ${slowStages.map(s => s.name).join(', ')}`);
    }

    return {
      acceptable: issues.length === 0,
      issues,
    };
  }
}