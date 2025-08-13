/**
 * Analytics calculation utility functions
 * 
 * Single Responsibility: Mathematical calculations for analytics and statistics
 */

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return (correct / total) * 100;
}

/**
 * Calculate mastery level based on accuracy and volume
 */
export function calculateMasteryLevel(accuracy: number, questionsAnswered: number): 'novice' | 'intermediate' | 'advanced' | 'expert' {
  if (questionsAnswered < 10) return 'novice';
  if (accuracy >= 90 && questionsAnswered >= 50) return 'expert';
  if (accuracy >= 80 && questionsAnswered >= 30) return 'advanced';
  if (accuracy >= 70 && questionsAnswered >= 15) return 'intermediate';
  return 'novice';
}

/**
 * Calculate competency score
 */
export function calculateCompetencyScore(
  accuracy: number, 
  questionsAnswered: number, 
  difficultyWeight = 1,
  timeEfficiency = 1
): number {
  if (questionsAnswered === 0) return 0;
  
  const baseScore = accuracy * (questionsAnswered / 100);
  const difficultyBonus = difficultyWeight * 0.2;
  const efficiencyBonus = timeEfficiency * 0.1;
  
  return Math.min(100, baseScore + difficultyBonus + efficiencyBonus);
}

/**
 * Calculate performance trend
 */
export function calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const recent = values.slice(-Math.min(5, values.length));
  const earlier = values.slice(0, Math.min(5, values.length));
  
  const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
  
  const difference = recentAvg - earlierAvg;
  const threshold = 5; // 5% threshold
  
  if (difference > threshold) return 'improving';
  if (difference < -threshold) return 'declining';
  return 'stable';
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) return values;
  
  const result: number[] = [];
  
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / windowSize;
    result.push(average);
  }
  
  return result;
}

/**
 * Calculate percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  
  if (Number.isInteger(index)) {
    return sorted[index];
  }
  
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate correlation coefficient between two data sets
 */
export function calculateCorrelation(x: number[], y: number[]): number {
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
 * Calculate z-score
 */
export function calculateZScore(value: number, mean: number, standardDeviation: number): number {
  if (standardDeviation === 0) return 0;
  return (value - mean) / standardDeviation;
}

/**
 * Calculate confidence interval
 */
export function calculateConfidenceInterval(
  values: number[], 
  confidence = 0.95
): { lower: number; upper: number; mean: number } {
  if (values.length === 0) {
    return { lower: 0, upper: 0, mean: 0 };
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const standardError = calculateStandardDeviation(values) / Math.sqrt(values.length);
  
  // Using t-distribution approximation (z-score for large samples)
  const alpha = 1 - confidence;
  const zScore = getZScoreForConfidence(confidence);
  const margin = zScore * standardError;
  
  return {
    lower: mean - margin,
    upper: mean + margin,
    mean,
  };
}

/**
 * Get z-score for confidence level (approximation)
 */
function getZScoreForConfidence(confidence: number): number {
  const confidenceMap: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  
  return confidenceMap[confidence] || 1.96; // Default to 95%
}

/**
 * Calculate study efficiency score
 */
export function calculateStudyEfficiency(
  timeSpent: number, // in minutes
  questionsAnswered: number,
  accuracy: number
): number {
  if (timeSpent === 0 || questionsAnswered === 0) return 0;
  
  const questionsPerMinute = questionsAnswered / timeSpent;
  const baseEfficiency = questionsPerMinute * accuracy;
  
  // Normalize to 0-100 scale (assuming 1 question per minute at 100% accuracy = 100)
  return Math.min(100, baseEfficiency * 100);
}

/**
 * Calculate improvement rate
 */
export function calculateImprovementRate(
  initialScore: number,
  currentScore: number,
  timeSpan: number // in days
): number {
  if (timeSpan === 0) return 0;
  
  const improvement = currentScore - initialScore;
  return (improvement / timeSpan) * 7; // Convert to weekly rate
}

/**
 * Calculate learning velocity
 */
export function calculateLearningVelocity(
  competencyGains: number[],
  timeframes: number[] // in days
): number {
  if (competencyGains.length !== timeframes.length || competencyGains.length === 0) {
    return 0;
  }
  
  const totalGain = competencyGains.reduce((sum, gain) => sum + gain, 0);
  const totalTime = timeframes.reduce((sum, time) => sum + time, 0);
  
  return totalTime === 0 ? 0 : (totalGain / totalTime) * 7; // Weekly velocity
}