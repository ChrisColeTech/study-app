import { QuestionService } from './question-service';
import { Provider, Exam } from '../types';

export class ProviderService {
  private questionService: QuestionService;

  constructor() {
    this.questionService = new QuestionService();
  }

  async getProviders(): Promise<{
    providers: Provider[];
    totalProviders: number;
    totalExams: number;
  }> {
    // Define available providers and their exams
    const providerConfigs = [
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Cloud computing platform and services',
        exams: [
          { id: 'saa-c03', name: 'Solutions Architect Associate', description: 'Validates ability to design distributed systems on AWS' },
          { id: 'dva-c01', name: 'Developer Associate', description: 'Validates ability to develop applications on AWS' },
          { id: 'soa-c02', name: 'SysOps Administrator Associate', description: 'Validates ability to deploy and manage systems on AWS' },
        ],
      },
      {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'Cloud computing platform and services',
        exams: [
          { id: 'az-900', name: 'Azure Fundamentals', description: 'Validates foundational knowledge of cloud services' },
          { id: 'az-104', name: 'Azure Administrator', description: 'Validates skills to manage Azure subscriptions and resources' },
          { id: 'az-204', name: 'Azure Developer', description: 'Validates skills to develop cloud solutions' },
        ],
      },
      {
        id: 'gcp',
        name: 'Google Cloud Platform',
        description: 'Cloud computing platform and services',
        exams: [
          { id: 'ace', name: 'Associate Cloud Engineer', description: 'Validates ability to deploy and manage GCP resources' },
          { id: 'pca', name: 'Professional Cloud Architect', description: 'Validates ability to design and manage GCP solutions' },
        ],
      },
    ];

    // Get question counts for each exam
    const providers: Provider[] = [];

    for (const config of providerConfigs) {
      const exams: Exam[] = [];
      
      for (const examConfig of config.exams) {
        try {
          const questions = await this.questionService.getQuestions({
            provider: config.id,
            exam: examConfig.id,
            limit: 1000, // Get all to count
          });

          exams.push({
            ...examConfig,
            questionCount: questions.pagination.totalCount,
          });
        } catch (error) {
          // If questions don't exist, still include the exam with 0 count
          exams.push({
            ...examConfig,
            questionCount: 0,
          });
        }
      }

      providers.push({
        ...config,
        exams,
      });
    }

    const totalExams = providers.reduce((sum, provider) => sum + provider.exams.length, 0);

    return {
      providers,
      totalProviders: providers.length,
      totalExams,
    };
  }

  async getProvider(providerId: string): Promise<Provider | null> {
    const result = await this.getProviders();
    return result.providers.find(p => p.id === providerId) || null;
  }

  async getProviderExams(providerId: string): Promise<Exam[]> {
    const provider = await this.getProvider(providerId);
    return provider?.exams || [];
  }

  async getExamDetails(providerId: string, examId: string): Promise<{
    provider: Provider;
    exam: Exam;
    topics: string[];
    statistics: {
      totalQuestions: number;
      difficultyCounts: Record<string, number>;
      topicCounts: Record<string, number>;
    };
  } | null> {
    const provider = await this.getProvider(providerId);
    if (!provider) return null;

    const exam = provider.exams.find(e => e.id === examId);
    if (!exam) return null;

    try {
      // Get all questions for statistics
      const questions = await this.questionService.getQuestions({
        provider: providerId,
        exam: examId,
        limit: 1000,
      });

      const topics = await this.questionService.getAvailableTopics(providerId, examId);

      // Calculate statistics
      const difficultyCounts: Record<string, number> = {};
      const topicCounts: Record<string, number> = {};

      questions.questions.forEach(q => {
        const difficulty = q.study_metadata.difficulty;
        const topic = q.question.topic;

        difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });

      return {
        provider,
        exam,
        topics,
        statistics: {
          totalQuestions: questions.pagination.totalCount,
          difficultyCounts,
          topicCounts,
        },
      };
    } catch (error) {
      // Return basic info if questions can't be loaded
      return {
        provider,
        exam,
        topics: [],
        statistics: {
          totalQuestions: 0,
          difficultyCounts: {},
          topicCounts: {},
        },
      };
    }
  }
}