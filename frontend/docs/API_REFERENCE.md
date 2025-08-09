# API Integration Reference - Multi-Exam Certification Study Platform Frontend

## 📚 Frontend API Integration Guide

This document provides comprehensive guidance for integrating the frontend with the multi-exam certification study platform backend API. It covers service layer implementation, state management, error handling, and best practices for consuming the multi-provider API.

## 🔧 Service Layer Architecture

### Base API Service

```typescript
// src/services/api/baseApiService.ts
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  timestamp?: string
}

export interface ApiError {
  code: string
  message: string
  details?: Array<{ field: string; message: string }>
  timestamp: string
  traceId?: string
}

export class BaseApiService {
  protected api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling and token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshToken()
          if (refreshed && error.config) {
            return this.api(error.config)
          }
        }
        return Promise.reject(this.transformError(error))
      }
    )
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem(import.meta.env.VITE_REFRESH_TOKEN_KEY || 'study_platform_refresh')
      if (!refreshToken) return false

      const response = await axios.post(`${this.api.defaults.baseURL}/auth/refresh`, {
        refreshToken,
      })

      const { accessToken, refreshToken: newRefreshToken } = response.data.data
      localStorage.setItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token', accessToken)
      localStorage.setItem(import.meta.env.VITE_REFRESH_TOKEN_KEY || 'study_platform_refresh', newRefreshToken)

      return true
    } catch {
      // Refresh failed, redirect to login
      localStorage.removeItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token')
      localStorage.removeItem(import.meta.env.VITE_REFRESH_TOKEN_KEY || 'study_platform_refresh')
      window.location.href = '/login'
      return false
    }
  }

  private transformError(error: AxiosError): ApiError {
    if (error.response?.data) {
      return error.response.data as ApiError
    }

    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
      timestamp: new Date().toISOString(),
    }
  }

  protected async request<T>(config: any): Promise<T> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api(config)
    return response.data.data
  }
}
```

### Authentication Service

```typescript
// src/services/api/authService.ts
import { BaseApiService } from './baseApiService'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isVerified: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export class AuthService extends BaseApiService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    })

    // Store tokens
    localStorage.setItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token', response.tokens.accessToken)
    localStorage.setItem(import.meta.env.VITE_REFRESH_TOKEN_KEY || 'study_platform_refresh', response.tokens.refreshToken)

    return response
  }

  async register(userData: RegisterRequest): Promise<{ user: User }> {
    return this.request({
      method: 'POST',
      url: '/auth/register',
      data: userData,
    })
  }

  async logout(): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        url: '/auth/logout',
      })
    } finally {
      localStorage.removeItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token')
      localStorage.removeItem(import.meta.env.VITE_REFRESH_TOKEN_KEY || 'study_platform_refresh')
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(import.meta.env.VITE_JWT_STORAGE_KEY || 'study_platform_token')
  }
}

export const authService = new AuthService()
```

### Exam Provider Service

```typescript
// src/services/api/providerService.ts
import { BaseApiService } from './baseApiService'

export interface ExamProvider {
  id: string
  name: string
  description: string
  logoUrl: string
  isActive: boolean
  examCount: number
  supportedCertifications: string[]
}

export interface Certification {
  id: string
  name: string
  description: string
  level: string
  duration: number
  questionCount: number
  passingScore: number
}

export interface ProviderDetails extends ExamProvider {
  website: string
  documentationUrl: string
  supportedCertifications: Certification[]
  categories: string[]
}

export class ProviderService extends BaseApiService {
  async getAllProviders(): Promise<ExamProvider[]> {
    return this.request({
      method: 'GET',
      url: '/providers',
    })
  }

  async getProvider(providerId: string): Promise<ProviderDetails> {
    return this.request({
      method: 'GET',
      url: `/providers/${providerId}`,
    })
  }

  async getProviderExams(providerId: string): Promise<Exam[]> {
    return this.request({
      method: 'GET',
      url: '/exams',
      params: { provider: providerId },
    })
  }
}

export const providerService = new ProviderService()
```

### Question Service

