/**
 * Date and time utility functions
 * 
 * Single Responsibility: Date/time manipulation and formatting
 */

/**
 * Format a date to ISO string with timezone handling
 */
export function formatDate(date: Date | string | number): string {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return dateObj.toISOString();
}

/**
 * Parse date from various formats
 */
export function parseDate(dateString: string): Date {
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Unable to parse date: ${dateString}`);
  }
  return parsed;
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format date for display (YYYY-MM-DD)
 */
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValidDate(dateObj)) {
    throw new Error(`Invalid date for display: ${date}`);
  }
  return dateObj.toISOString().split('T')[0];
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (!isValidDate(start) || !isValidDate(end)) {
    throw new Error('Invalid dates provided for daysBetween calculation');
  }
  
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * Get date range for analytics queries
 */
export function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * Get period key for time-based grouping
 */
export function getPeriodKey(date: Date | string, timeframe: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValidDate(dateObj)) {
    throw new Error(`Invalid date for period key: ${date}`);
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  switch (timeframe.toLowerCase()) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dateObj.getDay());
      return `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate()) / 7)}`;
    case 'monthly':
      return `${year}-${month}`;
    case 'yearly':
      return String(year);
    default:
      return `${year}-${month}-${day}`;
  }
}