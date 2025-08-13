/**
 * DynamoDB utility functions
 * 
 * Single Responsibility: DynamoDB operations and query building utilities
 */

/**
 * Build DynamoDB filter expression from conditions
 */
export function buildFilterExpression(conditions: Record<string, any>): {
  FilterExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, any>;
} {
  const expressions: string[] = [];
  const attributeNames: Record<string, string> = {};
  const attributeValues: Record<string, any> = {};
  
  let nameCounter = 0;
  let valueCounter = 0;
  
  for (const [key, value] of Object.entries(conditions)) {
    if (value === null || value === undefined) continue;
    
    const nameAlias = `#attr${nameCounter++}`;
    const valueAlias = `:val${valueCounter++}`;
    
    attributeNames[nameAlias] = key;
    attributeValues[valueAlias] = value;
    
    expressions.push(`${nameAlias} = ${valueAlias}`);
  }
  
  return {
    FilterExpression: expressions.join(' AND '),
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  };
}

/**
 * Build DynamoDB update expression
 */
export function buildUpdateExpression(updates: Record<string, any>): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, any>;
} {
  const setExpressions: string[] = [];
  const attributeNames: Record<string, string> = {};
  const attributeValues: Record<string, any> = {};
  
  let nameCounter = 0;
  let valueCounter = 0;
  
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) continue;
    
    const nameAlias = `#attr${nameCounter++}`;
    const valueAlias = `:val${valueCounter++}`;
    
    attributeNames[nameAlias] = key;
    attributeValues[valueAlias] = value;
    
    setExpressions.push(`${nameAlias} = ${valueAlias}`);
  }
  
  return {
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  };
}

/**
 * Build key condition expression for queries
 */
export function buildKeyConditionExpression(
  partitionKey: string,
  partitionValue: any,
  sortKey?: string,
  sortValue?: any,
  sortOperator: '=' | '>' | '>=' | '<' | '<=' | 'between' | 'begins_with' = '='
): {
  KeyConditionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, any>;
} {
  const attributeNames: Record<string, string> = {};
  const attributeValues: Record<string, any> = {};
  const expressions: string[] = [];
  
  // Partition key condition
  attributeNames['#pk'] = partitionKey;
  attributeValues[':pkval'] = partitionValue;
  expressions.push('#pk = :pkval');
  
  // Sort key condition (if provided)
  if (sortKey && sortValue !== undefined) {
    attributeNames['#sk'] = sortKey;
    
    switch (sortOperator) {
      case '=':
        attributeValues[':skval'] = sortValue;
        expressions.push('#sk = :skval');
        break;
      case '>':
        attributeValues[':skval'] = sortValue;
        expressions.push('#sk > :skval');
        break;
      case '>=':
        attributeValues[':skval'] = sortValue;
        expressions.push('#sk >= :skval');
        break;
      case '<':
        attributeValues[':skval'] = sortValue;
        expressions.push('#sk < :skval');
        break;
      case '<=':
        attributeValues[':skval'] = sortValue;
        expressions.push('#sk <= :skval');
        break;
      case 'begins_with':
        attributeValues[':skval'] = sortValue;
        expressions.push('begins_with(#sk, :skval)');
        break;
      case 'between':
        if (Array.isArray(sortValue) && sortValue.length === 2) {
          attributeValues[':skval1'] = sortValue[0];
          attributeValues[':skval2'] = sortValue[1];
          expressions.push('#sk BETWEEN :skval1 AND :skval2');
        }
        break;
    }
  }
  
  return {
    KeyConditionExpression: expressions.join(' AND '),
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  };
}

/**
 * Convert DynamoDB item to plain JavaScript object
 */
export function unmarshallDynamoDBItem(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(item)) {
    result[key] = unmarshallAttributeValue(value);
  }
  
  return result;
}

/**
 * Unmarshall single DynamoDB attribute value
 */
