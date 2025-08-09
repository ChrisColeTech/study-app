"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalService = void 0;
const uuid_1 = require("uuid");
const goal_repository_1 = __importDefault(require("../repositories/goal-repository"));
const session_service_1 = require("./session-service");
class GoalService {
    constructor() {
        this.goalRepository = new goal_repository_1.default();
        this.sessionService = new session_service_1.SessionService();
    }
    async createGoal(userId, request) {
        const goalId = (0, uuid_1.v4)();
        const goal = {
            goalId,
            userId,
            title: request.title,
            description: request.description,
            targetDate: request.targetDate,
            provider: request.provider,
            exam: request.exam,
            targetScore: request.targetScore,
            currentScore: 0,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.goalRepository.create(goal);
        return goal;
    }
    async getUserGoals(userId, limit = 20) {
        const goals = await this.goalRepository.findByUser(userId, limit);
        const activeGoals = goals.filter(g => !g.isCompleted).length;
        const completedGoals = goals.filter(g => g.isCompleted).length;
        return {
            goals,
            activeGoals,
            completedGoals,
            totalGoals: goals.length,
        };
    }
    async getGoal(goalId, userId) {
        return await this.goalRepository.findByIdAndUser(goalId, userId);
    }
    async updateGoal(goalId, userId, updates) {
        const goal = await this.goalRepository.findByIdAndUser(goalId, userId);
        if (!goal)
            return null;
        // Calculate current score if not provided
        if (!updates.currentScore) {
            const currentScore = await this.calculateCurrentScore(userId, goal.provider, goal.exam);
            updates.currentScore = currentScore;
        }
        // Check if goal is completed
        if (updates.currentScore && updates.currentScore >= goal.targetScore) {
            updates.isCompleted = true;
        }
        const updatedGoal = {
            ...goal,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        await this.goalRepository.update(goalId, userId, updatedGoal);
        return updatedGoal;
    }
    async deleteGoal(goalId, userId) {
        const goal = await this.goalRepository.findByIdAndUser(goalId, userId);
        if (!goal)
            return false;
        await this.goalRepository.delete(goalId, userId);
        return true;
    }
    async updateGoalProgress(userId, provider, exam) {
        // Find all goals for this user/provider/exam combination
        const userGoals = await this.getUserGoals(userId);
        const relevantGoals = userGoals.goals.filter(g => g.provider === provider && g.exam === exam && !g.isCompleted);
        if (relevantGoals.length === 0)
            return;
        // Calculate current score
        const currentScore = await this.calculateCurrentScore(userId, provider, exam);
        // Update all relevant goals
        for (const goal of relevantGoals) {
            await this.updateGoal(goal.goalId, userId, {
                currentScore,
                isCompleted: currentScore >= goal.targetScore,
            });
        }
    }
    async calculateCurrentScore(userId, provider, exam) {
        try {
            // Get user's sessions for this provider/exam
            const sessions = await this.sessionService.getUserSessions(userId, 50);
            const relevantSessions = sessions.filter(s => s.provider === provider && s.exam === exam && s.completed);
            if (relevantSessions.length === 0)
                return 0;
            // Calculate average accuracy across completed sessions
            let totalQuestions = 0;
            let totalCorrect = 0;
            for (const session of relevantSessions) {
                const stats = await this.sessionService.getSessionStats(session.sessionId, userId);
                if (stats) {
                    totalQuestions += stats.answeredQuestions;
                    totalCorrect += stats.correctAnswers;
                }
            }
            if (totalQuestions === 0)
                return 0;
            return Math.round((totalCorrect / totalQuestions) * 100);
        }
        catch (error) {
            console.error('Error calculating current score:', error);
            return 0;
        }
    }
    async getGoalProgress(goalId, userId) {
        const goal = await this.getGoal(goalId, userId);
        if (!goal)
            return null;
        // Get sessions for this goal
        const sessions = await this.sessionService.getUserSessions(userId, 100);
        const relevantSessions = sessions.filter(s => s.provider === goal.provider && s.exam === goal.exam && s.completed);
        const percentage = goal.targetScore > 0 ?
            Math.min(Math.round((goal.currentScore / goal.targetScore) * 100), 100) : 0;
        const targetDate = new Date(goal.targetDate);
        const now = new Date();
        const timeRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        // Simple on-track calculation
        const onTrack = percentage >= 50 || timeRemaining > 30;
        const recommendations = this.generateGoalRecommendations(goal, percentage, timeRemaining, relevantSessions.length);
        return {
            goal,
            progress: {
                percentage,
                sessionsCompleted: relevantSessions.length,
                timeRemaining,
                onTrack,
                recommendations,
            },
        };
    }
    generateGoalRecommendations(goal, percentage, timeRemaining, sessionsCompleted) {
        const recommendations = [];
        if (percentage < 25 && timeRemaining < 30) {
            recommendations.push('Your progress is behind schedule. Consider increasing study frequency.');
        }
        if (sessionsCompleted < 5) {
            recommendations.push('Complete more practice sessions to improve your score.');
        }
        if (timeRemaining < 7) {
            recommendations.push('Goal deadline is approaching. Focus on your weak areas.');
        }
        if (percentage >= 90) {
            recommendations.push('Great progress! You\'re very close to achieving your goal.');
        }
        if (recommendations.length === 0) {
            recommendations.push('Keep up the consistent study schedule to achieve your goal.');
        }
        return recommendations;
    }
}
exports.GoalService = GoalService;
//# sourceMappingURL=goal-service.js.map