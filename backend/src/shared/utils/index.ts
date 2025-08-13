/**
 * Central utility exports following domain separation pattern
 * 
 * Objective 31: Utility Function Organization
 * Organized utilities by domain with clear boundaries and consistent interfaces
 */

// Common utilities - cross-domain helpers
export * from './common';

// Domain-specific utilities
export * from './data';
export * from './analytics';
export * from './auth';
export * from './aws';
export * from './http';

// Re-export commonly used utilities at the top level for convenience
export {
  formatDate,
  parseDate,
  isValidDate,
} from './common/date-utils';

export {
  sanitizeString,
  truncateString,
  camelCase,
  kebabCase,
} from './common/string-utils';

export {
  isValidEmail,
  isValidUUID,
  isValidURL,
} from './common/validation-utils';

export {
  formatBytes,
  formatNumber,
  formatPercentage,
} from './common/format-utils';