```typescript
// src/services/api/questionService.ts
import { BaseApiService } from './baseApiService'

export interface QuestionOption {
  id: string
  text: string
  isCorrect?: boolean // Only included in answers/explanations
}

export interface Question {
  id: string
  examId: string
  providerId: string
  questionNumber: number
  topic: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  questionType: 'single_choice' | 'multiple_choice' | 'true_false'
  questionText: string
  options: QuestionOption[]
  explanation?: string
  references?: Array<{ title: string; url: string }>
  tags: string[]
}

export interface QuestionFilters {
  examId?: string
  providerId?: string
  category?: string
  topic?: string
  difficulty?: string
  type?: string
  search?: string
}

export interface PaginatedQuestions {
  questions: Question[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export class QuestionService extends BaseApiService {
  async getQuestions(
    filters: QuestionFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedQuestions> {
    return this.request({
      method: 'GET',
      url: '/questions',
      params: {
        ...filters,
        page,
        limit,
      },
    })
  }

  async getQuestion(questionId: string): Promise<Question> {
    return this.request({
      method: 'GET',
      url: `/questions/${questionId}`,
    })
  }

  async searchQuestions(
    query: string,
    filters: QuestionFilters = {}
  ): Promise<PaginatedQuestions> {
    return this.request({
      method: 'GET',
      url: '/questions',
      params: {
        search: query,
        ...filters,
      },
    })
  }
}

export const questionService = new QuestionService()
```

### Study Session Service

```typescript
// src/services/api/sessionService.ts
import { BaseApiService } from './baseApiService'

export interface SessionConfig {
  questionCount: number
  timeLimit?: number
  topics?: string[]
  difficulty?: string
  showFeedback: boolean
  allowSkip: boolean
  randomizeQuestions: boolean
  randomizeOptions: boolean
}

export interface StudySession {
  sessionId: string
  examId: string
  providerId: string
  userId: string
  sessionType: 'practice' | 'exam' | 'review'
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  config: SessionConfig
  questions: Array<{
    id: string
    orderIndex: number
    isAnswered: boolean
  }>
  progress: {
    currentQuestionIndex: number
    answeredQuestions: number
    correctAnswers: number
    skippedQuestions: number
    timeElapsed: number
    accuracy?: number
  }
  startTime: string
}

export interface AnswerSubmission {
  questionId: string
  selectedOptions: string[]
  timeSpent: number
  confidence?: number
}

export interface AnswerResponse {
  questionId: string
  isCorrect: boolean
  selectedOptions: string[]
  correctOptions: string[]
  feedback?: {
    explanation: string
    references: Array<{ title: string; url: string }>
  }
  sessionProgress: StudySession['progress']
  nextQuestion?: {
    id: string
    questionText: string
    orderIndex: number
  }
}

export interface SessionResults {
  sessionId: string
  status: 'completed'
  results: {
    totalQuestions: number
    answeredQuestions: number
    correctAnswers: number
    skippedQuestions: number
    accuracy: number
    timeSpent: number
    passingScore: number
    passed: boolean
  }
  topicBreakdown: Array<{
    topic: string
    totalQuestions: number
    correctAnswers: number
    accuracy: number
  }>
  recommendations: Array<{
    type: string
    topic: string
    message: string
  }>
  completedAt: string
}

export class SessionService extends BaseApiService {
  async createSession(
    examId: string,
    sessionType: 'practice' | 'exam' | 'review',
    config: Partial<SessionConfig>
  ): Promise<StudySession> {
    return this.request({
      method: 'POST',
      url: '/sessions',
      data: {
        examId,
        sessionType,
        config,
      },
    })
  }

  async createMultiProviderSession(
    providers: string[],
    exams: string[],
    sessionType: 'practice' | 'timed' | 'topic_focus' | 'review',
    config: {
      questionCount: number
      timeLimit?: number
      topics?: string[]
      difficulty?: string
      randomize?: boolean
      showAnswers?: boolean
      allowReview?: boolean
    }
  ): Promise<StudySession> {
    return this.request({
      method: 'POST',
      url: '/sessions',
      data: {
        sessionType,
        providers,
        exams,
        config,
        name: `${providers.join(' & ')} Mixed Session`
      },
    })
  }

  async getSession(sessionId: string): Promise<StudySession> {
    return this.request({
      method: 'GET',
      url: `/sessions/${sessionId}`,
    })
  }

  async submitAnswer(
    sessionId: string,
    answer: AnswerSubmission
  ): Promise<AnswerResponse> {
    return this.request({
      method: 'POST',
      url: `/sessions/${sessionId}/answers`,
      data: answer,
    })
  }

  async completeSession(sessionId: string): Promise<SessionResults> {
    return this.request({
      method: 'POST',
      url: `/sessions/${sessionId}/complete`,
    })
  }

  async pauseSession(sessionId: string): Promise<StudySession> {
    return this.request({
      method: 'POST',
      url: `/sessions/${sessionId}/pause`,
    })
  }

  async resumeSession(sessionId: string): Promise<StudySession> {
    return this.request({
      method: 'POST',
      url: `/sessions/${sessionId}/resume`,
    })
  }
}

export const sessionService = new SessionService()
```

