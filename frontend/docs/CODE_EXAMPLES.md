# Code Examples - Multi-Exam Certification Study Platform

## 📚 Overview

This document provides comprehensive code examples for building components, implementing business logic, and integrating with the multi-exam certification study platform backend API. All examples demonstrate JWT authentication, real-time session synchronization, cross-provider analytics, and local JSON data processing integration across multiple certification providers (AWS, Azure, Google Cloud, CompTIA, Cisco).

## 🔗 Backend API Integration Examples

### JWT Authentication Hook

```tsx
// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/api/authService'

interface UseAuthReturn {
  isAuthenticated: boolean
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  loading: boolean
  error: string | null
  clearError: () => void
}

export const useAuth = (): UseAuthReturn => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    register: storeRegister,
    clearError: storeClearError
  } = useAuthStore()

  // Check authentication status on mount
  useEffect(() => {
    const initAuth = async () => {
      if (authService.isAuthenticated() && !user) {
        try {
          // Auto-login with stored token
          const storedUser = JSON.parse(localStorage.getItem('user') || 'null')
          if (storedUser) {
            useAuthStore.setState({ user: storedUser, isAuthenticated: true })
          }
        } catch (error) {
          console.error('Failed to restore authentication:', error)
          await storeLogout()
        }
      }
    }

    initAuth()
  }, [user, storeLogout])

  const login = useCallback(async (email: string, password: string) => {
    await storeLogin(email, password)
  }, [storeLogin])

  const logout = useCallback(async () => {
    await storeLogout()
  }, [storeLogout])

  const register = useCallback(async (userData: RegisterRequest) => {
    await storeRegister(userData)
  }, [storeRegister])

  return {
    isAuthenticated,
    user,
    login,
    logout,
    register,
    loading: isLoading,
    error,
    clearError: storeClearError
  }
}
```

### Multi-Provider Session Hook

```tsx
// src/hooks/useMultiProviderSession.ts
import { useState, useCallback } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { sessionService } from '../services/api/sessionService'
import { StudySession, SessionConfig } from '../types/sessions'

interface UseMultiProviderSessionReturn {
  currentSession: StudySession | null
  createMixedSession: (
    providers: string[],
    exams: string[],
    config: SessionConfig
  ) => Promise<StudySession>
  submitAnswer: (questionId: string, answers: string[]) => Promise<void>
  completeSession: () => Promise<SessionResults>
  loading: boolean
  error: string | null
}

export const useMultiProviderSession = (): UseMultiProviderSessionReturn => {
  const {
    currentSession,
    createMultiProviderSession,
    submitAnswer: storeSubmitAnswer,
    completeSession: storeCompleteSession,
    isLoading,
    error
  } = useSessionStore()

  const [localLoading, setLocalLoading] = useState(false)

  const createMixedSession = useCallback(async (
    providers: string[],
    exams: string[],
    config: SessionConfig
  ): Promise<StudySession> => {
    setLocalLoading(true)
    try {
      await createMultiProviderSession(providers, exams, 'practice', config)
      return currentSession!
    } finally {
      setLocalLoading(false)
    }
  }, [createMultiProviderSession, currentSession])

  const submitAnswer = useCallback(async (
    questionId: string,
    answers: string[]
  ) => {
    if (!currentSession) throw new Error('No active session')
    
    await storeSubmitAnswer({
      questionId,
      selectedAnswers: answers,
      timeSpent: 30, // Track time spent
      confidence: null
    })
  }, [currentSession, storeSubmitAnswer])

  const completeSession = useCallback(async () => {
    const results = await storeCompleteSession()
    return results
  }, [storeCompleteSession])

  return {
    currentSession,
    createMixedSession,
    submitAnswer,
    completeSession,
    loading: isLoading || localLoading,
    error
  }
}
```

### Cross-Provider Analytics Hook

