# Code Examples - Multi-Exam Certification Study Platform Backend

## 📝 Overview

This document provides comprehensive code examples for implementing the multi-exam certification study platform backend. All examples focus on local JSON file processing, provider-agnostic design, and efficient data management without external API dependencies.

## 🔧 File System Services

### **JSON File Reading Service**

```typescript
// src/services/data/FileSystemService.ts
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '@/utils/logger'
import { QuestionSet, ExamMetadata, ProviderMetadata } from '@/types'
import { ValidationError, NotFoundError } from '@/utils/errors'

export class FileSystemService {
  private readonly dataPath: string
  private readonly fileCache = new Map<string, any>()
  private readonly cacheTimeout = 300000 // 5 minutes

  constructor(dataPath: string = './data/providers') {
    this.dataPath = path.resolve(dataPath)
  }

  async loadQuestionSet(provider: string, examCode: string): Promise<QuestionSet> {
    const cacheKey = `questions:${provider}:${examCode}`
    
    // Check cache first
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      logger.debug(`Cache hit for questions: ${cacheKey}`)
      return cached
    }

    const questionsPath = path.join(this.dataPath, provider, examCode, 'questions.json')
    
    // Validate file path security
    if (!this.isValidPath(questionsPath)) {
      throw new ValidationError(`Invalid file path: ${questionsPath}`)
    }

    try {
      const rawData = await fs.readFile(questionsPath, 'utf-8')
      const questionSet: QuestionSet = JSON.parse(rawData)
      
      // Validate data structure
      await this.validateQuestionSet(questionSet)
      
      // Cache the data
      this.setCachedData(cacheKey, questionSet)
      
      logger.info(`Loaded ${questionSet.questions.length} questions for ${provider}:${examCode}`)
      return questionSet
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError(`Question file not found: ${provider}/${examCode}`)
      }
      throw new ValidationError(`Failed to load questions: ${error.message}`)
    }
  }

  async loadExamMetadata(provider: string, examCode: string): Promise<ExamMetadata> {
    const metadataPath = path.join(this.dataPath, provider, examCode, 'metadata.json')
    
    if (!this.isValidPath(metadataPath)) {
      throw new ValidationError(`Invalid metadata path: ${metadataPath}`)
    }

    try {
      const rawData = await fs.readFile(metadataPath, 'utf-8')
      const metadata: ExamMetadata = JSON.parse(rawData)
      
      return {
        ...metadata,
        provider,
        examCode,
        loadedAt: new Date().toISOString()
      }
    } catch (error) {
      throw new NotFoundError(`Exam metadata not found: ${provider}/${examCode}`)
    }
  }

  async loadProviderMetadata(provider: string): Promise<ProviderMetadata> {
    const metadataPath = path.join(this.dataPath, provider, 'metadata.json')
    
    try {
      const rawData = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(rawData)
    } catch (error) {
      throw new NotFoundError(`Provider metadata not found: ${provider}`)
    }
  }

  async getAllProviders(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.dataPath, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    } catch (error) {
      throw new ValidationError(`Failed to read providers directory: ${error.message}`)
    }
  }

  async getProviderExams(provider: string): Promise<string[]> {
    const providerPath = path.join(this.dataPath, provider)
    
    try {
      const entries = await fs.readdir(providerPath, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    } catch (error) {
      throw new NotFoundError(`Provider directory not found: ${provider}`)
    }
  }

  private isValidPath(filePath: string): boolean {
    const resolved = path.resolve(filePath)
    const relative = path.relative(this.dataPath, resolved)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
  }

  private getCachedData(key: string): any | null {
    const cached = this.fileCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    this.fileCache.delete(key)
    return null
  }

  private setCachedData(key: string, data: any): void {
    this.fileCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private async validateQuestionSet(questionSet: QuestionSet): Promise<void> {
    if (!questionSet.questions || !Array.isArray(questionSet.questions)) {
      throw new ValidationError('Invalid question set: missing questions array')
    }
    
    if (!questionSet.exam || !questionSet.provider) {
      throw new ValidationError('Invalid question set: missing exam or provider')
    }

    // Validate each question structure
    for (const question of questionSet.questions) {
      if (!question.id || !question.questionText || !question.options) {
        throw new ValidationError(`Invalid question structure: ${question.id}`)
      }
    }
  }
}
```

### **Provider Service Implementation**