### Analytics Service

```typescript
// src/services/api/analyticsService.ts
import { BaseApiService } from './baseApiService'

export interface OverallProgress {
  totalSessions: number
  totalQuestionsAnswered: number
  overallAccuracy: number
  studyTimeHours: number
  activeProviders: string[]
  strongestProvider: string
  improvementTrend: 'positive' | 'neutral' | 'negative'
}

export interface ProviderProgress {
  providerId: string
  providerName: string
  sessions: number
  questionsAnswered: number
  accuracy: number
  studyTimeHours: number
  topicProgress: Array<{
    topic: string
    accuracy: number
    questionsAnswered: number
    masteryLevel: 'novice' | 'developing' | 'proficient' | 'expert'
  }>
}

export interface CrossProviderInsights {
  transferableSkills: string[]
  conceptMapping: Array<{
    concept: string
    providerTerms: Record<string, string>
    userProficiency: Record<string, number | null>
  }>
  recommendedNextSteps: string[]
}

export interface UserAnalytics {
  overallProgress: OverallProgress
  providerProgress: ProviderProgress[]
  crossProviderInsights: CrossProviderInsights
}

export interface StudyGoal {
  goalId: string
  goalType: string
  examId: string
  targetDate: string
  dailyStudyMinutes: number
  weeklySessionTarget: number
  accuracyTarget: number
  progress: {
    daysRemaining: number
    currentAccuracy: number
    weeklySessionsCompleted: number
    onTrack: boolean
  }
  recommendations: string[]
}

export class AnalyticsService extends BaseApiService {
  async getProgress(
    providerId?: string,
    examId?: string,
    timeframe?: string
  ): Promise<UserAnalytics> {
    return this.request({
      method: 'GET',
      url: '/analytics/progress',
      params: {
        providerId,
        examId,
        timeframe,
      },
    })
  }

  async getPerformanceMetrics(): Promise<{
    trends: {
      accuracyTrend: Array<{ date: string; accuracy: number }>
      studyTimeTrend: Array<{ date: string; minutes: number }>
    }
    crossProviderComparison: {
      strongestProvider: { provider: string; accuracy: number }
      weakestProvider: { provider: string; accuracy: number }
      transferableSkills: Array<{
        skill: string
        providers: string[]
        averageAccuracy: number
      }>
    }
    weeklyGoals: {
      questionsTarget: number
      questionsCompleted: number
      accuracyTarget: number
      currentAccuracy: number
      studyTimeTarget: number
      studyTimeCompleted: number
    }
  }> {
    return this.request({
      method: 'GET',
      url: '/analytics/performance',
    })
  }

  async getRecommendations(): Promise<{
    recommendations: Array<{
      type: 'weak_topic' | 'exam_readiness' | 'cross_provider'
      priority: 'high' | 'medium' | 'low'
      title: string
      description: string
      action: string
      provider?: string
      topic?: string
      exam?: string
    }>
    nextStudySession: {
      recommended: boolean
      provider: string
      exam?: string
      focusTopics: string[]
      questionCount: number
      estimatedTime: number
    }
    achievements: Array<{
      id: string
      title: string
      description: string
      earnedAt: string
      points: number
    }>
  }> {
    return this.request({
      method: 'GET',
      url: '/analytics/recommendations',
    })
  }

  async setStudyGoal(goal: Partial<StudyGoal>): Promise<StudyGoal> {
    return this.request({
      method: 'POST',
      url: '/analytics/goals',
      data: goal,
    })
  }

  async getStudyGoals(): Promise<StudyGoal[]> {
    return this.request({
      method: 'GET',
      url: '/analytics/goals',
    })
  }

  async updateStudyGoal(goalId: string, updates: Partial<StudyGoal>): Promise<StudyGoal> {
    return this.request({
      method: 'PUT',
      url: `/analytics/goals/${goalId}`,
      data: updates,
    })
  }
}

export const analyticsService = new AnalyticsService()
```

