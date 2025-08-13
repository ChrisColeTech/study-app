/**
 * S3 utility functions
 * 
 * Single Responsibility: S3 operations and key management utilities
 */

/**
 * Generate S3 key for question files
 */
export function generateQuestionKey(providerId: string, examId: string, filename = 'questions.json'): string {
  return `questions/${providerId}/${examId}/${filename}`;
}

/**
 * Parse S3 key to extract components
 */
export function parseS3Key(key: string): {
  type?: 'questions' | 'analytics' | 'uploads';
  providerId?: string;
  examId?: string;
  filename?: string;
  userId?: string;
} {
  const parts = key.split('/');
  
  if (parts[0] === 'questions' && parts.length >= 4) {
    return {
      type: 'questions',
      providerId: parts[1],
      examId: parts[2],
      filename: parts[3],
    };
  }
  
  if (parts[0] === 'analytics' && parts.length >= 3) {
    return {
      type: 'analytics',
      userId: parts[1],
      filename: parts[2],
    };
  }
  
  if (parts[0] === 'uploads' && parts.length >= 3) {
    return {
      type: 'uploads',
      userId: parts[1],
      filename: parts[2],
    };
  }
  
  return {};
}

/**
 * Validate S3 key format
 */
export function isValidS3Key(key: string): boolean {
  // S3 key constraints
  if (!key || key.length === 0 || key.length > 1024) {
    return false;
  }
  
  // Should not start or end with slash
  if (key.startsWith('/') || key.endsWith('/')) {
    return false;
  }
  
  // Should not contain double slashes
  if (key.includes('//')) {
    return false;
  }
  
  // Should not contain invalid characters
  const invalidChars = /[^a-zA-Z0-9\-_.!*()'\/]/;
  return !invalidChars.test(key);
}

/**
 * Normalize S3 key (remove extra slashes, etc.)
 */
export function normalizeS3Key(key: string): string {
  return key
    .replace(/\/+/g, '/') // Remove multiple slashes
    .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
    .trim();
}

/**
 * Generate analytics snapshot key
 */
export function generateAnalyticsSnapshotKey(userId: string, type: string, timestamp?: string): string {
  const ts = timestamp || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `analytics/${userId}/${type}-${ts}.json`;
}

/**
 * Generate user upload key
 */
export function generateUserUploadKey(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = sanitizeFilename(filename);
  return `uploads/${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Sanitize filename for S3 usage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\-_.]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
}

/**
 * Extract file extension from S3 key
 */
export function getFileExtension(key: string): string {
  const parts = key.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if S3 key represents a JSON file
 */
export function isJsonFile(key: string): boolean {
  return getFileExtension(key) === 'json';
}

/**
 * Generate presigned URL expiration time
 */
export function getPresignedUrlExpiration(hours = 1): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration;
}

/**
 * Validate S3 bucket name format
 */
export function isValidBucketName(bucketName: string): boolean {
  // S3 bucket naming rules
  if (!bucketName || bucketName.length < 3 || bucketName.length > 63) {
    return false;
  }
  
  // Must start and end with letter or number
  if (!/^[a-z0-9]/.test(bucketName) || !/[a-z0-9]$/.test(bucketName)) {
    return false;
  }
  
  // Can contain only lowercase letters, numbers, hyphens, and periods
  if (!/^[a-z0-9.-]+$/.test(bucketName)) {
    return false;
  }
  
  // Cannot contain consecutive periods or hyphens
  if (bucketName.includes('..') || bucketName.includes('--')) {
    return false;
  }
  
  // Cannot be formatted as IP address
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipPattern.test(bucketName)) {
    return false;
  }
  
  return true;
}

/**
 * Get S3 object size category
 */
export function getSizeCategory(sizeBytes: number): 'small' | 'medium' | 'large' | 'xlarge' {
  if (sizeBytes < 1024 * 1024) return 'small'; // < 1MB
  if (sizeBytes < 10 * 1024 * 1024) return 'medium'; // < 10MB
  if (sizeBytes < 100 * 1024 * 1024) return 'large'; // < 100MB
  return 'xlarge'; // >= 100MB
}

/**
 * Generate ETag for content validation
 */
export function generateContentHash(content: string): string {
  // Simple hash for content validation (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Check if S3 error is retryable
 */
export function isRetryableS3Error(error: any): boolean {
  if (!error || !error.name) return false;
  
  const retryableErrors = [
    'NetworkingError',
    'TimeoutError',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalError',
    'SlowDown',
  ];
  
  return retryableErrors.includes(error.name) || 
         (error.statusCode && error.statusCode >= 500);
}

/**
 * Get retry delay for S3 operations (exponential backoff)
 */
export function getS3RetryDelay(attempt: number, baseDelay = 1000): number {
  const maxDelay = 30000; // 30 seconds max
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000; // Add some randomness
  
  return Math.min(maxDelay, delay + jitter);
}

/**
 * Parse S3 ARN
 */
export function parseS3Arn(arn: string): {
  partition?: string;
  service?: string;
  region?: string;
  accountId?: string;
  resourceType?: string;
  bucketName?: string;
  objectKey?: string;
} {
  const arnPattern = /^arn:([^:]+):([^:]+):([^:]*):([^:]*):(.+)$/;
  const match = arn.match(arnPattern);
  
  if (!match) return {};
  
  const [, partition, service, region, accountId, resource] = match;
  
  if (service !== 's3') return { partition, service, region, accountId };
  
  // Parse S3 resource
  const resourceParts = resource.split('/');
  const bucketName = resourceParts[0];
  const objectKey = resourceParts.slice(1).join('/');
  
  return {
    partition,
    service,
    region,
    accountId,
    resourceType: 'bucket',
    bucketName,
    ...(objectKey && { objectKey }),
  };
}

/**
 * Generate S3 object URL
 */
export function generateS3Url(
  bucketName: string,
  key: string,
  region = 'us-east-1',
  usePathStyle = false
): string {
  if (usePathStyle) {
    return `https://s3.${region}.amazonaws.com/${bucketName}/${key}`;
  }
  
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}