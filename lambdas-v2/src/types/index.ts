import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

// Base Handler Types
export type PublicHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
export type AuthenticatedHandler = (event: APIGatewayProxyEvent, userId: string) => Promise<APIGatewayProxyResult>;
export type AuthorizerHandler = (event: APIGatewayTokenAuthorizerEvent) => Promise<APIGatewayAuthorizerResult>;

// Common API Response Structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  version: string;
}

// Error Types
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// User Context
export interface UserContext {
  userId: string;
  email: string;
  role?: string;
  permissions?: string[];
}

// JWT Token Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

// Database Entities
export interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface StudySession {
  sessionId: string;
  userId: string;
  provider: string;
  exam: string;
  status: 'active' | 'completed' | 'paused';
  startTime: string;
  endTime?: string;
  questionsAnswered: number;
  correctAnswers: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number; // TTL
}

export interface StudyGoal {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused';
  progress: number; // 0-100
  metrics: {
    questionsTarget: number;
    questionsCompleted: number;
    accuracyTarget: number;
    currentAccuracy: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEvent {
  userId: string;
  eventType: string;
  eventData: any;
  timestamp: string;
  sessionId?: string;
  provider?: string;
  exam?: string;
  expiresAt: number; // TTL
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  exams: Exam[];
}

export interface Exam {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  duration?: number;
  passingScore?: number;
}

export interface Question {
  questionId: string;
  provider: string;
  exam: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  createdAt: string;
}

// Request/Response Types
export interface CreateSessionRequest {
  provider: string;
  exam: string;
  questionCount?: number;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  targetDate: string;
  questionsTarget: number;
  accuracyTarget: number;
}

export interface GetQuestionsRequest {
  provider: string;
  exam: string;
  limit?: number;
  difficulty?: string;
  topics?: string[];
}