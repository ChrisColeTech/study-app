// Dedicated mapper for question data transformations
// Extracted from QuestionSelector to separate mapping concerns

import { 
  Question, 
  EnhancedQuestion, 
  QuestionType, 
  ReviewStatus, 
  BloomsLevel, 
  CognitiveLoad 
} from '../shared/types/question.types';

/**
 * QuestionMapper - Dedicated mapper for question data transformations
 * 
 * Extracted from QuestionSelector to separate concerns and provide standardized
 * transformation patterns for question-related data objects.
 * 
 * @responsibilities
 * - Transform Question to EnhancedQuestion with metadata
 * - Handle array transformations for question collections
 * - Apply consistent defaults for question enhancement
 */
export class QuestionMapper {
  /**
   * Convert Question to EnhancedQuestion with default metadata and type
   * 
   * @param question - Basic question object
   * @returns Enhanced question with metadata and default values
   */
  static toEnhancedQuestion(question: Question): EnhancedQuestion {
    return {
      ...question,
      type: QuestionType.MULTIPLE_CHOICE, // Default type
      metadata: {
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        version: question.version || 1,
        reviewStatus: ReviewStatus.APPROVED, // Default to approved
        language: 'en',
        estimatedTime: 60,
        skillLevel: 'intermediate',
        bloomsLevel: BloomsLevel.UNDERSTAND, // Default blooms level
        cognitiveLoad: CognitiveLoad.MEDIUM // Default cognitive load
      }
    };
  }

  /**
   * Convert array of Questions to EnhancedQuestions
   * 
   * @param questions - Array of basic question objects
   * @returns Array of enhanced questions with metadata
   */
  static toEnhancedQuestions(questions: Question[]): EnhancedQuestion[] {
    return questions.map(question => this.toEnhancedQuestion(question));
  }

  /**
   * Create enhanced question with custom metadata overrides
   * 
   * @param question - Basic question object
   * @param overrides - Metadata overrides to apply
   * @returns Enhanced question with custom metadata
   */
  static createEnhancedQuestionWithOverrides(
    question: Question, 
    overrides: Partial<EnhancedQuestion['metadata']>
  ): EnhancedQuestion {
    const enhanced = this.toEnhancedQuestion(question);
    enhanced.metadata = {
      ...enhanced.metadata,
      ...overrides
    };
    return enhanced;
  }

  /**
   * Strip sensitive or optional data from enhanced question based on flags
   * 
   * @param question - Enhanced question object
   * @param includeExplanation - Whether to include explanation text
   * @param includeMetadata - Whether to include metadata
   * @returns Processed question with optional data stripped
   */
  static processQuestionOutput(
    question: EnhancedQuestion,
    includeExplanation: boolean = true,
    includeMetadata: boolean = true
  ): EnhancedQuestion {
    const processed = { ...question };

    // Strip explanation if not requested
    if (!includeExplanation) {
      processed.explanation = '';
    }

    // Strip metadata if not requested
    if (!includeMetadata) {
      processed.metadata = {} as any;
    }

    return processed;
  }
}