```typescript
// src/services/data/ProviderService.ts
import { FileSystemService } from './FileSystemService'
import { CacheService } from '@/services/cache/CacheService'
import { ExamProvider, Exam, ProviderStats } from '@/types'
import { logger } from '@/utils/logger'

export class ProviderService {
  constructor(
    private fileSystemService: FileSystemService,
    private cacheService: CacheService
  ) {}

  async getAllProviders(): Promise<ExamProvider[]> {
    const cacheKey = 'providers:all'
    
    // Check cache first
    const cached = await this.cacheService.get<ExamProvider[]>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const providerIds = await this.fileSystemService.getAllProviders()
      
      const providers = await Promise.all(
        providerIds.map(async (providerId) => {
          try {
            const metadata = await this.fileSystemService.loadProviderMetadata(providerId)
            const exams = await this.getProviderExams(providerId)
            
            return {
              id: providerId,
              name: metadata.name,
              description: metadata.description,
              logoUrl: metadata.logoUrl || '',
              website: metadata.website || '',
              documentationUrl: metadata.documentationUrl || '',
              isActive: metadata.isActive !== false,
              examCount: exams.length,
              supportedCertifications: exams.map(exam => exam.code),
              categories: metadata.categories || [],
              createdAt: metadata.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          } catch (error) {
            logger.warn(`Failed to load provider metadata for ${providerId}:`, error.message)
            return null
          }
        })
      )

      const validProviders = providers.filter(provider => provider !== null)
      
      // Cache the results
      await this.cacheService.set(cacheKey, validProviders, 1800) // 30 minutes
      
      return validProviders
    } catch (error) {
      logger.error('Failed to load providers:', error)
      throw error
    }
  }

  async getProvider(providerId: string): Promise<ExamProvider | null> {
    try {
      const metadata = await this.fileSystemService.loadProviderMetadata(providerId)
      const exams = await this.getProviderExams(providerId)
      const stats = await this.getProviderStats(providerId)

      return {
        id: providerId,
        name: metadata.name,
        description: metadata.description,
        logoUrl: metadata.logoUrl || '',
        website: metadata.website || '',
        documentationUrl: metadata.documentationUrl || '',
        isActive: metadata.isActive !== false,
        examCount: exams.length,
        supportedCertifications: exams.map(exam => exam.code),
        categories: metadata.categories || [],
        stats,
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.error(`Failed to get provider ${providerId}:`, error)
      return null
    }
  }

  async getProviderExams(providerId: string): Promise<Exam[]> {
    const cacheKey = `provider:${providerId}:exams`
    
    const cached = await this.cacheService.get<Exam[]>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const examCodes = await this.fileSystemService.getProviderExams(providerId)
      
      const exams = await Promise.all(
        examCodes.map(async (examCode) => {
          try {
            const metadata = await this.fileSystemService.loadExamMetadata(providerId, examCode)
            const questionSet = await this.fileSystemService.loadQuestionSet(providerId, examCode)
            
            return {
              id: `${providerId}-${examCode}`,
              providerId,
              providerName: metadata.providerName || providerId.toUpperCase(),
              code: examCode,
              title: metadata.title,
              description: metadata.description,
              level: metadata.level || 'intermediate',
              duration: metadata.duration || 120,
              questionCount: questionSet.questions.length,
              passingScore: metadata.passingScore || 70,
              categories: metadata.categories || [],
              prerequisites: metadata.prerequisites || [],
              isActive: metadata.isActive !== false,
              createdAt: metadata.createdAt || new Date().toISOString(),
              updatedAt: metadata.updatedAt || new Date().toISOString()
            }
          } catch (error) {
            logger.warn(`Failed to load exam metadata for ${providerId}:${examCode}:`, error.message)
            return null
          }
        })
      )

      const validExams = exams.filter(exam => exam !== null)
      
      // Cache the results
      await this.cacheService.set(cacheKey, validExams, 1800)
      
      return validExams
    } catch (error) {
      logger.error(`Failed to get exams for provider ${providerId}:`, error)
      return []
    }
  }

  private async getProviderStats(providerId: string): Promise<ProviderStats> {
    // This would typically aggregate from user session data
    return {
      totalQuestions: 0,
      averageDifficulty: 'intermediate',
      completionRate: 0,
      averageScore: 0,
      popularExams: []
    }
  }
}
```

## 🎮 Study Session Management

### **Study Session Service**

