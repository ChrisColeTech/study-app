import { Exam, Provider } from '../types';
export declare class ExamService {
    private providerService;
    private questionService;
    constructor();
    getAllExams(): Promise<{
        exams: Exam[];
        totalExams: number;
        providers: string[];
    }>;
    getExamById(examId: string, providerId?: string): Promise<{
        exam: Exam;
        provider: Provider;
        topics: string[];
        statistics: {
            totalQuestions: number;
            difficultyCounts: Record<string, number>;
            topicCounts: Record<string, number>;
        };
    } | null>;
    getExamTopics(examId: string, providerId?: string): Promise<{
        examId: string;
        providerId?: string;
        topics: string[];
        topicCounts: Record<string, number>;
    } | null>;
    searchExams(query: string): Promise<{
        exams: Exam[];
        totalResults: number;
        searchQuery: string;
    }>;
    getExamsByProvider(providerId: string): Promise<{
        provider: Provider;
        exams: Exam[];
    } | null>;
}
//# sourceMappingURL=exam-service.d.ts.map