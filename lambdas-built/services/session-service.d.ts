import { StudySession, SessionRequest, AnswerRequest } from '../types';
export declare class SessionService {
    private sessionRepository;
    private questionService;
    constructor();
    createSession(userId: string, request: SessionRequest): Promise<StudySession>;
    getSession(sessionId: string, userId: string): Promise<StudySession | null>;
    getUserSessions(userId: string, limit?: number): Promise<StudySession[]>;
    updateSession(sessionId: string, userId: string, updates: Partial<StudySession>): Promise<StudySession | null>;
    deleteSession(sessionId: string, userId: string): Promise<boolean>;
    submitAnswer(sessionId: string, userId: string, answerRequest: AnswerRequest): Promise<{
        questionId: string;
        answerSubmitted: string;
        totalAnswered: number;
    }>;
    createAdaptiveSession(userId: string, request: SessionRequest): Promise<{
        sessionId: string;
        sessionType: string;
        config: any;
        adaptiveFeatures: any;
        questionPreview: any[];
        nextQuestionUrl: string;
    }>;
    completeSession(sessionId: string, userId: string): Promise<StudySession | null>;
    getSessionStats(sessionId: string, userId: string): Promise<{
        totalQuestions: number;
        answeredQuestions: number;
        correctAnswers: number;
        accuracy: number;
        timeSpent: number;
        isCompleted: boolean;
    } | null>;
}
//# sourceMappingURL=session-service.d.ts.map