function unmarshallAttributeValue(attributeValue: any): any {
  if (!attributeValue || typeof attributeValue !== 'object') {
    return attributeValue;
  }
  
  // Handle different DynamoDB types
  if ('S' in attributeValue) return attributeValue.S;
  if ('N' in attributeValue) return Number(attributeValue.N);
  if ('B' in attributeValue) return attributeValue.B;
  if ('SS' in attributeValue) return attributeValue.SS;
  if ('NS' in attributeValue) return attributeValue.NS.map(Number);
  if ('BS' in attributeValue) return attributeValue.BS;
  if ('M' in attributeValue) return unmarshallDynamoDBItem(attributeValue.M);
  if ('L' in attributeValue) return attributeValue.L.map(unmarshallAttributeValue);
  if ('NULL' in attributeValue) return null;
  if ('BOOL' in attributeValue) return attributeValue.BOOL;
  
  return attributeValue;
}

/**
 * Marshall JavaScript object to DynamoDB item
 */
export function marshallDynamoDBItem(item: any): any {
  if (!item || typeof item !== 'object') {
    return item;
  }
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(item)) {
    result[key] = marshallAttributeValue(value);
  }
  
  return result;
}

/**
 * Marshall single value to DynamoDB attribute
 */
function marshallAttributeValue(value: any): any {
  if (value === null) return { NULL: true };
  if (value === undefined) return { NULL: true };
  
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (value instanceof Buffer) return { B: value };
  
  if (Array.isArray(value)) {
    if (value.length === 0) return { L: [] };
    
    // Check if it's a string set
    if (value.every(item => typeof item === 'string')) {
      return { SS: value };
    }
    
    // Check if it's a number set
    if (value.every(item => typeof item === 'number')) {
      return { NS: value.map(String) };
    }
    
    // Otherwise, it's a list
    return { L: value.map(marshallAttributeValue) };
  }
  
  if (typeof value === 'object') {
    return { M: marshallDynamoDBItem(value) };
  }
  
  // Fallback to string
  return { S: String(value) };
}

/**
 * Generate DynamoDB pagination token
 */
export function generatePaginationToken(lastEvaluatedKey: any): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
}

/**
 * Parse DynamoDB pagination token
 */
export function parsePaginationToken(token: string): any {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * Calculate DynamoDB capacity units (rough estimation)
 */
export function estimateCapacityUnits(itemSizeBytes: number, operation: 'read' | 'write'): number {
  if (operation === 'read') {
    // 1 RCU = 4KB for consistent reads, 8KB for eventually consistent
    return Math.ceil(itemSizeBytes / 4096);
  } else {
    // 1 WCU = 1KB
    return Math.ceil(itemSizeBytes / 1024);
  }
}

/**
 * Calculate item size in bytes (rough estimation)
 */
export function estimateItemSize(item: any): number {
  const json = JSON.stringify(item);
  return Buffer.byteLength(json, 'utf8');
}

/**
 * Check if DynamoDB error is retryable
 */
export function isRetryableDynamoDBError(error: any): boolean {
  if (!error || !error.name) return false;
  
  const retryableErrors = [
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalServerError',
    'RequestLimitExceeded',
    'ItemCollectionSizeLimitExceededException',
  ];
  
  return retryableErrors.includes(error.name) ||
         (error.statusCode && error.statusCode >= 500);
}

/**
 * Get retry delay for DynamoDB operations (exponential backoff)
 */
export function getDynamoDBRetryDelay(attempt: number, baseDelay = 1000): number {
  const maxDelay = 60000; // 60 seconds max
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000; // Add some randomness
  
  return Math.min(maxDelay, delay + jitter);
}

/**
 * Build projection expression
 */
export function buildProjectionExpression(fields: string[]): {
  ProjectionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
} {
  const attributeNames: Record<string, string> = {};
  const projections: string[] = [];
  
  let counter = 0;
  for (const field of fields) {
    const alias = `#proj${counter++}`;
    attributeNames[alias] = field;
    projections.push(alias);
  }
  
  return {
    ProjectionExpression: projections.join(', '),
    ExpressionAttributeNames: attributeNames,
  };
}

/**
 * Validate DynamoDB table name
 */
export function isValidTableName(tableName: string): boolean {
  // DynamoDB table name constraints
  if (!tableName || tableName.length < 3 || tableName.length > 255) {
    return false;
  }
  
  // Must contain only letters, numbers, underscores, hyphens, and periods
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(tableName);
}

/**
 * Generate GSI name
 */
export function generateGSIName(indexFields: string[]): string {
  return `GSI-${indexFields.join('-')}-index`;
}