```tsx
// src/hooks/useCrossProviderAnalytics.ts
import { useState, useEffect, useCallback } from 'react'
import { analyticsService } from '../services/api/analyticsService'
import { UserAnalytics, StudyGoal } from '../types/analytics'

interface UseCrossProviderAnalyticsReturn {
  analytics: UserAnalytics | null
  recommendations: any | null
  goals: StudyGoal[]
  loading: boolean
  error: string | null
  refreshAnalytics: () => Promise<void>
  setStudyGoal: (goal: Partial<StudyGoal>) => Promise<void>
}

export const useCrossProviderAnalytics = (): UseCrossProviderAnalyticsReturn => {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [recommendations, setRecommendations] = useState<any | null>(null)
  const [goals, setGoals] = useState<StudyGoal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [analyticsData, recommendationsData, goalsData] = await Promise.all([
        analyticsService.getProgress(),
        analyticsService.getRecommendations(),
        analyticsService.getStudyGoals()
      ])

      setAnalytics(analyticsData)
      setRecommendations(recommendationsData)
      setGoals(goalsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  const setStudyGoal = useCallback(async (goal: Partial<StudyGoal>) => {
    setLoading(true)
    try {
      const newGoal = await analyticsService.setStudyGoal(goal)
      setGoals(prev => [...prev, newGoal])
    } catch (err: any) {
      setError(err.message || 'Failed to set study goal')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAnalytics()
  }, [refreshAnalytics])

  return {
    analytics,
    recommendations,
    goals,
    loading,
    error,
    refreshAnalytics,
    setStudyGoal
  }
}
```

### Protected Route Component

```tsx
// src/components/auth/ProtectedRoute.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingSpinner } from '../common/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner message="Checking authentication..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login with current location
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

### API Error Boundary Component

```tsx
// src/components/common/ApiErrorBoundary.tsx
import React, { Component, ReactNode } from 'react'
import { authService } from '../../services/api/authService'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: any
}

export class ApiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('API Error Boundary caught an error:', error, errorInfo)
    
    // Handle authentication errors
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      authService.logout()
      window.location.href = '/login'
      return
    }
    
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-600 mb-4">
            We encountered an error while communicating with the server.
          </p>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
              Error Details
            </summary>
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
              {this.state.error?.toString()}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## 🎯 Multi-Exam Components

### Exam Provider Selector

```tsx
// src/components/exam/ExamProviderSelector.tsx
import React, { useEffect } from 'react'
import { useExamProviders } from '../../hooks/useExamProviders'
import { ExamProvider } from '../../services/api/providerService'
import { LoadingSpinner } from '../common/LoadingSpinner'

interface ExamProviderSelectorProps {
  onProviderSelect: (provider: ExamProvider) => void
  selectedProviderId?: string
}

export const ExamProviderSelector: React.FC<ExamProviderSelectorProps> = ({
  onProviderSelect,
  selectedProviderId
}) => {
  const { providers, isLoading, error, clearError } = useExamProviders()

  useEffect(() => {
    if (error) {
      console.error('Error loading providers:', error)
    }
  }, [error])

  if (isLoading) {
    return <LoadingSpinner message="Loading exam providers..." />
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="text-red-600">Failed to load exam providers: {error}</p>
        <button 
          onClick={clearError}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="provider-selector">
      <h2 className="text-2xl font-bold mb-6">Choose Your Certification Provider</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isSelected={selectedProviderId === provider.id}
            onSelect={() => onProviderSelect(provider)}
          />
        ))}
      </div>
    </div>
  )
}

interface ProviderCardProps {
  provider: ExamProvider
  isSelected: boolean
  onSelect: () => void
}

const ProviderCard: React.FC<ProviderCardProps> = ({ 
  provider, 
  isSelected, 
  onSelect 
}) => {
  const providerThemes = {
    aws: 'border-orange-400 bg-orange-50 text-orange-900',
    azure: 'border-blue-400 bg-blue-50 text-blue-900',
    gcp: 'border-green-400 bg-green-50 text-green-900',
    comptia: 'border-red-400 bg-red-50 text-red-900',
    cisco: 'border-indigo-400 bg-indigo-50 text-indigo-900'
  }

  const themeClass = providerThemes[provider.id as keyof typeof providerThemes] || 
    'border-gray-400 bg-gray-50 text-gray-900'

  return (
    <div
      className={`
        provider-card cursor-pointer p-6 rounded-lg border-2 transition-all
        ${isSelected ? `${themeClass} shadow-lg` : 'border-gray-200 hover:border-gray-300'}
      `}
      onClick={onSelect}
    >
      <div className="flex items-center mb-4">
        <img
          src={provider.logoUrl}
          alt={`${provider.name} logo`}
          className="w-12 h-12 mr-4"
        />
        <h3 className="text-lg font-semibold">{provider.name}</h3>
      </div>
      <p className="text-sm mb-3">{provider.description}</p>
      <div className="flex justify-between items-center text-sm">
        <span>{provider.examCount} exams available</span>
        <span className={`px-2 py-1 rounded-full text-xs ${
          provider.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {provider.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )
}
```

### Universal Question Display Component

```tsx
// src/components/study/UniversalQuestionCard.tsx
import React, { useState, useEffect } from 'react'
import { Question } from '../../services/api/questionService'
import { ExamProvider } from '../../services/api/providerService'

