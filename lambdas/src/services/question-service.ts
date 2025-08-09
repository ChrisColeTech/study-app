import { GetObjectCommand } from '@aws-sdk/client-s3';
import AWSClients from '../shared/aws-clients';
import { Question, QuestionRequest, SearchRequest } from '../types';

export class QuestionService {
  private dataBucket: string;

  constructor() {
    this.dataBucket = process.env.DATA_BUCKET_NAME!;
    if (!this.dataBucket) {
      throw new Error('DATA_BUCKET_NAME environment variable not set');
    }
  }

  async getQuestions(request: QuestionRequest): Promise<{
    questions: Question[];
    pagination: any;
    filters: any;
  }> {
    const provider = request.provider || 'aws';
    const exam = request.exam || 'saa-c03';
    const limit = Math.min(request.limit || 20, 100);
    const offset = request.offset || 0;

    const questions = await this.loadQuestions(provider, exam);
    
    let filteredQuestions = questions;

    // Apply topic filter
    if (request.topics && request.topics.length > 0) {
      filteredQuestions = filteredQuestions.filter(q => 
        request.topics!.includes(q.question.topic)
      );
    }

    // Apply difficulty filter
    if (request.difficulty) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.study_metadata.difficulty === request.difficulty
      );
    }

    // Apply pagination
    const paginatedQuestions = filteredQuestions.slice(offset, offset + limit);

    return {
      questions: paginatedQuestions,
      pagination: {
        offset,
        limit,
        totalCount: filteredQuestions.length,
        hasMore: offset + limit < filteredQuestions.length,
      },
      filters: {
        provider,
        exam,
        topics: request.topics,
        difficulty: request.difficulty,
      },
    };
  }

  async searchQuestions(request: SearchRequest): Promise<{
    questions: Question[];
    searchQuery: string;
    totalResults: number;
    provider: string;
    exam: string;
  }> {
    const provider = request.provider || 'aws';
    const exam = request.exam || 'saa-c03';
    const limit = Math.min(request.limit || 10, 50);
    const query = request.query.toLowerCase();

    const questions = await this.loadQuestions(provider, exam);

    // Simple text search in question text and options
    const matchingQuestions = questions.filter(q => {
      const questionText = q.question.text.toLowerCase();
      const optionsText = q.question.options.map(opt => opt[1].toLowerCase()).join(' ');
      const explanation = q.answer.explanation.toLowerCase();
      
      return questionText.includes(query) || 
             optionsText.includes(query) || 
             explanation.includes(query);
    }).slice(0, limit);

    return {
      questions: matchingQuestions,
      searchQuery: request.query,
      totalResults: matchingQuestions.length,
      provider,
      exam,
    };
  }

  async getQuestionById(provider: string, exam: string, questionId: string): Promise<Question | null> {
    const questions = await this.loadQuestions(provider, exam);
    return questions.find(q => q.question_number.toString() === questionId) || null;
  }

  private async loadQuestions(provider: string, exam: string): Promise<Question[]> {
    try {
      const client = AWSClients.getS3Client();
      const key = `providers/${provider}/${exam}/questions.json`;
      
      const response = await client.send(new GetObjectCommand({
        Bucket: this.dataBucket,
        Key: key,
      }));

      if (!response.Body) {
        throw new Error('No data found');
      }

      const content = await response.Body.transformToString();
      const data = JSON.parse(content);

      // Handle different data structures
      if (Array.isArray(data)) {
        return data;
      } else if (data.questions && Array.isArray(data.questions)) {
        return data.questions;
      } else if (data.study_data && Array.isArray(data.study_data)) {
        return data.study_data;
      }

      throw new Error('Invalid question data format');
    } catch (error) {
      console.error(`Error loading questions for ${provider}/${exam}:`, error);
      throw new Error('Failed to load questions');
    }
  }

  async getAvailableTopics(provider: string, exam: string): Promise<string[]> {
    const questions = await this.loadQuestions(provider, exam);
    const topics = new Set(questions.map(q => q.question.topic));
    return Array.from(topics).sort();
  }
}