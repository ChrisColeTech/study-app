import { StudyGoal, GoalRequest } from '../types';
export declare class GoalService {
    private goalRepository;
    private sessionService;
    constructor();
    createGoal(userId: string, request: GoalRequest): Promise<StudyGoal>;
    getUserGoals(userId: string, limit?: number): Promise<{
        goals: StudyGoal[];
        activeGoals: number;
        completedGoals: number;
        totalGoals: number;
    }>;
    getGoal(goalId: string, userId: string): Promise<StudyGoal | null>;
    updateGoal(goalId: string, userId: string, updates: Partial<StudyGoal>): Promise<StudyGoal | null>;
    deleteGoal(goalId: string, userId: string): Promise<boolean>;
    updateGoalProgress(userId: string, provider: string, exam: string): Promise<void>;
    private calculateCurrentScore;
    getGoalProgress(goalId: string, userId: string): Promise<{
        goal: StudyGoal;
        progress: {
            percentage: number;
            sessionsCompleted: number;
            timeRemaining: number;
            onTrack: boolean;
            recommendations: string[];
        };
    } | null>;
    private generateGoalRecommendations;
}
//# sourceMappingURL=goal-service.d.ts.map