## 🏪 State Management with Zustand

### Auth Store

```typescript
// src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService, User } from '../services/api/authService'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (userData: any) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login({ email, password })
          set({ 
            user: response.user, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error: any) {
          set({ 
            error: error.message || 'Login failed', 
            isLoading: false,
            isAuthenticated: false,
            user: null
          })
          throw error
        }
      },

      register: async (userData: any) => {
        set({ isLoading: true, error: null })
        try {
          await authService.register(userData)
          set({ isLoading: false })
        } catch (error: any) {
          set({ error: error.message || 'Registration failed', isLoading: false })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await authService.logout()
        } finally {
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null
          })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)
```

### Multi-Exam Store

```typescript
// src/store/examStore.ts
import { create } from 'zustand'
import { ExamProvider, providerService } from '../services/api/providerService'

interface ExamState {
  providers: ExamProvider[]
  selectedProvider: ExamProvider | null
  currentExam: any | null
  availableExams: any[]
  isLoading: boolean
  error: string | null

  // Actions
  loadProviders: () => Promise<void>
  selectProvider: (providerId: string) => Promise<void>
  loadProviderExams: (providerId: string) => Promise<void>
  selectExam: (examId: string) => void
  clearError: () => void
}

export const useExamStore = create<ExamState>((set, get) => ({
  providers: [],
  selectedProvider: null,
  currentExam: null,
  availableExams: [],
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null })
    try {
      const providers = await providerService.getAllProviders()
      set({ providers, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectProvider: async (providerId: string) => {
    set({ isLoading: true, error: null })
    try {
      const provider = await providerService.getProvider(providerId)
      const exams = await providerService.getProviderExams(providerId)
      set({ 
        selectedProvider: provider, 
        availableExams: exams,
        isLoading: false 
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  loadProviderExams: async (providerId: string) => {
    set({ isLoading: true, error: null })
    try {
      const exams = await providerService.getProviderExams(providerId)
      set({ availableExams: exams, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectExam: (examId: string) => {
    const exam = get().availableExams.find(e => e.id === examId)
    set({ currentExam: exam })
  },

  clearError: () => set({ error: null }),
}))
```

### Study Session Store

