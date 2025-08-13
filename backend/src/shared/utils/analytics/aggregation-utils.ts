/**
 * Data aggregation utility functions
 * 
 * Single Responsibility: Data grouping, summarization, and aggregation operations
 */

/**
 * Aggregate data by time period
 */
export function aggregateByTimePeriod<T>(
  data: T[],
  dateExtractor: (item: T) => Date | string,
  period: 'day' | 'week' | 'month' | 'year' = 'day'
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  
  for (const item of data) {
    const date = typeof dateExtractor(item) === 'string' 
      ? new Date(dateExtractor(item)) 
      : dateExtractor(item) as Date;
    
    const key = formatPeriodKey(date, period);
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  return groups;
}

/**
 * Format date as period key
 */
function formatPeriodKey(date: Date, period: 'day' | 'week' | 'month' | 'year'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (period) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-W${getWeekNumber(weekStart)}`;
    case 'month':
      return `${year}-${month}`;
    case 'year':
      return String(year);
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const daysDiff = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7);
  return String(weekNumber).padStart(2, '0');
}

/**
 * Aggregate numeric values with various operations
 */
export function aggregateNumeric(
  values: number[],
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'median'
): number {
  if (values.length === 0) return 0;
  
  switch (operation) {
    case 'sum':
      return values.reduce((sum, val) => sum + val, 0);
    case 'avg':
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'median':
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
    default:
      return 0;
  }
}

/**
 * Group data by multiple criteria
 */
export function groupByMultiple<T>(
  data: T[],
  groupers: Array<(item: T) => string | number>
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  
  for (const item of data) {
    const keys = groupers.map(grouper => grouper(item));
    const compositeKey = keys.join('|');
    
    if (!groups[compositeKey]) {
      groups[compositeKey] = [];
    }
    groups[compositeKey].push(item);
  }
  
  return groups;
}

/**
 * Create summary statistics for grouped data
 */
export function createSummaryStats<T>(
  groups: Record<string, T[]>,
  valueExtractor: (item: T) => number
): Record<string, {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
}> {
  const stats: Record<string, any> = {};
  
  for (const [key, items] of Object.entries(groups)) {
    const values = items.map(valueExtractor).filter(val => !isNaN(val));
    
    if (values.length === 0) {
      stats[key] = {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        median: 0,
      };
      continue;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mid = Math.floor(sorted.length / 2);
    
    stats[key] = {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      median: sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid],
    };
  }
  
  return stats;
}

/**
 * Calculate running totals
 */
export function calculateRunningTotals(values: number[]): number[] {
  const runningTotals: number[] = [];
  let total = 0;
  
  for (const value of values) {
    total += value;
    runningTotals.push(total);
  }
  
  return runningTotals;
}

/**
 * Calculate percentile buckets
 */
export function createPercentileBuckets(
  values: number[],
  bucketCount = 10
): Array<{ min: number; max: number; count: number; percentile: number }> {
  if (values.length === 0 || bucketCount <= 0) return [];
  
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: Array<{ min: number; max: number; count: number; percentile: number }> = [];
  const bucketSize = 100 / bucketCount;
  
  for (let i = 0; i < bucketCount; i++) {
    const startPercentile = i * bucketSize;
    const endPercentile = (i + 1) * bucketSize;
    
    const startIndex = Math.floor((startPercentile / 100) * sorted.length);
    const endIndex = Math.floor((endPercentile / 100) * sorted.length);
    
    const bucketValues = sorted.slice(startIndex, endIndex);
    
    buckets.push({
      min: bucketValues.length > 0 ? bucketValues[0] : 0,
      max: bucketValues.length > 0 ? bucketValues[bucketValues.length - 1] : 0,
      count: bucketValues.length,
      percentile: endPercentile,
    });
  }
  
  return buckets;
}

/**
 * Aggregate data with custom aggregation functions
 */
export function aggregateWithCustom<T, R>(
  data: T[],
  groupBy: (item: T) => string,
  aggregator: (group: T[]) => R
): Record<string, R> {
  const groups: Record<string, T[]> = {};
  
  // Group the data
  for (const item of data) {
    const key = groupBy(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  // Apply aggregation function
  const result: Record<string, R> = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = aggregator(group);
  }
  
  return result;
}

/**
 * Create histogram data
 */
export function createHistogram(
  values: number[],
  binCount = 10
): Array<{ binStart: number; binEnd: number; count: number; frequency: number }> {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / binCount;
  
  const bins: Array<{ binStart: number; binEnd: number; count: number; frequency: number }> = [];
  
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binSize;
    const binEnd = i === binCount - 1 ? max : binStart + binSize;
    
    const count = values.filter(val => val >= binStart && val < binEnd).length;
    const frequency = count / values.length;
    
    bins.push({
      binStart,
      binEnd,
      count,
      frequency,
    });
  }
  
  return bins;
}

/**
 * Calculate rank within dataset
 */
export function calculateRanks(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => b.value - a.value); // Sort descending for rank
  
  const ranks = new Array(values.length);
  
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].index] = i + 1;
  }
  
  return ranks;
}

/**
 * Calculate top N items by criteria
 */
export function getTopN<T>(
  data: T[],
  valueExtractor: (item: T) => number,
  n: number,
  ascending = false
): T[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = valueExtractor(a);
    const bVal = valueExtractor(b);
    return ascending ? aVal - bVal : bVal - aVal;
  });
  
  return sorted.slice(0, n);
}