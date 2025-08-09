import { Provider, Exam } from '../types';
export declare class ProviderService {
    private questionService;
    constructor();
    getProviders(): Promise<{
        providers: Provider[];
        totalProviders: number;
        totalExams: number;
    }>;
    getProvider(providerId: string): Promise<Provider | null>;
    getProviderExams(providerId: string): Promise<Exam[]>;
    getExamDetails(providerId: string, examId: string): Promise<{
        provider: Provider;
        exam: Exam;
        topics: string[];
        statistics: {
            totalQuestions: number;
            difficultyCounts: Record<string, number>;
            topicCounts: Record<string, number>;
        };
    } | null>;
}
//# sourceMappingURL=provider-service.d.ts.map