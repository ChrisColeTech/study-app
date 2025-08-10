// Jest setup for Study App V3 Backend tests

import 'aws-sdk-client-mock-jest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.USERS_TABLE_NAME = 'test-users-table';
process.env.STUDY_SESSIONS_TABLE_NAME = 'test-study-sessions-table';
process.env.USER_PROGRESS_TABLE_NAME = 'test-user-progress-table';
process.env.GOALS_TABLE_NAME = 'test-goals-table';
process.env.QUESTION_DATA_BUCKET_NAME = 'test-question-data-bucket';
process.env.ASSETS_BUCKET_NAME = 'test-assets-bucket';
process.env.LOG_LEVEL = 'ERROR'; // Reduce log noise in tests

// Mock AWS SDK clients to avoid real AWS calls
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');

// Mock console methods to avoid cluttering test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Only show console.error and console.warn in tests if LOG_LEVEL is DEBUG
  if (process.env.TEST_LOG_LEVEL !== 'DEBUG') {
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clear all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Mock Date.now for consistent timestamps in tests
const mockDate = new Date('2024-01-01T00:00:00.000Z');
global.Date.now = jest.fn(() => mockDate.getTime());

// Helper function to create mock Lambda context
export const createMockContext = (overrides = {}) => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[1]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
  ...overrides,
});

// Helper function to create mock API Gateway event
export const createMockEvent = (overrides = {}) => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/health',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api-id',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/test/health',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200,
    resourceId: 'test-resource-id',
    resourcePath: '/health',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-user-agent',
      userArn: null,
    },
    authorizer: null,
  },
  resource: '/health',
  ...overrides,
});

// Custom matchers for API responses
expect.extend({
  toBeValidApiResponse(received) {
    const pass = 
      typeof received === 'object' &&
      typeof received.statusCode === 'number' &&
      typeof received.headers === 'object' &&
      typeof received.body === 'string';

    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid API response with statusCode, headers, and body`,
        pass: false,
      };
    }
  },

  toHaveSuccessResponse(received) {
    let parsedBody;
    try {
      parsedBody = JSON.parse(received.body);
    } catch (error) {
      return {
        message: () => `Expected response body to be valid JSON`,
        pass: false,
      };
    }

    const pass = received.statusCode >= 200 && received.statusCode < 300 && parsedBody.success === true;

    if (pass) {
      return {
        message: () => `Expected ${received} not to have a success response`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to have a success response (2xx status code and success: true)`,
        pass: false,
      };
    }
  },

  toHaveErrorResponse(received) {
    let parsedBody;
    try {
      parsedBody = JSON.parse(received.body);
    } catch (error) {
      return {
        message: () => `Expected response body to be valid JSON`,
        pass: false,
      };
    }

    const pass = received.statusCode >= 400 && parsedBody.success === false;

    if (pass) {
      return {
        message: () => `Expected ${received} not to have an error response`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to have an error response (4xx/5xx status code and success: false)`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidApiResponse(): R;
      toHaveSuccessResponse(): R;
      toHaveErrorResponse(): R;
    }
  }
}