```typescript
// src/services/sessions/StudySessionService.ts
import { v4 as uuidv4 } from 'uuid'
import { QuestionService } from '@/services/data/QuestionService'
import { UserService } from '@/services/auth/UserService'
import { CacheService } from '@/services/cache/CacheService'
import { StudySessionRepository } from '@/repositories/sessions/StudySessionRepository'
import { 
  StudySession, 
  SessionConfig, 
  SessionType, 
  Question, 
  SessionProgress,
  AnswerSubmission,
  AnswerResult 
} from '@/types'
import { logger } from '@/utils/logger'
import { ValidationError, NotFoundError } from '@/utils/errors'

export class StudySessionService {
  constructor(
    private questionService: QuestionService,
    private userService: UserService,
    private cacheService: CacheService,
    private sessionRepository: StudySessionRepository
  ) {}

  async createSession(
    userId: string,
    examId: string,
    sessionType: SessionType,
    config: Partial<SessionConfig>
  ): Promise<StudySession> {
    // Validate user exists
    const user = await this.userService.getUserById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Parse exam ID to get provider and exam code
    const [providerId, examCode] = examId.split('-', 2)
    if (!providerId || !examCode) {
      throw new ValidationError('Invalid exam ID format')
    }

    // Load questions for the session
    const questions = await this.questionService.getSessionQuestions(
      providerId,
      examCode,
      config
    )

    if (questions.length === 0) {
      throw new ValidationError('No questions available for the specified criteria')
    }

    const sessionId = uuidv4()
    const session: StudySession = {
      id: sessionId,
      userId,
      examId,
      providerId,
      examCode,
      sessionType,
      status: 'active',
      config: {
        questionCount: config.questionCount || 20,
        timeLimit: config.timeLimit,
        topics: config.topics || [],
        difficulty: config.difficulty,
        showFeedback: config.showFeedback !== false,
        allowSkip: config.allowSkip !== false,
        randomizeQuestions: config.randomizeQuestions !== false,
        randomizeOptions: config.randomizeOptions !== false
      },
      questions: questions.map((question, index) => ({
        id: question.id,
        orderIndex: index,
        isAnswered: false,
        timeSpent: 0
      })),
      progress: {
        currentQuestionIndex: 0,
        answeredQuestions: 0,
        correctAnswers: 0,
        skippedQuestions: 0,
        timeElapsed: 0,
        accuracy: 0
      },
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    }

    // Save session to database
    await this.sessionRepository.create(session)

    // Cache session for quick access
    await this.cacheSession(sessionId, session)

    // Cache questions for the session
    await this.cacheSessionQuestions(sessionId, questions)

    logger.info(`Created study session ${sessionId} for user ${userId}`)
    return session
  }

  async createCrossProviderSession(
    userId: string,
    providers: string[],
    focusTopics: string[],
    sessionType: SessionType,
    config: Partial<SessionConfig>
  ): Promise<StudySession> {
    // Validate user
    const user = await this.userService.getUserById(userId)
    if (!user) {
      throw new NotFoundError('User not found')
    }

    // Get questions from multiple providers
    const allQuestions = await this.questionService.getCrossProviderQuestions(
      providers,
      focusTopics,
      config
    )

    if (allQuestions.length === 0) {
      throw new ValidationError('No questions available for the specified providers and topics')
    }

    const sessionId = uuidv4()
    const session: StudySession = {
      id: sessionId,
      userId,
      examId: `cross-provider-${providers.join('-')}`,
      providerId: 'multi',
      examCode: 'cross-provider',
      sessionType: 'cross-provider',
      status: 'active',
      config: {
        questionCount: Math.min(config.questionCount || 30, allQuestions.length),
        timeLimit: config.timeLimit,
        topics: focusTopics,
        difficulty: config.difficulty,
        showFeedback: config.showFeedback !== false,
        allowSkip: config.allowSkip !== false,
        randomizeQuestions: config.randomizeQuestions !== false,
        randomizeOptions: config.randomizeOptions !== false
      },
      questions: allQuestions.slice(0, config.questionCount || 30).map((question, index) => ({
        id: question.id,
        orderIndex: index,
        isAnswered: false,
        timeSpent: 0,
        provider: question.provider
      })),
      progress: {
        currentQuestionIndex: 0,
        answeredQuestions: 0,
        correctAnswers: 0,
        skippedQuestions: 0,
        timeElapsed: 0,
        accuracy: 0
      },
      crossProviderData: {
        providers,
        focusTopics,
        providerDistribution: this.calculateProviderDistribution(allQuestions)
      },
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    }

    await this.sessionRepository.create(session)
    await this.cacheSession(sessionId, session)
    await this.cacheSessionQuestions(sessionId, allQuestions)

    logger.info(`Created cross-provider session ${sessionId} for user ${userId} with providers: ${providers.join(', ')}`)
    return session
  }

  async getSession(sessionId: string): Promise<StudySession | null> {
    // Try cache first
    const cached = await this.getCachedSession(sessionId)
    if (cached) {
      return cached
    }

    // Fallback to database
    const session = await this.sessionRepository.findById(sessionId)
    if (session) {
      await this.cacheSession(sessionId, session)
    }

    return session
  }

  async submitAnswer(
    sessionId: string,
    submission: AnswerSubmission
  ): Promise<AnswerResult> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new NotFoundError('Session not found')
    }

    if (session.status !== 'active') {
      throw new ValidationError('Session is not active')
    }

    // Get the current question
    const currentQuestion = session.questions.find(
      q => q.orderIndex === session.progress.currentQuestionIndex
    )

    if (!currentQuestion || currentQuestion.id !== submission.questionId) {
      throw new ValidationError('Invalid question for current session state')
    }

    // Get question details from cache
    const questions = await this.getCachedSessionQuestions(sessionId)
    const question = questions.find(q => q.id === submission.questionId)
    
    if (!question) {
      throw new NotFoundError('Question not found')
    }

    // Validate answer
    const isCorrect = this.validateAnswer(question, submission.selectedOptions)
    const correctOptions = question.options
      .filter(option => option.isCorrect)
      .map(option => option.id)

    // Update session progress
    session.progress.answeredQuestions++
    if (isCorrect) {
      session.progress.correctAnswers++
    }
    session.progress.timeElapsed += submission.timeSpent
    session.progress.accuracy = (session.progress.correctAnswers / session.progress.answeredQuestions) * 100

    // Update question status
    currentQuestion.isAnswered = true
    currentQuestion.timeSpent = submission.timeSpent

    // Move to next question
    if (session.progress.currentQuestionIndex < session.questions.length - 1) {
      session.progress.currentQuestionIndex++
    }

    // Update session in database and cache
    await this.sessionRepository.update(sessionId, session)
    await this.cacheSession(sessionId, session)

    // Prepare response
    const result: AnswerResult = {
      questionId: submission.questionId,
      isCorrect,
      selectedOptions: submission.selectedOptions,
      correctOptions,
      sessionProgress: session.progress
    }

    if (session.config.showFeedback) {
      result.feedback = {
        explanation: question.explanation,
        references: question.references || []
      }
    }

    // Include next question if available
    if (session.progress.currentQuestionIndex < session.questions.length) {
      const nextQuestion = session.questions[session.progress.currentQuestionIndex]
      const nextQuestionData = questions.find(q => q.id === nextQuestion.id)
      
      if (nextQuestionData) {
        result.nextQuestion = {
          id: nextQuestionData.id,
          questionText: nextQuestionData.questionText,
          orderIndex: nextQuestion.orderIndex
        }
      }
    }

    logger.info(`Answer submitted for session ${sessionId}, question ${submission.questionId}, correct: ${isCorrect}`)
    return result
  }

  private validateAnswer(question: Question, selectedOptions: string[]): boolean {
    const correctOptions = question.options
      .filter(option => option.isCorrect)
      .map(option => option.id)
      .sort()

    const sortedSelected = [...selectedOptions].sort()

    return correctOptions.length === sortedSelected.length &&
           correctOptions.every((option, index) => option === sortedSelected[index])
  }

  private calculateProviderDistribution(questions: Question[]): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    questions.forEach(question => {
      const provider = question.provider || 'unknown'
      distribution[provider] = (distribution[provider] || 0) + 1
    })

    return distribution
  }

  private async cacheSession(sessionId: string, session: StudySession): Promise<void> {
    await this.cacheService.set(`session:${sessionId}`, session, 7200) // 2 hours
  }

  private async getCachedSession(sessionId: string): Promise<StudySession | null> {
    return await this.cacheService.get<StudySession>(`session:${sessionId}`)
  }

  private async cacheSessionQuestions(sessionId: string, questions: Question[]): Promise<void> {
    await this.cacheService.set(`session:${sessionId}:questions`, questions, 7200)
  }

  private async getCachedSessionQuestions(sessionId: string): Promise<Question[]> {
    const questions = await this.cacheService.get<Question[]>(`session:${sessionId}:questions`)
    return questions || []
  }
}
```

