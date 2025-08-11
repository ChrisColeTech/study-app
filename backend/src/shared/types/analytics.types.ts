// Analytics specific types for progress tracking

export interface ProgressAnalyticsRequest {
  timeframe?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  providerId?: string;
  examId?: string;
  topics?: string[];
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  limit?: number;
  offset?: number;
}

export interface ProgressAnalyticsResponse {
  success: boolean;
  data: {
    overview: ProgressOverview;
    trends: ProgressTrends;
    competencyData: CompetencyAnalytics;
    historicalData: HistoricalPerformance[];
    insights: LearningInsights;
    visualizationData: VisualizationData;
  };
  metadata: {
    timeframe: string;
    periodStart: string;
    periodEnd: string;
    totalSessions: number;
    dataPoints: number;
    calculatedAt: string;
  };
}

export interface ProgressOverview {
  overallProgress: number; // percentage (0-100)
  totalSessionsCompleted: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number; // percentage
  totalStudyTime: number; // minutes
  currentStreak: number; // days
  longestStreak: number; // days
  averageSessionDuration: number; // minutes
  improvementVelocity: number; // percentage improvement per week
}

export interface ProgressTrends {
  accuracyTrend: TrendData[];
  studyTimeTrend: TrendData[];
  sessionFrequencyTrend: TrendData[];
  difficultyProgressTrend: DifficultyTrendData[];
  competencyGrowthTrend: CompetencyTrendData[];
}

export interface TrendData {
  period: string; // YYYY-MM-DD or YYYY-WW format
  value: number;
  change: number; // percentage change from previous period
  dataPoints: number; // number of data points in this period
}

export interface DifficultyTrendData extends TrendData {
  difficulty: 'easy' | 'medium' | 'hard';
  questionsAnswered: number;
}

export interface CompetencyTrendData extends TrendData {
  topicId: string;
  topicName: string;
  masteryLevel: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  questionsAnswered: number;
}

export interface CompetencyAnalytics {
  topicCompetencies: TopicCompetency[];
  providerCompetencies: ProviderCompetency[];
  strengthsAndWeaknesses: StrengthsWeaknesses;
  masteryProgression: MasteryProgression;
}

export interface TopicCompetency {
  topicId: string;
  topicName: string;
  examId: string;
  providerId: string;
  currentAccuracy: number;
  previousAccuracy?: number; // for comparison
  improvementRate: number; // percentage change
  questionsAnswered: number;
  averageTimePerQuestion: number; // seconds
  masteryLevel: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  previousMasteryLevel?: string; // for progression tracking
  confidence: number; // 0-1 confidence score based on consistency
  lastStudied: string; // ISO string
  studySessions: number;
  timeSpent: number; // minutes
  difficultyBreakdown: {
    easy: { answered: number; correct: number; accuracy: number };
    medium: { answered: number; correct: number; accuracy: number };
    hard: { answered: number; correct: number; accuracy: number };
  };
}

export interface ProviderCompetency {
  providerId: string;
  providerName: string;
  overallAccuracy: number;
  questionsAnswered: number;
  studyTime: number; // minutes
  examCompetencies: ExamCompetency[];
  strengths: string[]; // topic names where accuracy > 80%
  weaknesses: string[]; // topic names where accuracy < 60%
}

export interface ExamCompetency {
  examId: string;
  examName: string;
  accuracy: number;
  questionsAnswered: number;
  studyTime: number; // minutes
  estimatedReadiness: number; // percentage
  recommendedStudyTime: number; // additional minutes needed
}

export interface StrengthsWeaknesses {
  strengths: CompetencyArea[];
  weaknesses: CompetencyArea[];
  opportunities: CompetencyArea[]; // areas with high potential for improvement
}

export interface CompetencyArea {
  topicId: string;
  topicName: string;
  accuracy: number;
  questionsAnswered: number;
  improvementPotential: number; // 0-100 score
  priority: 'high' | 'medium' | 'low';
  recommendedActions: string[];
}

export interface MasteryProgression {
  currentDistribution: MasteryDistribution;
  progressionHistory: MasteryProgressionPoint[];
  projectedGrowth: MasteryProjection[];
}

export interface MasteryDistribution {
  novice: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
}

export interface MasteryProgressionPoint {
  date: string; // ISO string
  distribution: MasteryDistribution;
}

export interface MasteryProjection {
  timeframe: string; // '1_month', '3_months', etc.
  projectedDistribution: MasteryDistribution;
  confidence: number; // 0-1
}

export interface HistoricalPerformance {
  date: string; // ISO string (YYYY-MM-DD)
  sessionsCompleted: number;
  questionsAnswered: number;
  accuracy: number;
  studyTime: number; // minutes
  topicsFocused: string[];
  averageScore: number;
  improvements: string[]; // areas that improved
  regressions: string[]; // areas that declined
}

export interface LearningInsights {
  patterns: LearningPattern[];
  recommendations: LearningRecommendation[];
  milestones: LearningMilestone[];
  warnings: LearningWarning[];
}

export interface LearningPattern {
  type: 'time_preference' | 'difficulty_preference' | 'topic_affinity' | 'learning_velocity' | 'consistency';
  description: string;
  strength: number; // 0-1
  evidence: string[];
  impact: 'positive' | 'negative' | 'neutral';
}

