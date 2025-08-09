export interface Question {
    question_number: number;
    question: {
        text: string;
        options: [string, string][];
        question_type: 'single_choice' | 'multiple_choice';
        expected_answers: number;
        topic: string;
        service_category: string;
        aws_services: string[];
    };
    answer: {
        correct_answer: string;
        explanation: string;
        keywords: string[];
        parsing_confidence: number;
        source: string;
    };
    study_metadata: {
        difficulty: 'easy' | 'medium' | 'hard';
        completeness: string;
        question_preview: string;
        has_explanation: boolean;
        confidence_level: string;
    };
}
export interface User {
    userId: string;
    email: string;
    name: string;
    passwordHash?: string;
    createdAt: string;
    updatedAt: string;
}
export interface StudySession {
    sessionId: string;
    userId: string;
    provider: string;
    exam: string;
    questions: any[];
    answers: Record<string, string>;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface AuthPayload {
    userId: string;
    email: string;
    iat: number;
    exp: number;
}
export interface Provider {
    id: string;
    name: string;
    description: string;
    exams: Exam[];
}
export interface Exam {
    id: string;
    name: string;
    description: string;
    questionCount: number;
    providerId?: string;
    providerName?: string;
}
export interface StudyGoal {
    goalId: string;
    userId: string;
    title: string;
    description: string;
    targetDate: string;
    provider: string;
    exam: string;
    targetScore: number;
    currentScore: number;
    isCompleted: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface GoalRequest {
    title: string;
    description: string;
    targetDate: string;
    provider: string;
    exam: string;
    targetScore: number;
}
export interface QuestionRequest {
    provider?: string;
    exam?: string;
    topics?: string[];
    difficulty?: string;
    limit?: number;
    offset?: number;
}
export interface SearchRequest {
    query: string;
    provider?: string;
    exam?: string;
    limit?: number;
}
export interface SessionRequest {
    provider: string;
    exam: string;
    questionCount: number;
}
export interface AnswerRequest {
    questionId: string;
    answer: string;
}
//# sourceMappingURL=index.d.ts.map