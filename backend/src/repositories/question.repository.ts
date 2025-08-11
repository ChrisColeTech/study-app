// Question repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Question } from '../shared/types/question.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface QuestionFile {
  provider: string;
  exam: string;
  questions: Question[];
}

export interface IQuestionRepository {
  findByProvider(provider: string): Promise<Question[]>;
  findByExam(provider: string, exam: string): Promise<Question[]>;
  findByTopic(provider: string, exam: string, topic: string): Promise<Question[]>;
  findById(questionId: string): Promise<Question | null>;
  findByDifficulty(provider: string, exam: string, difficulty: string): Promise<Question[]>;
  searchQuestions(query: string, provider?: string, exam?: string): Promise<Question[]>;
  clearCache(): void;
}

export class QuestionRepository implements IQuestionRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private logger = createLogger({ component: 'QuestionRepository' });
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly QUESTIONS_PREFIX = 'questions/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
  }

  /**
   * Find questions by provider
   */
  async findByProvider(provider: string): Promise<Question[]> {
    const cacheKey = `questions-provider-${provider}`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider });
      return cached;
    }

    try {
      this.logger.info('Loading questions by provider from S3', { provider, bucket: this.bucketName });

      // List all question files for this provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${this.QUESTIONS_PREFIX}${provider}/`,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResult.Contents) {
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        this.logger.info('Found question files', { provider, count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          if (file.Key) {
            try {
              const questions = await this.loadQuestionFile(file.Key);
              allQuestions.push(...questions);
            } catch (error) {
              this.logger.warn('Failed to load question file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.setCache(cacheKey, allQuestions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied') {
        this.logger.warn('S3 bucket not accessible - returning empty results', { 
          provider, 
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load questions by provider from S3', error as Error, { provider });
      throw new Error('Failed to load question data');
    }
  }

  /**
   * Find questions by specific exam
   */
  async findByExam(provider: string, exam: string): Promise<Question[]> {
    const cacheKey = `questions-exam-${provider}-${exam}`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider, exam });
      return cached;
    }

    try {
      this.logger.info('Loading questions by exam from S3', { provider, exam, bucket: this.bucketName });

      const questionKey = `${this.QUESTIONS_PREFIX}${provider}/${exam}/questions.json`;
      const questions = await this.loadQuestionFile(questionKey);

      // Cache the results
      this.setCache(cacheKey, questions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        exam,
        totalQuestions: questions.length
      });

      return questions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied' || errorName === 'NoSuchKey') {
        this.logger.warn('S3 data not accessible - returning empty results', { 
          provider, 
          exam,
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load questions by exam from S3', error as Error, { provider, exam });
      throw new Error('Failed to load question data');
    }
  }

  /**
   * Find questions by topic within an exam
   */
  async findByTopic(provider: string, exam: string, topic: string): Promise<Question[]> {
    const examQuestions = await this.findByExam(provider, exam);
    return examQuestions.filter(question => question.topicId === topic);
  }

  /**
   * Find a specific question by ID
   */
  async findById(questionId: string): Promise<Question | null> {
    const cacheKey = `question-${questionId}`;
    
    // Check cache first
    const cached = this.getFromCache<Question>(cacheKey);
    if (cached) {
      this.logger.debug('Question retrieved from cache', { questionId });
      return cached;
    }

    try {
      // We need to search through all question files to find this ID
      // This is inefficient but necessary with the current S3 structure
      const allQuestions = await this.getAllQuestions();
      const question = allQuestions.find(q => q.questionId === questionId);

      if (question) {
        // Cache the result
        this.setCache(cacheKey, question);
        this.logger.debug('Question found', { questionId });
        return question;
      } else {
        this.logger.warn('Question not found', { questionId });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to find question by ID', error as Error, { questionId });
      return null;
    }
  }

  /**
   * Find questions by difficulty
   */
  async findByDifficulty(provider: string, exam: string, difficulty: string): Promise<Question[]> {
    const examQuestions = await this.findByExam(provider, exam);
    return examQuestions.filter(question => 
      question.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
  }

  /**
   * Search questions by text content with enhanced matching
   */
  async searchQuestions(query: string, provider?: string, exam?: string): Promise<Question[]> {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length >= 2); // Minimum 2 characters
    
    let questionsToSearch: Question[];
    
    if (provider && exam) {
      questionsToSearch = await this.findByExam(provider, exam);
    } else if (provider) {
      questionsToSearch = await this.findByProvider(provider);
    } else {
      // When no provider specified, search across available data
      // Start with available providers to avoid loading all data
      questionsToSearch = await this.getSearchableQuestions();
    }

    return questionsToSearch.filter(question => {
      const searchableText = [
        question.questionText,
        ...(question.options || []),
        question.explanation || '',
        ...(question.tags || []),
        question.topicId || ''
      ].join(' ').toLowerCase();

      // Enhanced search: either all terms match or at least 60% of terms match for longer queries
      const matchCount = searchTerms.filter(term => searchableText.includes(term)).length;
      const requiredMatches = searchTerms.length <= 2 ? searchTerms.length : Math.ceil(searchTerms.length * 0.6);
      
      return matchCount >= requiredMatches;
    });
  }

  /**
   * Get searchable questions efficiently (prioritize popular providers)
   */
  private async getSearchableQuestions(): Promise<Question[]> {
    const cacheKey = 'searchable-questions';
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Searchable questions retrieved from cache');
      return cached;
    }

    try {
      // Start with AWS questions (most popular), then expand if needed
      const popularProviders = ['aws', 'azure', 'gcp', 'cisco', 'comptia'];
      const allQuestions: Question[] = [];
      
      for (const provider of popularProviders) {
        try {
          const providerQuestions = await this.findByProvider(provider);
          allQuestions.push(...providerQuestions);
          
          // If we have enough questions for search, stop here for performance
          if (allQuestions.length >= 1000) {
            break;
          }
        } catch (error) {
          this.logger.warn(`Failed to load questions for provider: ${provider}`, {
            error: (error as Error).message
          });
          // Continue with other providers
        }
      }

      // Cache the results with shorter TTL for search data
      this.setCache(cacheKey, allQuestions, 10 * 60 * 1000); // 10 minutes TTL
      
      this.logger.info('Searchable questions loaded', { 
        totalQuestions: allQuestions.length,
        providers: [...new Set(allQuestions.map(q => q.providerId))]
      });

      return allQuestions;
    } catch (error) {
      this.logger.error('Failed to load searchable questions', error as Error);
      return [];
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Question cache cleared');
  }

  /**
   * Get all questions from all providers (expensive operation)
   */
  private async getAllQuestions(): Promise<Question[]> {
    const cacheKey = 'all-questions';
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('All questions retrieved from cache');
      return cached;
    }

    try {
      this.logger.info('Loading all questions from S3', { bucket: this.bucketName });

      // List all question files
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.QUESTIONS_PREFIX,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResult.Contents) {
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        this.logger.info('Found question files', { count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          if (file.Key) {
            try {
              const questions = await this.loadQuestionFile(file.Key);
              allQuestions.push(...questions);
            } catch (error) {
              this.logger.warn('Failed to load question file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.setCache(cacheKey, allQuestions);
      
      this.logger.info('All questions loaded successfully', { 
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied') {
        this.logger.warn('S3 bucket not accessible - returning empty results', { 
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load all questions from S3', error as Error);
      throw new Error('Failed to load question data');
    }
  }

  /**
   * Load a single question file from S3
   */
  private async loadQuestionFile(key: string): Promise<Question[]> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const questionData = JSON.parse(content);
        
        // Debug logging to diagnose S3 reading issue
        this.logger.info('Parsed question data structure', {
          key,
          isArray: Array.isArray(questionData),
          hasQuestions: !!(questionData?.questions),
          questionsIsArray: Array.isArray(questionData?.questions),
          hasStudyData: !!(questionData?.study_data),
          studyDataIsArray: Array.isArray(questionData?.study_data),
          studyDataLength: questionData?.study_data?.length || 0,
          topLevelKeys: typeof questionData === 'object' ? Object.keys(questionData) : 'not-object'
        });
        
        // Handle different question file formats
        if (Array.isArray(questionData)) {
          return questionData as Question[];
        } else if (questionData.questions && Array.isArray(questionData.questions)) {
          return questionData.questions as Question[];
        } else if (questionData.study_data && Array.isArray(questionData.study_data)) {
          // Handle study data format from uploaded files
          return this.transformStudyDataToQuestions(questionData.study_data, key);
        } else {
          this.logger.warn('Invalid question file format', { key });
          return [];
        }
      }
      return [];
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return []; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Transform study data format to Question format
   */
  private transformStudyDataToQuestions(studyData: any[], key: string): Question[] {
    const questions: Question[] = [];
    
    // Extract provider and exam from the S3 key path
    // Expected format: questions/provider/exam/questions.json
    const pathParts = key.split('/');
    const providerId = pathParts.length >= 3 ? pathParts[1] : 'unknown';
    const examId = pathParts.length >= 3 ? pathParts[2] : 'unknown';
    
    this.logger.info('Transforming study data', { 
      totalQuestions: studyData.length,
      providerId,
      examId,
      key
    });

    for (let i = 0; i < studyData.length; i++) {
      const studyItem = studyData[i];
      
      try {
        // Generate a unique question ID
        const questionId = `${providerId}-${examId}-${String(studyItem.question_number || i + 1).padStart(3, '0')}`;
        
        // Extract question data from the nested structure
        const questionData = studyItem.question || {};
        const questionText = questionData.text || '';
        const rawOptions = questionData.options || [];
        
        // Transform options from [["A", "text"], ["B", "text"]] to ["text1", "text2"]
        const options = rawOptions.map((opt: any) => {
          if (Array.isArray(opt) && opt.length >= 2) {
            return opt[1]; // Take the text part, skip the letter part
          }
          return opt;
        });
        
        // Extract other fields from the study item
        const topic = questionData.topic || studyItem.topic || 'general';
        const difficulty = studyItem.difficulty || 'intermediate';
        const correctAnswerIndex = studyItem.correct_answer || 0;
        
        const question: Question = {
          questionId,
          providerId,
          examId,
          questionText,
          options,
          correctAnswer: correctAnswerIndex,
          explanation: studyItem.explanation || studyItem.answer || '',
          difficulty: difficulty as any,
          type: 'multiple_choice' as any,
          tags: studyItem.tags || [],
          topicId: topic,
          metadata: studyItem.study_metadata || studyItem.metadata || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        questions.push(question);
      } catch (error) {
        this.logger.warn('Failed to transform study data item', {
          index: i,
          questionNumber: studyItem.question_number,
          error: (error as Error).message
        });
      }
    }
    
    this.logger.info('Study data transformation completed', {
      originalCount: studyData.length,
      transformedCount: questions.length,
      providerId,
      examId
    });
    
    return questions;
  }

  /**
   * Parse question text and extract options
   */
  private parseQuestionAndOptions(questionText: string): { questionText: string; options: string[] } {
    // Simple parsing - look for A), B), C), D) patterns
    const optionPattern = /[A-Z]\)\s*(.+?)(?=[A-Z]\)|$)/g;
    const options: string[] = [];
    let matches;
    
    // Extract options
    while ((matches = optionPattern.exec(questionText)) !== null) {
      options.push(matches[1].trim());
    }
    
    // Remove options from question text to get clean question
    let cleanQuestion = questionText;
    if (options.length > 0) {
      // Remove everything from first option onward
      const firstOptionIndex = questionText.search(/[A-Z]\)\s*/);
      if (firstOptionIndex !== -1) {
        cleanQuestion = questionText.substring(0, firstOptionIndex).trim();
      }
    }
    
    // If no options found, create default options to avoid empty array
    if (options.length === 0) {
      options.push('True', 'False'); // Default to true/false for questions without parsed options
    }
    
    return {
      questionText: cleanQuestion || questionText,
      options
    };
  }

  /**
   * Parse correct answer from answer text
   */
  private parseCorrectAnswer(answerText: string): number {
    // Look for patterns like "Answer: A", "Correct: B", etc.
    const answerPattern = /(?:Answer|Correct)\s*:?\s*([A-Z])/i;
    const match = answerText.match(answerPattern);
    
    if (match) {
      // Convert letter to index (A=0, B=1, C=2, D=3)
      const letter = match[1].toUpperCase();
      return letter.charCodeAt(0) - 'A'.charCodeAt(0);
    }
    
    // If no clear answer pattern, default to first option
    return 0;
  }

  /**
   * Get data from cache if it exists and is not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp < entry.ttl) {
        return entry.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(key);
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  private setCache<T>(key: string, data: T, customTtl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || this.CACHE_TTL
    });
  }
}