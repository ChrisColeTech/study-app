import { StudySession } from '../types';
export default class SessionRepository {
    private tableName;
    constructor();
    create(session: StudySession): Promise<void>;
    findByIdAndUser(sessionId: string, userId: string): Promise<StudySession | null>;
    findByUser(userId: string, limit?: number): Promise<StudySession[]>;
    update(sessionId: string, userId: string, updates: Partial<StudySession>): Promise<void>;
    delete(sessionId: string, userId: string): Promise<void>;
    findByProviderAndExam(provider: string, exam: string, limit?: number): Promise<StudySession[]>;
}
//# sourceMappingURL=session-repository.d.ts.map