import { StudyGoal } from '../types';
export default class GoalRepository {
    private tableName;
    constructor();
    create(goal: StudyGoal): Promise<void>;
    findByIdAndUser(goalId: string, userId: string): Promise<StudyGoal | null>;
    findByUser(userId: string, limit?: number): Promise<StudyGoal[]>;
    update(goalId: string, userId: string, updates: Partial<StudyGoal>): Promise<void>;
    delete(goalId: string, userId: string): Promise<void>;
    findByProviderAndExam(provider: string, exam: string, limit?: number): Promise<StudyGoal[]>;
}
//# sourceMappingURL=goal-repository.d.ts.map