interface UniversalQuestionCardProps {
  question: Question
  onAnswer: (selectedOptions: string[]) => void
  showFeedback?: boolean
  isAnswered?: boolean
  userAnswers?: string[]
  examProvider?: ExamProvider
}

export const UniversalQuestionCard: React.FC<UniversalQuestionCardProps> = ({
  question,
  onAnswer,
  showFeedback = false,
  isAnswered = false,
  userAnswers = [],
  examProvider
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(userAnswers)
  const [hasSubmitted, setHasSubmitted] = useState(isAnswered)

  // Provider-specific styling
  const getProviderTheme = () => {
    if (!examProvider) return 'border-gray-200'
    
    const themes = {
      aws: 'border-orange-200 focus-within:border-orange-400',
      azure: 'border-blue-200 focus-within:border-blue-400',
      gcp: 'border-green-200 focus-within:border-green-400',
      comptia: 'border-red-200 focus-within:border-red-400',
      cisco: 'border-indigo-200 focus-within:border-indigo-400'
    }
    
    return themes[examProvider.id as keyof typeof themes] || 'border-gray-200'
  }

  const handleOptionToggle = (optionId: string) => {
    if (hasSubmitted) return

    let newSelection: string[]
    
    if (question.questionType === 'single_choice' || question.questionType === 'true_false') {
      newSelection = [optionId]
    } else {
      // Multiple choice
      newSelection = selectedOptions.includes(optionId)
        ? selectedOptions.filter(id => id !== optionId)
        : [...selectedOptions, optionId]
    }

    setSelectedOptions(newSelection)
  }

  const handleSubmit = () => {
    if (selectedOptions.length === 0) return
    
    setHasSubmitted(true)
    onAnswer(selectedOptions)
  }

  const getOptionFeedback = (option: any) => {
    if (!showFeedback || !hasSubmitted) return null

    const isSelected = selectedOptions.includes(option.id)
    const isCorrect = option.isCorrect
    
    if (isSelected && isCorrect) {
      return 'bg-green-100 border-green-500 text-green-800'
    } else if (isSelected && !isCorrect) {
      return 'bg-red-100 border-red-500 text-red-800'
    } else if (!isSelected && isCorrect) {
      return 'bg-yellow-100 border-yellow-500 text-yellow-800'
    }
    return null
  }

  return (
    <div className={`question-card border-2 rounded-lg p-6 ${getProviderTheme()}`}>
      {/* Provider and Exam Info */}
      {examProvider && (
        <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
          <div className="flex items-center">
            <img
              src={examProvider.logoUrl}
              alt={examProvider.name}
              className="w-5 h-5 mr-2"
            />
            <span>{examProvider.name}</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
              {question.topic}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${
              question.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
              question.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {question.difficulty}
            </span>
          </div>
        </div>
      )}

      {/* Question */}
      <div className="question-header mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Question {question.questionNumber}
        </h3>
        <p className="text-gray-800 leading-relaxed">
          {question.questionText}
        </p>
        
        {/* Question Type Indicator */}
        <div className="mt-3 text-sm text-gray-500">
          {question.questionType === 'single_choice' && '(Select one answer)'}
          {question.questionType === 'multiple_choice' && '(Select all that apply)'}
          {question.questionType === 'true_false' && '(Select true or false)'}
        </div>
      </div>

      {/* Options */}
      <div className="options-container space-y-3 mb-6">
        {question.options.map((option) => {
          const isSelected = selectedOptions.includes(option.id)
          const feedbackClass = getOptionFeedback(option)
          
          return (
            <label
              key={option.id}
              className={`
                option-label flex items-start p-4 border-2 rounded-lg cursor-pointer 
                transition-colors duration-200
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                ${feedbackClass || ''}
                ${hasSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <input
                type={question.questionType === 'single_choice' ? 'radio' : 'checkbox'}
                name={`question-${question.id}`}
                value={option.id}
                checked={isSelected}
                onChange={() => handleOptionToggle(option.id)}
                disabled={hasSubmitted}
                className="mt-1 mr-3"
              />
              <span className="flex-1">{option.text}</span>
              
              {/* Feedback Icons */}
              {showFeedback && hasSubmitted && (
                <div className="ml-2">
                  {option.isCorrect && (
                    <span className="text-green-600">✓</span>
                  )}
                  {!option.isCorrect && selectedOptions.includes(option.id) && (
                    <span className="text-red-600">✗</span>
                  )}
                </div>
              )}
            </label>
          )
        })}
      </div>

      {/* Submit Button */}
      {!hasSubmitted && (
        <button
          onClick={handleSubmit}
          disabled={selectedOptions.length === 0}
          className="submit-button w-full py-3 px-6 bg-blue-600 text-white font-semibold 
                     rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                     transition-colors duration-200"
        >
          Submit Answer
        </button>
      )}

      {/* Explanation */}
      {showFeedback && hasSubmitted && question.explanation && (
        <div className="explanation mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-2">Explanation:</h4>
          <p className="text-gray-700 mb-3">{question.explanation}</p>
          
          {/* Reference Links */}
          {question.references && question.references.length > 0 && (
            <div>
              <h5 className="font-medium mb-2">References:</h5>
              <ul className="space-y-1">
                {question.references.map((ref, index) => (
                  <li key={index}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      {ref.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### Cross-Provider Analytics Dashboard

```tsx
// src/components/analytics/CrossProviderDashboard.tsx
import React, { useEffect, useState } from 'react'
import { analyticsService, UserAnalytics } from '../../services/api/analyticsService'
import { LoadingSpinner } from '../common/LoadingSpinner'

export const CrossProviderDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      const data = await analyticsService.getProgress()
      setAnalytics(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading your progress..." />
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="text-red-600">Error: {error}</p>
        <button onClick={loadAnalytics} className="btn btn-primary mt-4">
          Retry
        </button>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div className="analytics-dashboard space-y-8">
      {/* Overall Progress */}
      <OverallProgressCard progress={analytics.overallProgress} />

      {/* Provider Progress */}
      <div className="provider-progress">
        <h2 className="text-2xl font-bold mb-6">Progress by Provider</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics.providerProgress.map((provider) => (
            <ProviderProgressCard key={provider.providerId} progress={provider} />
          ))}
        </div>
      </div>

      {/* Cross-Provider Insights */}
      <CrossProviderInsights insights={analytics.crossProviderInsights} />
    </div>
  )
}

// Overall Progress Card Component
const OverallProgressCard: React.FC<{ progress: any }> = ({ progress }) => (
  <div className="overall-progress bg-white rounded-lg shadow-md p-6">
    <h2 className="text-2xl font-bold mb-4">Overall Progress</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="metric">
        <div className="text-3xl font-bold text-blue-600">{progress.totalSessions}</div>
        <div className="text-sm text-gray-600">Total Sessions</div>
      </div>
      <div className="metric">
        <div className="text-3xl font-bold text-green-600">{progress.totalQuestionsAnswered}</div>
        <div className="text-sm text-gray-600">Questions Answered</div>
      </div>
      <div className="metric">
        <div className="text-3xl font-bold text-purple-600">{progress.overallAccuracy}%</div>
        <div className="text-sm text-gray-600">Overall Accuracy</div>
      </div>
      <div className="metric">
        <div className="text-3xl font-bold text-orange-600">{progress.studyTimeHours}h</div>
        <div className="text-sm text-gray-600">Study Time</div>
      </div>
    </div>
    
    <div className="mt-6 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">Active Providers:</span>
        {progress.activeProviders.map((provider: string) => (
          <span key={provider} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
            {provider.toUpperCase()}
          </span>
        ))}
      </div>
      
      <div className="flex items-center">
        <span className={`px-3 py-1 rounded-full text-sm ${
          progress.improvementTrend === 'positive' 
            ? 'bg-green-100 text-green-800' 
            : progress.improvementTrend === 'negative'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {progress.improvementTrend === 'positive' ? '📈' : 
           progress.improvementTrend === 'negative' ? '📉' : '➡️'} 
          {progress.improvementTrend}
        </span>
      </div>
    </div>
  </div>
)

// Provider Progress Card Component
const ProviderProgressCard: React.FC<{ progress: any }> = ({ progress }) => {
  const providerColors = {
    aws: 'border-orange-200 bg-orange-50',
    azure: 'border-blue-200 bg-blue-50',
    gcp: 'border-green-200 bg-green-50',
    comptia: 'border-red-200 bg-red-50',
    cisco: 'border-indigo-200 bg-indigo-50'
  }

  const colorClass = providerColors[progress.providerId as keyof typeof providerColors] || 
                    'border-gray-200 bg-gray-50'

  return (
    <div className={`provider-card border-2 rounded-lg p-6 ${colorClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{progress.providerName}</h3>
        <div className="text-2xl font-bold text-gray-800">
          {progress.accuracy}%
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>Sessions:</span>
          <span className="font-medium">{progress.sessions}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Questions:</span>
          <span className="font-medium">{progress.questionsAnswered}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Study Time:</span>
          <span className="font-medium">{progress.studyTimeHours}h</span>
        </div>
      </div>

      {/* Topic Progress */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Topic Mastery</h4>
        <div className="space-y-2">
          {progress.topicProgress.slice(0, 3).map((topic: any) => (
            <div key={topic.topic} className="flex items-center justify-between text-sm">
              <span>{topic.topic}</span>
              <div className="flex items-center">
                <span className="mr-2">{topic.accuracy}%</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  topic.masteryLevel === 'expert' ? 'bg-green-100 text-green-800' :
                  topic.masteryLevel === 'proficient' ? 'bg-blue-100 text-blue-800' :
                  topic.masteryLevel === 'developing' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {topic.masteryLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Cross-Provider Insights Component
const CrossProviderInsights: React.FC<{ insights: any }> = ({ insights }) => (
  <div className="cross-provider-insights bg-white rounded-lg shadow-md p-6">
    <h2 className="text-2xl font-bold mb-6">Cross-Provider Insights</h2>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Transferable Skills */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Transferable Skills</h3>
        <div className="flex flex-wrap gap-2">
          {insights.transferableSkills.map((skill: string) => (
            <span key={skill} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Recommended Next Steps */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recommended Next Steps</h3>
        <ul className="space-y-2">
          {insights.recommendedNextSteps.map((step: string, index: number) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center justify-center mr-2 mt-0.5">
                {index + 1}
              </span>
              <span className="text-sm text-gray-700">{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    {/* Concept Mapping */}
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Concept Mapping Across Providers</h3>
      <div className="space-y-4">
        {insights.conceptMapping.slice(0, 3).map((mapping: any) => (
          <div key={mapping.concept} className="concept-mapping border rounded-lg p-4">
            <h4 className="font-medium mb-2">{mapping.concept}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(mapping.providerTerms).map(([provider, term]) => (
                <div key={provider} className="provider-term">
                  <div className="text-xs text-gray-500 uppercase">{provider}</div>
                  <div className="font-medium">{term as string}</div>
                  {mapping.userProficiency[provider] !== null && (
                    <div className="text-sm text-gray-600">
                      Proficiency: {mapping.userProficiency[provider]}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)
```

### Study Session Creation Form

```tsx
// src/components/study/SessionCreationForm.tsx
import React, { useState } from 'react'
import { useExamStore } from '../../store/examStore'
import { useStudySession } from '../../hooks/useStudySession'

interface SessionCreationFormProps {
  onSessionCreated: (sessionId: string) => void
  onCancel: () => void
}

export const SessionCreationForm: React.FC<SessionCreationFormProps> = ({
  onSessionCreated,
  onCancel
}) => {
  const { selectedProvider, currentExam } = useExamStore()
  const { createSession, isLoading } = useStudySession()
  
  const [config, setConfig] = useState({
    sessionType: 'practice' as 'practice' | 'exam' | 'review',
    questionCount: 20,
    timeLimit: null as number | null,
    topics: [] as string[],
    difficulty: 'mixed' as 'beginner' | 'intermediate' | 'advanced' | 'mixed',
    showFeedback: true,
    allowSkip: true,
    randomizeQuestions: true,
    randomizeOptions: true
  })

  const [isCrossProvider, setIsCrossProvider] = useState(false)
  const [crossProviderConfig, setCrossProviderConfig] = useState({
    providers: [] as string[],
    focusTopics: [] as string[],
    questionsPerProvider: 5
  })

  const sessionTypes = [
    { value: 'practice', label: 'Practice Mode', description: 'Immediate feedback after each question' },
    { value: 'exam', label: 'Exam Simulation', description: 'No feedback until completion' },
    { value: 'review', label: 'Review Mode', description: 'Focus on previously answered questions' }
  ]

  const availableTopics = currentExam?.topicBreakdown?.map((topic: any) => topic.topic) || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (isCrossProvider) {
        // Create cross-provider session
        const session = await createCrossProviderSession()
        onSessionCreated(session.sessionId)
      } else {
        // Create regular session
        if (!currentExam) return
        
        await createSession(currentExam.id, config.sessionType, config)
        // Session ID will be available in the store after creation
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const createCrossProviderSession = async () => {
    // This would call a cross-provider session creation API
    // Implementation depends on your backend API design
    return { sessionId: 'temp-id' } // Placeholder
  }

  return (
    <form onSubmit={handleSubmit} className="session-form bg-white rounded-lg shadow-md p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Create Study Session</h2>

      {/* Current Provider/Exam Info */}
      {selectedProvider && currentExam && !isCrossProvider && (
        <div className="provider-info mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <img src={selectedProvider.logoUrl} alt={selectedProvider.name} className="w-8 h-8 mr-3" />
            <div>
              <h3 className="font-semibold">{currentExam.title}</h3>
              <p className="text-sm text-gray-600">{selectedProvider.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Provider Toggle */}
      <div className="cross-provider-toggle mb-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isCrossProvider}
            onChange={(e) => setIsCrossProvider(e.target.checked)}
            className="mr-3"
          />
          <span>Cross-Provider Study Session</span>
        </label>
        <p className="text-sm text-gray-600 mt-1">
          Compare concepts across multiple certification providers
        </p>
      </div>

      {/* Cross-Provider Configuration */}
      {isCrossProvider && (
        <div className="cross-provider-config mb-6 p-4 border-2 border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-3">Cross-Provider Configuration</h3>
          {/* Implementation for cross-provider settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Providers</label>
              {/* Provider checkboxes */}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Focus Topics</label>
              {/* Topic selection */}
            </div>
          </div>
        </div>
      )}

      {/* Session Type */}
      <div className="session-type mb-6">
        <label className="block text-sm font-medium mb-3">Session Type</label>
        <div className="space-y-3">
          {sessionTypes.map((type) => (
            <label key={type.value} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="sessionType"
                value={type.value}
                checked={config.sessionType === type.value}
                onChange={(e) => setConfig({ ...config, sessionType: e.target.value as any })}
                className="mr-3 mt-1"
              />
              <div>
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-gray-600">{type.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Question Count */}
      <div className="question-count mb-6">
        <label className="block text-sm font-medium mb-2">Number of Questions</label>
        <input
          type="number"
          min="5"
          max="100"
          value={config.questionCount}
          onChange={(e) => setConfig({ ...config, questionCount: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Time Limit */}
      <div className="time-limit mb-6">
        <label className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={config.timeLimit !== null}
            onChange={(e) => setConfig({ 
              ...config, 
              timeLimit: e.target.checked ? 1200 : null 
            })}
            className="mr-2"
          />
          <span className="text-sm font-medium">Set Time Limit</span>
        </label>
        {config.timeLimit !== null && (
          <input
            type="number"
            min="300"
            max="7200"
            step="300"
            value={config.timeLimit}
            onChange={(e) => setConfig({ ...config, timeLimit: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Time limit in seconds"
          />
        )}
      </div>

      {/* Topics Selection */}
      {availableTopics.length > 0 && (
        <div className="topics mb-6">
          <label className="block text-sm font-medium mb-3">Topics (leave empty for all)</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {availableTopics.map((topic) => (
              <label key={topic} className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.topics.includes(topic)}
                  onChange={(e) => {
                    const newTopics = e.target.checked
                      ? [...config.topics, topic]
                      : config.topics.filter(t => t !== topic)
                    setConfig({ ...config, topics: newTopics })
                  }}
                  className="mr-2"
                />
                <span className="text-sm">{topic}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Additional Options */}
      <div className="additional-options mb-6">
        <h3 className="text-sm font-medium mb-3">Additional Options</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.showFeedback}
              onChange={(e) => setConfig({ ...config, showFeedback: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Show immediate feedback</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.allowSkip}
              onChange={(e) => setConfig({ ...config, allowSkip: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Allow question skipping</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.randomizeQuestions}
              onChange={(e) => setConfig({ ...config, randomizeQuestions: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Randomize question order</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.randomizeOptions}
              onChange={(e) => setConfig({ ...config, randomizeOptions: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Randomize answer options</span>
          </label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || (!currentExam && !isCrossProvider)}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? 'Creating...' : 'Start Study Session'}
        </button>
      </div>
    </form>
  )
}
```

## 🎯 Advanced Patterns

### Provider-Aware Service Hook

```tsx
// src/hooks/useProviderService.ts
import { useMemo } from 'react'
import { ExamProvider } from '../services/api/providerService'

export const useProviderService = (provider: ExamProvider | null) => {
  return useMemo(() => {
    if (!provider) return null

    return {
      getThemeColors: () => {
        const themes = {
          aws: { primary: '#FF9900', secondary: '#232F3E', accent: '#FF9900' },
          azure: { primary: '#0078D4', secondary: '#005A9F', accent: '#40E0D0' },
          gcp: { primary: '#4285F4', secondary: '#34A853', accent: '#EA4335' },
          comptia: { primary: '#C5282F', secondary: '#0C2D83', accent: '#F7941E' },
          cisco: { primary: '#1BA0D7', secondary: '#005073', accent: '#58C4DC' }
        }
        return themes[provider.id as keyof typeof themes] || themes.aws
      },

      getDocumentationUrl: (topic: string) => {
        const baseUrls = {
          aws: 'https://docs.aws.amazon.com',
          azure: 'https://docs.microsoft.com/azure',
          gcp: 'https://cloud.google.com/docs',
          comptia: 'https://www.comptia.org/training',
          cisco: 'https://www.cisco.com/c/en/us/training-events'
        }
        const baseUrl = baseUrls[provider.id as keyof typeof baseUrls]
        return `${baseUrl}/${topic.toLowerCase()}`
      },

      getExamSpecificSettings: () => {
        const settings = {
          aws: { 
            allowReview: true, 
            showTimer: true, 
            markForReview: true,
            calculatorAllowed: false
          },
          azure: { 
            allowReview: true, 
            showTimer: true, 
            markForReview: true,
            calculatorAllowed: false
          },
          gcp: { 
            allowReview: false, 
            showTimer: true, 
            markForReview: false,
            calculatorAllowed: true
          },
          comptia: { 
            allowReview: false, 
            showTimer: true, 
            markForReview: false,
            calculatorAllowed: false
          },
          cisco: { 
            allowReview: true, 
            showTimer: true, 
            markForReview: true,
            calculatorAllowed: true
          }
        }
        return settings[provider.id as keyof typeof settings] || settings.aws
      }
    }
  }, [provider])
}
```

### Multi-Exam Search Component

```tsx
// src/components/search/MultiExamSearch.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '../../hooks/useDebounce'

interface SearchResult {
  questions: any[]
  exams: any[]
  topics: any[]
  suggestions: string[]
}

interface MultiExamSearchProps {
  onResultSelect: (result: any, type: string) => void
  providers?: string[]
}

export const MultiExamSearch: React.FC<MultiExamSearchProps> = ({ 
  onResultSelect,
  providers = []
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery)
    } else {
      setResults(null)
      setIsOpen(false)
    }
  }, [debouncedQuery, providers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/v1/search?q=${encodeURIComponent(searchQuery)}&providers=${providers.join(',')}`
      )
      const data = await response.json()
      setResults(data.data.results)
      setIsOpen(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResultClick = (result: any, type: string) => {
    onResultSelect(result, type)
    setQuery('')
    setIsOpen(false)
  }

  const getProviderColor = (providerId: string) => {
    const colors = {
      aws: 'text-orange-600 bg-orange-100',
      azure: 'text-blue-600 bg-blue-100',
      gcp: 'text-green-600 bg-green-100',
      comptia: 'text-red-600 bg-red-100',
      cisco: 'text-indigo-600 bg-indigo-100'
    }
    return colors[providerId as keyof typeof colors] || 'text-gray-600 bg-gray-100'
  }

  return (
    <div ref={searchRef} className="multi-exam-search relative">
      <div className="search-input-container relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions, exams, and topics across all providers..."
          className="w-full px-4 py-3 pl-10 pr-4 border-2 border-gray-300 rounded-lg 
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-200 
                     text-lg placeholder-gray-500"
        />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        
        {/* Selected Providers Filter */}
        {providers.length > 0 && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-1">
            {providers.map(provider => (
              <span key={provider} className={`px-2 py-1 rounded text-xs ${getProviderColor(provider)}`}>
                {provider.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results && (
        <div className="search-results absolute top-full left-0 right-0 mt-2 bg-white 
                       border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          
          {/* Questions */}
          {results.questions.length > 0 && (
            <div className="result-section">
              <div className="section-header px-4 py-2 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Questions</h3>
              </div>
              {results.questions.slice(0, 5).map((question) => (
                <div
                  key={question.id}
                  onClick={() => handleResultClick(question, 'question')}
                  className="result-item px-4 py-3 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 line-clamp-2">
                        {question.questionText}
                      </p>
                      <div className="flex items-center mt-1 space-x-2 text-xs text-gray-500">
                        <span className={`px-2 py-1 rounded ${getProviderColor(question.providerId)}`}>
                          {question.providerId.toUpperCase()}
                        </span>
                        <span>{question.topic}</span>
                      </div>
                    </div>
                    <div className="ml-2 text-xs text-gray-400">
                      {question.relevanceScore}% match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Exams */}
          {results.exams.length > 0 && (
            <div className="result-section">
              <div className="section-header px-4 py-2 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Exams</h3>
              </div>
              {results.exams.slice(0, 3).map((exam) => (
                <div
                  key={exam.id}
                  onClick={() => handleResultClick(exam, 'exam')}
                  className="result-item px-4 py-3 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{exam.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{exam.description}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {exam.relevanceScore}% match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Topics */}
          {results.topics.length > 0 && (
            <div className="result-section">
              <div className="section-header px-4 py-2 bg-gray-50 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Topics</h3>
              </div>
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {results.topics.slice(0, 8).map((topic) => (
                    <button
                      key={`${topic.provider}-${topic.name}`}
                      onClick={() => handleResultClick(topic, 'topic')}
                      className={`px-3 py-1 rounded-full text-xs hover:opacity-75 ${getProviderColor(topic.provider)}`}
                    >
                      {topic.name} ({topic.questionCount})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {results.suggestions.length > 0 && (
            <div className="suggestions px-4 py-3 border-t">
              <div className="text-xs text-gray-600 mb-2">Suggestions:</div>
              <div className="flex flex-wrap gap-2">
                {results.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {results.questions.length === 0 && results.exams.length === 0 && results.topics.length === 0 && (
            <div className="no-results px-4 py-8 text-center text-gray-500">
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords or check your spelling</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

This comprehensive code examples document provides practical, production-ready components and patterns for building a robust multi-exam certification study platform. The examples demonstrate proper TypeScript usage, responsive design, accessibility considerations, and scalable architecture patterns.