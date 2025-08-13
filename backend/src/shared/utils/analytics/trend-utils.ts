/**
 * Trend analysis utility functions
 * 
 * Single Responsibility: Trend detection, forecasting, and pattern analysis
 */

export interface TrendPoint {
  timestamp: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable';
  strength: number; // 0-1 scale
  confidence: number; // 0-1 scale
  slope: number;
  correlation: number;
}

/**
 * Analyze trend from time series data
 */
export function analyzeTrend(data: TrendPoint[]): TrendAnalysis {
  if (data.length < 2) {
    return {
      direction: 'stable',
      strength: 0,
      confidence: 0,
      slope: 0,
      correlation: 0,
    };
  }
  
  const sortedData = [...data].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const x = sortedData.map((_, index) => index);
  const y = sortedData.map(point => point.value);
  
  const slope = calculateSlope(x, y);
  const correlation = calculateCorrelationCoefficient(x, y);
  
  const direction = slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';
  const strength = Math.abs(slope) / (Math.max(...y) - Math.min(...y) || 1);
  const confidence = Math.abs(correlation);
  
  return {
    direction,
    strength: Math.min(1, strength),
    confidence,
    slope,
    correlation,
  };
}

/**
 * Calculate slope of trend line (linear regression)
 */
function calculateSlope(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;
  
  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Calculate correlation coefficient
 */
function calculateCorrelationCoefficient(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Detect trend changes/breakpoints
 */
export function detectTrendChanges(
  data: TrendPoint[],
  windowSize = 5,
  threshold = 0.3
): Array<{ timestamp: string; changeType: 'reversal' | 'acceleration' | 'deceleration' }> {
  if (data.length < windowSize * 2) return [];
  
  const sortedData = [...data].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const changes: Array<{ timestamp: string; changeType: 'reversal' | 'acceleration' | 'deceleration' }> = [];
  
  for (let i = windowSize; i < sortedData.length - windowSize; i++) {
    const beforeWindow = sortedData.slice(i - windowSize, i);
    const afterWindow = sortedData.slice(i, i + windowSize);
    
    const beforeTrend = analyzeTrendWindow(beforeWindow);
    const afterTrend = analyzeTrendWindow(afterWindow);
    
    const slopeDifference = Math.abs(afterTrend.slope - beforeTrend.slope);
    
    if (slopeDifference > threshold) {
      const changeType = determineChangeType(beforeTrend.slope, afterTrend.slope);
      changes.push({
        timestamp: sortedData[i].timestamp,
        changeType,
      });
    }
  }
  
  return changes;
}

/**
 * Analyze trend for a small window of data
 */
function analyzeTrendWindow(window: TrendPoint[]): { slope: number; direction: string } {
  const x = window.map((_, index) => index);
  const y = window.map(point => point.value);
  
  const slope = calculateSlope(x, y);
  const direction = slope > 0 ? 'up' : slope < 0 ? 'down' : 'stable';
  
  return { slope, direction };
}

/**
 * Determine the type of trend change
 */
function determineChangeType(beforeSlope: number, afterSlope: number): 'reversal' | 'acceleration' | 'deceleration' {
  if ((beforeSlope > 0 && afterSlope < 0) || (beforeSlope < 0 && afterSlope > 0)) {
    return 'reversal';
  }
  
  if (Math.abs(afterSlope) > Math.abs(beforeSlope)) {
    return 'acceleration';
  }
  
  return 'deceleration';
}

/**
 * Smooth data using moving average
 */
export function smoothTrendData(
  data: TrendPoint[],
  windowSize = 3
): TrendPoint[] {
  if (data.length < windowSize) return [...data];
  
  const smoothed: TrendPoint[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, start + windowSize);
    const window = data.slice(start, end);
    
    const averageValue = window.reduce((sum, point) => sum + point.value, 0) / window.length;
    
    smoothed.push({
      timestamp: data[i].timestamp,
      value: averageValue,
    });
  }
  
  return smoothed;
}

/**
 * Forecast next values using linear regression
 */
export function forecastValues(
  data: TrendPoint[],
  forecastPeriods = 3,
  confidenceLevel = 0.95
): Array<{
  timestamp: string;
  predictedValue: number;
  confidenceInterval: { lower: number; upper: number };
}> {
  if (data.length < 2) return [];
  
  const sortedData = [...data].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const x = sortedData.map((_, index) => index);
  const y = sortedData.map(point => point.value);
  
  const slope = calculateSlope(x, y);
  const intercept = calculateIntercept(x, y, slope);
  const residuals = calculateResiduals(x, y, slope, intercept);
  const standardError = calculateStandardError(residuals);
  
  const forecasts: Array<{
    timestamp: string;
    predictedValue: number;
    confidenceInterval: { lower: number; upper: number };
  }> = [];
  
  const lastTimestamp = new Date(sortedData[sortedData.length - 1].timestamp);
  const timeDiff = sortedData.length > 1 
    ? new Date(sortedData[1].timestamp).getTime() - new Date(sortedData[0].timestamp).getTime()
    : 24 * 60 * 60 * 1000; // Default to 1 day
  
  for (let i = 1; i <= forecastPeriods; i++) {
    const futureX = x.length - 1 + i;
    const predictedValue = slope * futureX + intercept;
    
    const tScore = getTScoreForConfidence(confidenceLevel);
    const margin = tScore * standardError * Math.sqrt(1 + 1/x.length + Math.pow(futureX - x.reduce((a, b) => a + b, 0)/x.length, 2) / x.reduce((sum, val, idx) => sum + Math.pow(val - x.reduce((a, b) => a + b, 0)/x.length, 2), 0));
    
    const futureTimestamp = new Date(lastTimestamp.getTime() + i * timeDiff);
    
    forecasts.push({
      timestamp: futureTimestamp.toISOString(),
      predictedValue,
      confidenceInterval: {
        lower: predictedValue - margin,
        upper: predictedValue + margin,
      },
    });
  }
  
  return forecasts;
}

/**
 * Calculate intercept for linear regression
 */
function calculateIntercept(x: number[], y: number[], slope: number): number {
  const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
  const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
  return meanY - slope * meanX;
}

/**
 * Calculate residuals for regression analysis
 */
function calculateResiduals(x: number[], y: number[], slope: number, intercept: number): number[] {
  return y.map((actualY, i) => {
    const predictedY = slope * x[i] + intercept;
    return actualY - predictedY;
  });
}

/**
 * Calculate standard error of residuals
 */
function calculateStandardError(residuals: number[]): number {
  if (residuals.length <= 2) return 1;
  
  const sumSquaredResiduals = residuals.reduce((sum, residual) => sum + residual * residual, 0);
  return Math.sqrt(sumSquaredResiduals / (residuals.length - 2));
}

/**
 * Get t-score for confidence level (approximation)
 */
function getTScoreForConfidence(confidence: number): number {
  const tScoreMap: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  
  return tScoreMap[confidence] || 1.96; // Default to 95%
}

/**
 * Calculate seasonal patterns in trend data
 */
export function detectSeasonality(
  data: TrendPoint[],
  expectedPeriod: number // e.g., 7 for weekly, 30 for monthly
): {
  hasSeasonality: boolean;
  strength: number;
  period: number;
} {
  if (data.length < expectedPeriod * 2) {
    return { hasSeasonality: false, strength: 0, period: 0 };
  }
  
  const values = data.map(point => point.value);
  const autocorrelation = calculateAutocorrelation(values, expectedPeriod);
  
  return {
    hasSeasonality: Math.abs(autocorrelation) > 0.3,
    strength: Math.abs(autocorrelation),
    period: expectedPeriod,
  };
}

/**
 * Calculate autocorrelation at specific lag
 */
function calculateAutocorrelation(values: number[], lag: number): number {
  if (values.length <= lag) return 0;
  
  const n = values.length - lag;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (values[i] - mean) * (values[i + lag] - mean);
  }
  
  for (let i = 0; i < values.length; i++) {
    denominator += Math.pow(values[i] - mean, 2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}