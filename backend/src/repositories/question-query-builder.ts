// Question query optimization and search algorithms

import { Question } from '../shared/types/question.types';
import { createLogger } from '../shared/logger';

export class QuestionQueryBuilder {
  private logger = createLogger({ component: 'QuestionQueryBuilder' });

  /**
   * Filter questions by topic within an exam
   */
  filterByTopic(questions: Question[], topic: string): Question[] {
    return questions.filter(question => question.topicId === topic);
  }

  /**
   * Filter questions by difficulty
   */
  filterByDifficulty(questions: Question[], difficulty: string): Question[] {
    return questions.filter(question => 
      question.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
  }

  /**
   * Search questions by text content with enhanced matching
   */
  searchQuestions(questions: Question[], query: string): Question[] {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length >= 2); // Minimum 2 characters
    
    return questions.filter(question => {
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
   * Find question by ID efficiently
   */
  findQuestionById(questions: Question[], questionId: string): Question | null {
    return questions.find(q => q.questionId === questionId) || null;
  }

  /**
   * Get optimized question set for search operations
   * Prioritizes popular providers and limits results for performance
   */
  optimizeQuestionsForSearch(allQuestions: Question[]): Question[] {
    const popularProviders = ['aws', 'azure', 'gcp', 'cisco', 'comptia'];
    const optimizedQuestions: Question[] = [];
    
    // Prioritize popular providers first
    for (const provider of popularProviders) {
      const providerQuestions = allQuestions.filter(q => 
        q.providerId.toLowerCase() === provider.toLowerCase()
      );
      optimizedQuestions.push(...providerQuestions);
      
      // If we have enough questions for search, stop here for performance
      if (optimizedQuestions.length >= 1000) {
        break;
      }
    }
    
    // Add remaining questions if needed
    if (optimizedQuestions.length < 1000) {
      const remainingQuestions = allQuestions.filter(q => 
        !popularProviders.includes(q.providerId.toLowerCase())
      );
      optimizedQuestions.push(...remainingQuestions);
    }
    
    this.logger.info('Optimized questions for search', { 
      totalQuestions: optimizedQuestions.length,
      providers: [...new Set(optimizedQuestions.map(q => q.providerId))]
    });

    return optimizedQuestions.slice(0, 1000); // Limit to 1000 for performance
  }

  /**
   * Build S3 key for question file
   */
  buildQuestionFileKey(provider: string, exam: string, questionsPrefix: string): string {
    return `${questionsPrefix}${provider}/${exam}/questions.json`;
  }

  /**
   * Build S3 list prefix for provider
   */
  buildProviderPrefix(provider: string, questionsPrefix: string): string {
    return `${questionsPrefix}${provider}/`;
  }

  /**
   * Filter S3 objects to question files only
   */
  filterToQuestionFiles(objects: any[]): { Key: string }[] {
    return objects.filter((obj): obj is { Key: string } => 
      obj.Key && 
      typeof obj.Key === 'string' &&
      obj.Key.endsWith('/questions.json')
    );
  }

  /**
   * Extract provider and exam from S3 key path
   */
  extractProviderAndExam(key: string): { providerId: string; examId: string } {
    const pathParts = key.split('/');
    return {
      providerId: pathParts.length >= 3 ? pathParts[1] : 'unknown',
      examId: pathParts.length >= 3 ? pathParts[2] : 'unknown'
    };
  }
}