## 🔍 Question Processing Service

### **Advanced Question Service**

```typescript
// src/services/data/QuestionService.ts
import { FileSystemService } from './FileSystemService'
import { CacheService } from '@/services/cache/CacheService'
import { 
  Question, 
  QuestionFilters, 
  SessionConfig, 
  QuestionDifficulty,
  PaginatedQuestions 
} from '@/types'
import { logger } from '@/utils/logger'

export class QuestionService {
  constructor(
    private fileSystemService: FileSystemService,
    private cacheService: CacheService
  ) {}

  async getQuestions(
    providerId: string,
    examCode: string,
    filters?: QuestionFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedQuestions> {
    const cacheKey = `questions:${providerId}:${examCode}:${JSON.stringify(filters)}:${page}:${limit}`
    
    // Try cache first
    const cached = await this.cacheService.get<PaginatedQuestions>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Load question set
      const questionSet = await this.fileSystemService.loadQuestionSet(providerId, examCode)
      let questions = [...questionSet.questions]

      // Apply filters
      if (filters) {
        questions = this.applyFilters(questions, filters)
      }

      // Apply pagination
      const startIndex = (page - 1) * limit
      const paginatedQuestions = questions.slice(startIndex, startIndex + limit)

      const result: PaginatedQuestions = {
        questions: paginatedQuestions,
        pagination: {
          page,
          limit,
          total: questions.length,
          totalPages: Math.ceil(questions.length / limit),
          hasNext: startIndex + limit < questions.length,
          hasPrev: page > 1
        }
      }

      // Cache the result
      await this.cacheService.set(cacheKey, result, 1800) // 30 minutes

      return result
    } catch (error) {
      logger.error(`Failed to get questions for ${providerId}:${examCode}:`, error)
      throw error
    }
  }

  async getSessionQuestions(
    providerId: string,
    examCode: string,
    config: Partial<SessionConfig>
  ): Promise<Question[]> {
    const questionSet = await this.fileSystemService.loadQuestionSet(providerId, examCode)
    let questions = [...questionSet.questions]

    // Apply topic filter if specified
    if (config.topics && config.topics.length > 0) {
      questions = questions.filter(q => 
        config.topics!.some(topic => 
          q.topic.toLowerCase().includes(topic.toLowerCase()) ||
          q.category.toLowerCase().includes(topic.toLowerCase()) ||
          q.tags.some(tag => tag.toLowerCase().includes(topic.toLowerCase()))
        )
      )
    }

    // Apply difficulty filter if specified
    if (config.difficulty && config.difficulty !== 'mixed') {
      questions = questions.filter(q => q.difficulty === config.difficulty)
    }

    // Randomize if requested
    if (config.randomizeQuestions) {
      questions = this.shuffleArray(questions)
    }

    // Limit to requested count
    const questionCount = Math.min(config.questionCount || 20, questions.length)
    questions = questions.slice(0, questionCount)

    // Randomize options if requested
    if (config.randomizeOptions) {
      questions = questions.map(question => ({
        ...question,
        options: this.shuffleArray([...question.options])
      }))
    }

    logger.info(`Selected ${questions.length} questions for session from ${providerId}:${examCode}`)
    return questions
  }

  async getCrossProviderQuestions(
    providers: string[],
    focusTopics: string[],
    config: Partial<SessionConfig>
  ): Promise<Question[]> {
    const questionsPerProvider = Math.ceil((config.questionCount || 30) / providers.length)
    const allQuestions: Question[] = []

    // Load questions from each provider
    for (const providerId of providers) {
      try {
        const exams = await this.fileSystemService.getProviderExams(providerId)
        
        for (const examCode of exams) {
          try {
            const questionSet = await this.fileSystemService.loadQuestionSet(providerId, examCode)
            let providerQuestions = questionSet.questions.map(q => ({
              ...q,
              provider: providerId,
              examCode
            }))

            // Filter by focus topics
            if (focusTopics.length > 0) {
              providerQuestions = providerQuestions.filter(q =>
                focusTopics.some(topic =>
                  q.topic.toLowerCase().includes(topic.toLowerCase()) ||
                  q.category.toLowerCase().includes(topic.toLowerCase()) ||
                  q.tags.some(tag => tag.toLowerCase().includes(topic.toLowerCase()))
                )
              )
            }

            // Add to collection (limit per provider)
            allQuestions.push(...providerQuestions.slice(0, questionsPerProvider))
            
            if (allQuestions.length >= (config.questionCount || 30)) {
              break
            }
          } catch (error) {
            logger.warn(`Failed to load questions from ${providerId}:${examCode}:`, error.message)
          }
        }
      } catch (error) {
        logger.warn(`Failed to load provider ${providerId}:`, error.message)
      }
    }

    // Shuffle for randomization
    const shuffledQuestions = this.shuffleArray(allQuestions)

    // Limit to requested count
    const finalQuestions = shuffledQuestions.slice(0, config.questionCount || 30)

    logger.info(`Selected ${finalQuestions.length} cross-provider questions from ${providers.length} providers`)
    return finalQuestions
  }

  async searchQuestions(
    query: string,
    providers?: string[],
    filters?: QuestionFilters,
    limit: number = 20
  ): Promise<Question[]> {
    const cacheKey = `search:${query}:${JSON.stringify(providers)}:${JSON.stringify(filters)}:${limit}`
    
    const cached = await this.cacheService.get<Question[]>(cacheKey)
    if (cached) {
      return cached
    }

    const allQuestions: Question[] = []
    const searchProviders = providers || await this.fileSystemService.getAllProviders()

    // Search across specified providers
    for (const providerId of searchProviders) {
      try {
        const exams = await this.fileSystemService.getProviderExams(providerId)
        
        for (const examCode of exams) {
          try {
            const questionSet = await this.fileSystemService.loadQuestionSet(providerId, examCode)
            
            // Search in question text, options, and tags
            const matchingQuestions = questionSet.questions.filter(question =>
              this.matchesSearchQuery(question, query)
            ).map(q => ({
              ...q,
              provider: providerId,
              examCode
            }))

            allQuestions.push(...matchingQuestions)
          } catch (error) {
            logger.warn(`Search failed for ${providerId}:${examCode}:`, error.message)
          }
        }
      } catch (error) {
        logger.warn(`Search failed for provider ${providerId}:`, error.message)
      }
    }

    // Apply additional filters
    let filteredQuestions = filters ? this.applyFilters(allQuestions, filters) : allQuestions

    // Sort by relevance (simple scoring)
    filteredQuestions = filteredQuestions
      .map(question => ({
        ...question,
        relevanceScore: this.calculateRelevanceScore(question, query)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    // Cache results
    await this.cacheService.set(cacheKey, filteredQuestions, 600) // 10 minutes

    logger.info(`Found ${filteredQuestions.length} questions matching query: ${query}`)
    return filteredQuestions
  }

  private applyFilters(questions: Question[], filters: QuestionFilters): Question[] {
    return questions.filter(question => {
      if (filters.category && !question.category.toLowerCase().includes(filters.category.toLowerCase())) {
        return false
      }

      if (filters.topic && !question.topic.toLowerCase().includes(filters.topic.toLowerCase())) {
        return false
      }

      if (filters.difficulty && question.difficulty !== filters.difficulty) {
        return false
      }

      if (filters.type && question.questionType !== filters.type) {
        return false
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag =>
          question.tags.some(questionTag =>
            questionTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
        if (!hasMatchingTag) {
          return false
        }
      }

      return true
    })
  }

  private matchesSearchQuery(question: Question, query: string): boolean {
    const lowerQuery = query.toLowerCase()
    
    // Search in question text
    if (question.questionText.toLowerCase().includes(lowerQuery)) {
      return true
    }

    // Search in option text
    if (question.options.some(option => 
      option.text.toLowerCase().includes(lowerQuery)
    )) {
      return true
    }

    // Search in tags
    if (question.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      return true
    }

    // Search in explanation
    if (question.explanation && question.explanation.toLowerCase().includes(lowerQuery)) {
      return true
    }

    return false
  }

  private calculateRelevanceScore(question: Question, query: string): number {
    let score = 0
    const lowerQuery = query.toLowerCase()

    // Higher score for exact matches in question text
    if (question.questionText.toLowerCase().includes(lowerQuery)) {
      score += 10
    }

    // Medium score for matches in options
    if (question.options.some(option => option.text.toLowerCase().includes(lowerQuery))) {
      score += 5
    }

    // Lower score for matches in tags
    if (question.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      score += 3
    }

    // Boost for intermediate difficulty (often most useful)
    if (question.difficulty === 'intermediate') {
      score += 2
    }

    // Boost for questions with explanations
    if (question.explanation) {
      score += 1
    }

    return score
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}
```

