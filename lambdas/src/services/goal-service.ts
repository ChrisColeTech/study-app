import { v4 as uuidv4 } from 'uuid';
import { StudyGoal, GoalRequest } from '../types';
import GoalRepository from '../repositories/goal-repository';
import { SessionService } from './session-service';

export class GoalService {
  private goalRepository: GoalRepository;
  private sessionService: SessionService;

  constructor() {
    this.goalRepository = new GoalRepository();
    this.sessionService = new SessionService();
  }

  async createGoal(userId: string, request: GoalRequest): Promise<StudyGoal> {
    const goalId = uuidv4();
    
    const goal: StudyGoal = {
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

  async getUserGoals(userId: string, limit: number = 20): Promise<{
    goals: StudyGoal[];
    activeGoals: number;
    completedGoals: number;
    totalGoals: number;
  }> {
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

  async getGoal(goalId: string, userId: string): Promise<StudyGoal | null> {
    return await this.goalRepository.findByIdAndUser(goalId, userId);
  }

  async updateGoal(
    goalId: string, 
    userId: string, 
    updates: Partial<StudyGoal>
  ): Promise<StudyGoal | null> {
    const goal = await this.goalRepository.findByIdAndUser(goalId, userId);
    if (!goal) return null;

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

  async deleteGoal(goalId: string, userId: string): Promise<boolean> {
    const goal = await this.goalRepository.findByIdAndUser(goalId, userId);
    if (!goal) return false;

    await this.goalRepository.delete(goalId, userId);
    return true;
  }

  async updateGoalProgress(userId: string, provider: string, exam: string): Promise<void> {
    // Find all goals for this user/provider/exam combination
    const userGoals = await this.getUserGoals(userId);
    const relevantGoals = userGoals.goals.filter(
      g => g.provider === provider && g.exam === exam && !g.isCompleted
    );

    if (relevantGoals.length === 0) return;

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

  private async calculateCurrentScore(
    userId: string, 
    provider: string, 
    exam: string
  ): Promise<number> {
    try {
      // Get user's sessions for this provider/exam
      const sessions = await this.sessionService.getUserSessions(userId, 50);
      const relevantSessions = sessions.filter(
        s => s.provider === provider && s.exam === exam && s.completed
      );

      if (relevantSessions.length === 0) return 0;

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

      if (totalQuestions === 0) return 0;

      return Math.round((totalCorrect / totalQuestions) * 100);
    } catch (error) {
      console.error('Error calculating current score:', error);
      return 0;
    }
  }

  async getGoalProgress(goalId: string, userId: string): Promise<{
    goal: StudyGoal;
    progress: {
      percentage: number;
      sessionsCompleted: number;
      timeRemaining: number;
      onTrack: boolean;
      recommendations: string[];
    };
  } | null> {
    const goal = await this.getGoal(goalId, userId);
    if (!goal) return null;

    // Get sessions for this goal
    const sessions = await this.sessionService.getUserSessions(userId, 100);
    const relevantSessions = sessions.filter(
      s => s.provider === goal.provider && s.exam === goal.exam && s.completed
    );

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

  private generateGoalRecommendations(
    goal: StudyGoal, 
    percentage: number, 
    timeRemaining: number, 
    sessionsCompleted: number
  ): string[] {
    const recommendations: string[] = [];

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