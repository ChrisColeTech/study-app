// Question data transformation and parsing utilities

import { Question } from '../shared/types/question.types';
import { createLogger } from '../shared/logger';

export class QuestionDataTransformer {
  private logger = createLogger({ component: 'QuestionDataTransformer' });

  /**
   * Transform study data format to Question format
   */
  transformStudyDataToQuestions(studyData: any[], key: string): Question[] {
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
  parseQuestionAndOptions(questionText: string): { questionText: string; options: string[] } {
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
  parseCorrectAnswer(answerText: string): number {
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
   * Process and normalize question data structure
   */
  processQuestionData(questionData: any, key: string): Question[] {
    this.logger.info('Processing question data structure', {
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
}