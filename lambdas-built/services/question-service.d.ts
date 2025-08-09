import { Question, QuestionRequest, SearchRequest } from '../types';
export declare class QuestionService {
    private dataBucket;
    constructor();
    getQuestions(request: QuestionRequest): Promise<{
        questions: Question[];
        pagination: any;
        filters: any;
    }>;
    searchQuestions(request: SearchRequest): Promise<{
        questions: Question[];
        searchQuery: string;
        totalResults: number;
        provider: string;
        exam: string;
    }>;
    getQuestionById(provider: string, exam: string, questionId: string): Promise<Question | null>;
    private loadQuestions;
    getAvailableTopics(provider: string, exam: string): Promise<string[]>;
}
//# sourceMappingURL=question-service.d.ts.map