## 📊 Analytics Service

### **Cross-Provider Analytics Service**

```typescript
// src/services/analytics/CrossProviderAnalyticsService.ts
import { UserProgressRepository } from '@/repositories/analytics/UserProgressRepository'
import { StudySessionRepository } from '@/repositories/sessions/StudySessionRepository'
import { ProviderService } from '@/services/data/ProviderService'
import { 
  CrossProviderProgress, 
  UserAnalytics, 
  ProviderProgress,
  TransferableSkill,
  StudyRecommendation 
} from '@/types'
import { logger } from '@/utils/logger'

export class CrossProviderAnalyticsService {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private sessionRepository: StudySessionRepository,
    private providerService: ProviderService
  ) {}

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const [overallProgress, providerProgresses, crossProviderInsights] = await Promise.all([
        this.getOverallProgress(userId),
        this.getAllProviderProgresses(userId),
        this.getCrossProviderInsights(userId)
      ])

      return {
        overallProgress,
        providerProgress: providerProgresses,
        crossProviderInsights
      }
    } catch (error) {
      logger.error(`Failed to get user analytics for ${userId}:`, error)
      throw error
    }
  }

  async getProgressComparison(userId: string): Promise<CrossProviderProgress> {
    const providerProgresses = await this.getAllProviderProgresses(userId)
    
    // Identify strongest and weakest providers
    const sortedProviders = providerProgresses.sort((a, b) => b.accuracy - a.accuracy)
    const strongestProvider = sortedProviders[0]?.providerId || 'none'
    const weakestProvider = sortedProviders[sortedProviders.length - 1]?.providerId || 'none'

    // Calculate cross-provider trends
    const improvementTrend = await this.calculateImprovementTrend(userId)

    return {
      totalSessions: providerProgresses.reduce((sum, p) => sum + p.sessions, 0),
      totalQuestionsAnswered: providerProgresses.reduce((sum, p) => sum + p.questionsAnswered, 0),
      overallAccuracy: this.calculateWeightedAccuracy(providerProgresses),
      studyTimeHours: providerProgresses.reduce((sum, p) => sum + p.studyTimeHours, 0),
      activeProviders: providerProgresses.filter(p => p.sessions > 0).map(p => p.providerId),
      strongestProvider,
      weakestProvider,
      improvementTrend,
      providerBreakdown: providerProgresses.map(progress => ({
        providerId: progress.providerId,
        accuracy: progress.accuracy,
        sessions: progress.sessions,
        questionsAnswered: progress.questionsAnswered,
        rank: sortedProviders.findIndex(p => p.providerId === progress.providerId) + 1
      }))
    }
  }

  async getTransferableSkills(userId: string): Promise<TransferableSkill[]> {
    const providerProgresses = await this.getAllProviderProgresses(userId)
    const transferableSkills: TransferableSkill[] = []

    // Define common skill mappings across providers
    const skillMappings = {
      'networking': {
        aws: ['VPC', 'Route Tables', 'NAT Gateway', 'Internet Gateway'],
        azure: ['Virtual Network', 'Route Tables', 'NAT Gateway', 'VPN Gateway'],
        gcp: ['VPC', 'Routes', 'Cloud NAT', 'Cloud VPN']
      },
      'compute': {
        aws: ['EC2', 'Auto Scaling', 'ELB', 'Lambda'],
        azure: ['Virtual Machines', 'VM Scale Sets', 'Load Balancer', 'Functions'],
        gcp: ['Compute Engine', 'Instance Groups', 'Load Balancing', 'Cloud Functions']
      },
      'storage': {
        aws: ['S3', 'EBS', 'EFS', 'Glacier'],
        azure: ['Storage Account', 'Blob Storage', 'Disk Storage', 'Archive'],
        gcp: ['Cloud Storage', 'Persistent Disks', 'Filestore', 'Archive']
      },
      'database': {
        aws: ['RDS', 'DynamoDB', 'ElastiCache', 'DocumentDB'],
        azure: ['SQL Database', 'Cosmos DB', 'Cache for Redis', 'PostgreSQL'],
        gcp: ['Cloud SQL', 'Firestore', 'Memorystore', 'Bigtable']
      }
    }

    // Analyze user's proficiency in each skill area
    for (const [skillName, providerTerms] of Object.entries(skillMappings)) {
      const skillProficiency: Record<string, number> = {}
      
      for (const progress of providerProgresses) {
        const providerTermsForSkill = providerTerms[progress.providerId] || []
        
        // Calculate proficiency based on topic progress
        const relevantTopics = progress.topicProgress?.filter(topic =>
          providerTermsForSkill.some(term => 
            topic.topic.toLowerCase().includes(term.toLowerCase())
          )
        ) || []

        if (relevantTopics.length > 0) {
          const avgAccuracy = relevantTopics.reduce((sum, topic) => sum + topic.accuracy, 0) / relevantTopics.length
          skillProficiency[progress.providerId] = avgAccuracy
        }
      }

      // Only include skills where user has experience in multiple providers
      const providersWithExperience = Object.keys(skillProficiency).length
      if (providersWithExperience >= 2) {
        transferableSkills.push({
          skillName,
          description: `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} concepts and services`,
          providerTerms,
          userProficiency: skillProficiency,
          transferabilityScore: this.calculateTransferabilityScore(skillProficiency),
          recommendations: this.generateSkillRecommendations(skillName, skillProficiency)
        })
      }
    }

    return transferableSkills.sort((a, b) => b.transferabilityScore - a.transferabilityScore)
  }

  async getStudyRecommendations(userId: string): Promise<StudyRecommendation[]> {
    const [providerProgresses, transferableSkills] = await Promise.all([
      this.getAllProviderProgresses(userId),
      this.getTransferableSkills(userId)
    ])

    const recommendations: StudyRecommendation[] = []

    // Recommend providers based on transferable skills
    for (const skill of transferableSkills) {
      const strongProviders = Object.entries(skill.userProficiency)
        .filter(([_, score]) => score > 80)
        .map(([provider]) => provider)

      const weakProviders = Object.entries(skill.userProficiency)
        .filter(([_, score]) => score < 60)
        .map(([provider]) => provider)

      if (strongProviders.length > 0 && weakProviders.length > 0) {
        recommendations.push({
          type: 'skill_transfer',
          priority: 'high',
          title: `Leverage ${skill.skillName} knowledge`,
          description: `You're strong in ${skill.skillName} with ${strongProviders.join(', ')}. Apply this knowledge to improve in ${weakProviders.join(', ')}.`,
          targetProviders: weakProviders,
          estimatedImpact: 'medium',
          timeInvestment: 'low'
        })
      }
    }

    // Recommend focus areas based on weak topics
    for (const progress of providerProgresses) {
      const weakTopics = progress.topicProgress?.filter(topic => topic.accuracy < 60) || []
      
      if (weakTopics.length > 0) {
        recommendations.push({
          type: 'topic_focus',
          priority: 'medium',
          title: `Strengthen ${progress.providerId.toUpperCase()} weak areas`,
          description: `Focus on improving: ${weakTopics.slice(0, 3).map(t => t.topic).join(', ')}`,
          targetProviders: [progress.providerId],
          focusTopics: weakTopics.map(t => t.topic),
          estimatedImpact: 'high',
          timeInvestment: 'medium'
        })
      }
    }

    // Recommend new provider exploration
    const allProviders = await this.providerService.getAllProviders()
    const studiedProviders = new Set(providerProgresses.map(p => p.providerId))
    const unstudiedProviders = allProviders.filter(p => !studiedProviders.has(p.id))

    if (unstudiedProviders.length > 0 && studiedProviders.size >= 1) {
      recommendations.push({
        type: 'provider_expansion',
        priority: 'low',
        title: 'Explore new certification paths',
        description: `Consider studying ${unstudiedProviders.slice(0, 2).map(p => p.name).join(' or ')} to expand your cloud expertise.`,
        targetProviders: unstudiedProviders.slice(0, 2).map(p => p.id),
        estimatedImpact: 'high',
        timeInvestment: 'high'
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  private async getAllProviderProgresses(userId: string): Promise<ProviderProgress[]> {
    try {
      const allProviders = await this.providerService.getAllProviders()
      const progresses = await Promise.all(
        allProviders.map(provider => this.getProviderProgress(userId, provider.id))
      )
      
      return progresses.filter(progress => progress.sessions > 0)
    } catch (error) {
      logger.error(`Failed to get provider progresses for user ${userId}:`, error)
      return []
    }
  }

  private async getProviderProgress(userId: string, providerId: string): Promise<ProviderProgress> {
    const [sessions, progressRecords] = await Promise.all([
      this.sessionRepository.findByUserAndProvider(userId, providerId),
      this.userProgressRepository.findByUserAndProvider(userId, providerId)
    ])

    const questionsAnswered = progressRecords.reduce((sum, record) => sum + record.questionsAnswered, 0)
    const correctAnswers = progressRecords.reduce((sum, record) => sum + record.correctAnswers, 0)
    const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0

    const studyTimeHours = sessions.reduce((sum, session) => {
      const startTime = new Date(session.startedAt).getTime()
      const endTime = session.completedAt ? new Date(session.completedAt).getTime() : Date.now()
      return sum + (endTime - startTime) / (1000 * 60 * 60)
    }, 0)

    const topicProgress = progressRecords.map(record => ({
      topic: record.topic,
      accuracy: (record.correctAnswers / record.questionsAnswered) * 100,
      questionsAnswered: record.questionsAnswered,
      masteryLevel: this.calculateMasteryLevel(record.correctAnswers, record.questionsAnswered)
    }))

    const provider = await this.providerService.getProvider(providerId)

    return {
      providerId,
      providerName: provider?.name || providerId.toUpperCase(),
      sessions: sessions.length,
      questionsAnswered,
      accuracy: Math.round(accuracy * 100) / 100,
      studyTimeHours: Math.round(studyTimeHours * 100) / 100,
      topicProgress
    }
  }

  private calculateWeightedAccuracy(progresses: ProviderProgress[]): number {
    const totalQuestions = progresses.reduce((sum, p) => sum + p.questionsAnswered, 0)
    if (totalQuestions === 0) return 0

    const weightedSum = progresses.reduce((sum, p) => sum + (p.accuracy * p.questionsAnswered), 0)
    return Math.round((weightedSum / totalQuestions) * 100) / 100
  }

  private async calculateImprovementTrend(userId: string): Promise<'positive' | 'neutral' | 'negative'> {
    // This is a simplified implementation
    // In a real system, you'd analyze session performance over time
    return 'positive'
  }

  private calculateMasteryLevel(correctAnswers: number, totalQuestions: number): string {
    if (totalQuestions === 0) return 'novice'
    
    const accuracy = (correctAnswers / totalQuestions) * 100
    if (accuracy >= 90) return 'expert'
    if (accuracy >= 75) return 'proficient'
    if (accuracy >= 60) return 'developing'
    return 'novice'
  }

  private calculateTransferabilityScore(proficiency: Record<string, number>): number {
    const scores = Object.values(proficiency)
    if (scores.length < 2) return 0

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length
    
    // Higher average score and lower variance indicate better transferability
    return avgScore - (variance / 10)
  }

  private generateSkillRecommendations(skillName: string, proficiency: Record<string, number>): string[] {
    const recommendations: string[] = []
    const strongProviders = Object.entries(proficiency).filter(([_, score]) => score > 80)
    const weakProviders = Object.entries(proficiency).filter(([_, score]) => score < 60)

    if (strongProviders.length > 0 && weakProviders.length > 0) {
      recommendations.push(
        `Apply your strong ${skillName} knowledge from ${strongProviders[0][0]} to ${weakProviders[0][0]}`
      )
    }

    return recommendations
  }
}
```

This comprehensive set of code examples demonstrates the complete implementation of a local JSON-based multi-exam certification study platform backend, focusing on efficient file processing, provider-agnostic design, and intelligent cross-provider analytics without any external API dependencies.