```typescript
// src/store/sessionStore.ts
import { create } from 'zustand'
import { 
  StudySession, 
  SessionResults, 
  sessionService 
} from '../services/api/sessionService'

interface SessionState {
  currentSession: StudySession | null
  sessionHistory: StudySession[]
  isLoading: boolean
  error: string | null

  // Actions
  createSession: (examId: string, sessionType: string, config: any) => Promise<void>
  createMultiProviderSession: (providers: string[], exams: string[], sessionType: string, config: any) => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  submitAnswer: (answer: any) => Promise<void>
  completeSession: () => Promise<SessionResults>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  clearCurrentSession: () => void
  clearError: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessionHistory: [],
  isLoading: false,
  error: null,

  createSession: async (examId: string, sessionType: any, config: any) => {
    set({ isLoading: true, error: null })
    try {
      const session = await sessionService.createSession(examId, sessionType, config)
      set({ currentSession: session, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  createMultiProviderSession: async (providers: string[], exams: string[], sessionType: any, config: any) => {
    set({ isLoading: true, error: null })
    try {
      const session = await sessionService.createMultiProviderSession(providers, exams, sessionType, config)
      set({ currentSession: session, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  loadSession: async (sessionId: string) => {
    set({ isLoading: true, error: null })
    try {
      const session = await sessionService.getSession(sessionId)
      set({ currentSession: session, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  submitAnswer: async (answer: any) => {
    const session = get().currentSession
    if (!session) return

    set({ isLoading: true })
    try {
      const response = await sessionService.submitAnswer(session.sessionId, answer)
      
      // Update session progress
      set({ 
        currentSession: {
          ...session,
          progress: response.sessionProgress
        },
        isLoading: false 
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  completeSession: async () => {
    const session = get().currentSession
    if (!session) throw new Error('No active session')

    set({ isLoading: true })
    try {
      const results = await sessionService.completeSession(session.sessionId)
      set({ 
        currentSession: null,
        sessionHistory: [...get().sessionHistory, session],
        isLoading: false 
      })
      return results
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  pauseSession: async () => {
    const session = get().currentSession
    if (!session) return

    try {
      const pausedSession = await sessionService.pauseSession(session.sessionId)
      set({ currentSession: pausedSession })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  resumeSession: async () => {
    const session = get().currentSession
    if (!session) return

    try {
      const resumedSession = await sessionService.resumeSession(session.sessionId)
      set({ currentSession: resumedSession })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  clearCurrentSession: () => set({ currentSession: null }),
  clearError: () => set({ error: null }),
}))
```

## 🎣 Custom Hooks for API Integration

### useExamProviders Hook

```typescript
// src/hooks/useExamProviders.ts
import { useEffect } from 'react'
import { useExamStore } from '../store/examStore'

export const useExamProviders = () => {
  const { 
    providers, 
    selectedProvider, 
    isLoading, 
    error,
    loadProviders,
    selectProvider,
    clearError
  } = useExamStore()

  useEffect(() => {
    if (providers.length === 0) {
      loadProviders()
    }
  }, [loadProviders, providers.length])

  return {
    providers,
    selectedProvider,
    isLoading,
    error,
    selectProvider,
    clearError,
  }
}
```

### useStudySession Hook

```typescript
// src/hooks/useStudySession.ts
import { useCallback } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { toast } from 'react-hot-toast'

export const useStudySession = () => {
  const {
    currentSession,
    isLoading,
    error,
    createSession,
    submitAnswer,
    completeSession,
    pauseSession,
    resumeSession,
    clearError
  } = useSessionStore()

  const handleCreateSession = useCallback(async (
    examId: string, 
    sessionType: string, 
    config: any
  ) => {
    try {
      await createSession(examId, sessionType, config)
      toast.success('Study session started!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create session')
    }
  }, [createSession])

  const handleSubmitAnswer = useCallback(async (answer: any) => {
    try {
      await submitAnswer(answer)
    } catch (error: any) {
      toast.error('Failed to submit answer')
    }
  }, [submitAnswer])

  const handleCompleteSession = useCallback(async () => {
    try {
      const results = await completeSession()
      toast.success('Session completed!')
      return results
    } catch (error: any) {
      toast.error('Failed to complete session')
      throw error
    }
  }, [completeSession])

  return {
    currentSession,
    isLoading,
    error,
    createSession: handleCreateSession,
    submitAnswer: handleSubmitAnswer,
    completeSession: handleCompleteSession,
    pauseSession,
    resumeSession,
    clearError,
  }
}
```

## 🚨 Error Handling and Loading States

### Error Boundary Component

```typescript
// src/components/common/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Report error to monitoring service
    if (import.meta.env.PROD) {
      // reportError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="retry-button"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Loading Component

```typescript
// src/components/common/LoadingSpinner.tsx
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium',
  message = 'Loading...'
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8', 
    large: 'w-12 h-12'
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div 
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
      />
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  )
}
```

This frontend API integration reference provides a comprehensive foundation for building a robust, type-safe frontend that effectively consumes the multi-exam certification platform API while maintaining excellent user experience and error handling.