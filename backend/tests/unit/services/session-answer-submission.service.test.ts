// Unit tests for Session Answer Submission - Phase 20
// Tests the submitAnswer method in SessionService

import { SessionService } from '../../../src/services/session.service';
import { SubmitAnswerRequest, SubmitAnswerResponse } from '../../../src/shared/types/session.types';
import { StudySession } from '../../../src/shared/types/domain.types';

// Mock dependencies
const mockSessionRepository = {
  findById: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn()
};

const mockProviderService = {
  getProvider: jest.fn()
};

const mockExamService = {
  getExam: jest.fn()
};

const mockTopicService = {
  getTopic: jest.fn()
};

const mockQuestionService = {
  getQuestion: jest.fn(),
  getQuestions: jest.fn()
};

describe('SessionService - Answer Submission (Phase 20)', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService(
      mockSessionRepository as any,
      mockProviderService as any,
      mockExamService as any,
      mockTopicService as any,
      mockQuestionService as any
    );

    jest.clearAllMocks();
  });

  describe('submitAnswer', () => {
    const mockSession: StudySession = {
      sessionId: 'test-session-id',
      examId: 'saa-c03',
      providerId: 'aws',
      startTime: '2024-01-01T00:00:00Z',
      status: 'active',
      questions: [
        {
          questionId: 'question-1',
          correctAnswer: ['A'],
          timeSpent: 0,
          skipped: false,
          markedForReview: false
        }
      ],
      currentQuestionIndex: 0,
      totalQuestions: 1,
      correctAnswers: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const mockQuestionDetails = {
      questionId: 'question-1',
      providerId: 'aws',
      examId: 'saa-c03',
      topicId: 'compute',
      questionText: 'Test question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: ['A'],
      explanation: 'This is the correct answer because...',
      difficulty: 'medium',
      tags: ['test']
    };

    it('should submit correct answer successfully', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['A'],
        timeSpent: 60,
        skipped: false,
        markedForReview: false
      };

      const updatedSession = {
        ...mockSession,
        questions: [
          {
            ...mockSession.questions[0],
            userAnswer: ['A'],
            isCorrect: true,
            timeSpent: 60,
            answeredAt: expect.any(String)
          }
        ],
        correctAnswers: 1,
        updatedAt: expect.any(String)
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: mockQuestionDetails });
      mockSessionRepository.update.mockResolvedValue(updatedSession);

      const result = await sessionService.submitAnswer('test-session-id', request);

      expect(result.success).toBe(true);
      expect(result.feedback.isCorrect).toBe(true);
      expect(result.feedback.correctAnswer).toEqual(['A']);
      expect(result.feedback.userAnswer).toEqual(['A']);
      expect(result.feedback.explanation).toBe('This is the correct answer because...');
      expect(result.feedback.score).toBeGreaterThan(0);
      expect(result.session.correctAnswers).toBe(1);
      expect(result.progress.accuracy).toBeGreaterThan(0);
    });

    it('should submit incorrect answer successfully', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['B'],
        timeSpent: 45,
        skipped: false,
        markedForReview: false
      };

      const updatedSession = {
        ...mockSession,
        questions: [
          {
            ...mockSession.questions[0],
            userAnswer: ['B'],
            isCorrect: false,
            timeSpent: 45,
            answeredAt: expect.any(String)
          }
        ],
        correctAnswers: 0,
        updatedAt: expect.any(String)
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: mockQuestionDetails });
      mockSessionRepository.update.mockResolvedValue(updatedSession);

      const result = await sessionService.submitAnswer('test-session-id', request);

      expect(result.success).toBe(true);
      expect(result.feedback.isCorrect).toBe(false);
      expect(result.feedback.correctAnswer).toEqual(['A']);
      expect(result.feedback.userAnswer).toEqual(['B']);
      expect(result.feedback.score).toBe(0);
      expect(result.session.correctAnswers).toBe(0);
    });

    it('should handle skipped answers', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['C'],
        timeSpent: 10,
        skipped: true,
        markedForReview: false
      };

      const updatedSession = {
        ...mockSession,
        questions: [
          {
            ...mockSession.questions[0],
            userAnswer: ['C'],
            isCorrect: false,
            timeSpent: 10,
            skipped: true,
            answeredAt: expect.any(String)
          }
        ],
        correctAnswers: 0,
        updatedAt: expect.any(String)
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: mockQuestionDetails });
      mockSessionRepository.update.mockResolvedValue(updatedSession);

      const result = await sessionService.submitAnswer('test-session-id', request);

      expect(result.success).toBe(true);
      expect(result.session.questions[0].skipped).toBe(true);
    });

    it('should handle marked for review answers', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['A'],
        timeSpent: 120,
        skipped: false,
        markedForReview: true
      };

      const updatedSession = {
        ...mockSession,
        questions: [
          {
            ...mockSession.questions[0],
            userAnswer: ['A'],
            isCorrect: true,
            timeSpent: 120,
            markedForReview: true,
            answeredAt: expect.any(String)
          }
        ],
        correctAnswers: 1,
        updatedAt: expect.any(String)
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: mockQuestionDetails });
      mockSessionRepository.update.mockResolvedValue(updatedSession);

      const result = await sessionService.submitAnswer('test-session-id', request);

      expect(result.success).toBe(true);
      expect(result.session.questions[0].markedForReview).toBe(true);
    });

    it('should throw error for non-existent session', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['A'],
        timeSpent: 60
      };

      mockSessionRepository.findById.mockResolvedValue(null);

      await expect(sessionService.submitAnswer('non-existent-session', request))
        .rejects.toThrow('Session not found');
    });

    it('should throw error for inactive session', async () => {
      const inactiveSession = { ...mockSession, status: 'completed' as const };
      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['A'],
        timeSpent: 60
      };

      mockSessionRepository.findById.mockResolvedValue(inactiveSession);

      await expect(sessionService.submitAnswer('test-session-id', request))
        .rejects.toThrow('Cannot submit answers to inactive session');
    });

    it('should throw error for question not in session', async () => {
      const request: SubmitAnswerRequest = {
        questionId: 'non-existent-question',
        answer: ['A'],
        timeSpent: 60
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);

      await expect(sessionService.submitAnswer('test-session-id', request))
        .rejects.toThrow('Question not found in session');
    });

    it('should calculate score correctly based on difficulty and time', async () => {
      // Test different difficulty levels and time scenarios
      const easyQuestion = { ...mockQuestionDetails, difficulty: 'easy' };
      const hardQuestion = { ...mockQuestionDetails, difficulty: 'hard' };

      const request: SubmitAnswerRequest = {
        questionId: 'question-1',
        answer: ['A'],
        timeSpent: 30, // Fast answer
        skipped: false,
        markedForReview: false
      };

      // Test easy question with fast answer
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: easyQuestion });
      mockSessionRepository.update.mockResolvedValue(mockSession);

      let result = await sessionService.submitAnswer('test-session-id', request);
      const easyScore = result.feedback.score;

      // Test hard question with fast answer
      mockQuestionService.getQuestion.mockResolvedValue({ question: hardQuestion });
      result = await sessionService.submitAnswer('test-session-id', request);
      const hardScore = result.feedback.score;

      // Hard questions should have higher base score
      expect(hardScore).toBeGreaterThan(easyScore);
      expect(easyScore).toBeGreaterThan(0);
      expect(hardScore).toBeGreaterThan(0);
    });
  });
});