export interface LearningRecommendation {
  type: 'study_schedule' | 'topic_focus' | 'difficulty_adjustment' | 'review_strategy' | 'exam_readiness';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
  actionItems: string[];
  timeframe: string; // 'immediate', '1_week', '1_month'
}

export interface LearningMilestone {
  type: 'mastery_achieved' | 'streak_milestone' | 'accuracy_milestone' | 'study_time_milestone' | 'topic_completion';
  title: string;
  description: string;
  achievedAt: string; // ISO string
  value: number; // the milestone value
  nextMilestone?: {
    title: string;
    target: number;
    estimatedTime: string;
  };
}

export interface LearningWarning {
  type: 'declining_performance' | 'study_gap' | 'overconfidence' | 'burnout_risk' | 'knowledge_gap';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  affectedAreas: string[];
  recommendations: string[];
  detectedAt: string; // ISO string
}

export interface VisualizationData {
  charts: {
    accuracyOverTime: ChartDataPoint[];
    studyTimeDistribution: ChartDataPoint[];
    topicMasteryRadar: RadarChartData;
    difficultyProgression: ChartDataPoint[];
    weeklyProgress: ChartDataPoint[];
    competencyMatrix: MatrixData;
  };
  heatmaps: {
    studyActivity: HeatmapData;
    topicAccuracy: HeatmapData;
  };
  gauges: {
    overallProgress: GaugeData;
    examReadiness: GaugeData[];
  };
}

export interface ChartDataPoint {
  x: string | number; // date or category
  y: number; // value
  label?: string;
  metadata?: Record<string, any>;
}

export interface RadarChartData {
  labels: string[]; // topic names
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}

export interface MatrixData {
  rows: string[]; // row labels
  columns: string[]; // column labels
  data: number[][]; // 2D array of values
  colorScale: {
    min: number;
    max: number;
    colors: string[];
  };
}

export interface HeatmapData {
  data: Array<{
    x: string;
    y: string;
    value: number;
  }>;
  scale: {
    min: number;
    max: number;
  };
}

export interface GaugeData {
  label: string;
  value: number;
  min: number;
  max: number;
  thresholds: {
    green: number;
    yellow: number;
    red: number;
  };
}

// Service interface for analytics operations
export interface IAnalyticsService {
  getProgressAnalytics(request: ProgressAnalyticsRequest): Promise<ProgressAnalyticsResponse>;
  calculateProgressOverview(userId?: string): Promise<ProgressOverview>;
  generateProgressTrends(timeframe: string, userId?: string): Promise<ProgressTrends>;
  analyzeCompetencies(userId?: string): Promise<CompetencyAnalytics>;
  getHistoricalPerformance(startDate: string, endDate: string, userId?: string): Promise<HistoricalPerformance[]>;
  generateLearningInsights(userId?: string): Promise<LearningInsights>;
  prepareVisualizationData(analyticsData: any): Promise<VisualizationData>;
  getSessionAnalytics(sessionId: string): Promise<any>;
  getPerformanceAnalytics(params: any): Promise<any>;
}

// Repository interface for analytics data persistence
export interface IAnalyticsRepository {
  getCompletedSessions(filters: SessionAnalyticsFilters): Promise<SessionAnalyticsData[]>;
  getUserProgressData(userId?: string): Promise<UserProgressData[]>;
  getTopicPerformanceHistory(topicIds: string[], userId?: string): Promise<TopicPerformanceHistory[]>;
  calculateTrendData(metric: string, timeframe: string, userId?: string): Promise<TrendData[]>;
  saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void>;
  getAnalyticsSnapshot(userId?: string): Promise<AnalyticsSnapshot | null>;
  getSessionDetails(sessionId: string): Promise<any>;
  getPerformanceData(params: any): Promise<any>;
}

export interface SessionAnalyticsFilters {
  userId?: string;
  providerId?: string;
  examId?: string;
  topics?: string[];
  startDate?: string;
  endDate?: string;
  status?: 'completed';
  limit?: number;
  offset?: number;
}

export interface SessionAnalyticsData {
  sessionId: string;
  userId?: string;
  providerId: string;
  examId: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  score: number;
  questions: QuestionAnalyticsData[];
  topicBreakdown: SessionTopicAnalyticsData[];
}

export interface QuestionAnalyticsData {
  questionId: string;
  topicId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCorrect: boolean;
  timeSpent: number; // seconds
  userAnswer: string[];
  correctAnswer: string[];
  skipped: boolean;
  markedForReview: boolean;
}

export interface SessionTopicAnalyticsData {
  topicId: string;
  topicName: string;
  questionsTotal: number;
  questionsAnswered: number;
  questionsCorrect: number;
  accuracy: number;
  averageTime: number; // seconds
  totalScore: number;
}

export interface UserProgressData {
  userId: string;
  topicId: string;
  examId: string;
  providerId: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  averageTimePerQuestion: number; // seconds
  lastStudiedAt: string;
  masteryLevel: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicPerformanceHistory {
  topicId: string;
  date: string; // YYYY-MM-DD
  accuracy: number;
  questionsAnswered: number;
  averageTime: number; // seconds
  masteryLevel: string;
}

export interface AnalyticsSnapshot {
  userId: string;
  snapshotDate: string;
  overview: ProgressOverview;
  competencies: TopicCompetency[];
  insights: LearningInsights;
  calculatedAt: string;
  version: string;
}