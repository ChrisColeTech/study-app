// Dedicated mapper for analytics data transformations
// Standardized transformation patterns for analytics-related data objects

import {
  ChartDataPoint,
  VisualizationData,
  LearningInsights,
  CompetencyAnalytics,
  UserProgressUpdate
} from '../shared/types/analytics.types';

/**
 * AnalyticsMapper - Dedicated mapper for analytics data transformations
 * 
 * Provides standardized transformation patterns for analytics-related data objects
 * with consistent formatting for dashboard and visualization consumption.
 * 
 * @responsibilities
 * - Format analytics data for dashboard consumption
 * - Transform raw metrics into visualization-ready formats
 * - Create standardized analytics response objects
 * - Handle chart data point formatting
 */
/**
 * AnalyticsMapper - Dedicated mapper for analytics data transformations
 * 
 * Provides standardized transformation patterns for analytics-related data objects
 * with consistent formatting for dashboard and visualization consumption.
 * 
 * @responsibilities
 * - Format analytics data for dashboard consumption
 * - Transform raw metrics into visualization-ready formats
 * - Create standardized analytics response objects
 * - Handle chart data point formatting
 */
/**
 * AnalyticsMapper - Dedicated mapper for analytics data transformations
 * 
 * Provides standardized transformation patterns for analytics-related data objects
 * with consistent formatting for dashboard and visualization consumption.
 * 
 * @responsibilities
 * - Format analytics data for dashboard consumption
 * - Transform raw metrics into visualization-ready formats
 * - Create standardized analytics response objects
 * - Handle chart data point formatting
 */
export class AnalyticsMapper {
  /**
   * Format chart data points for visualization
   * 
   * @param data - Raw data points
   * @param labelKey - Key to use for x-axis
   * @param valueKey - Key to use for y-axis
   * @returns Array of formatted chart data points
   */
  static toChartDataPoints(
    data: any[],
    labelKey: string,
    valueKey: string
  ): ChartDataPoint[] {
    return data.map(item => ({
      x: item[labelKey] || 0,
      y: item[valueKey] || 0,
    }));
  }

  /**
   * Calculate percentage change between two values
   * 
   * @param current - Current value
   * @param previous - Previous value
   * @returns Percentage change (positive or negative)
   */
  static calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  /**
   * Format duration in seconds to human-readable format
   * 
   * @param seconds - Duration in seconds
   * @returns Formatted duration string
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  /**
   * Calculate accuracy percentage with proper rounding
   * 
   * @param correct - Number of correct answers
   * @param total - Total number of questions
   * @returns Accuracy percentage rounded to 2 decimal places
   */
  static calculateAccuracy(correct: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((correct / total) * 10000) / 100;
  }

  /**
   * Format analytics summary data
   * 
   * @param data - Raw analytics data
   * @returns Formatted summary object
   */
  static formatAnalyticsSummary(data: any): any {
    return {
      totalQuestions: data.totalQuestions || 0,
      correctAnswers: data.correctAnswers || 0,
      accuracy: this.calculateAccuracy(data.correctAnswers || 0, data.totalQuestions || 0),
      studyTime: data.studyTime || 0,
      sessionsCompleted: data.sessionsCompleted || 0,
      averageSessionTime: data.averageSessionTime || 0,
      streak: data.streak || 0,
      lastStudyDate: data.lastStudyDate,
      formattedStudyTime: this.formatDuration(data.studyTime || 0),
      ...data
    };
  }
}