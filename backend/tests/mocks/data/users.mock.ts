// Mock user data for testing

import { User } from '../../../src/shared/types/domain.types';

export const mockUsers: User[] = [
  {
    userId: 'user-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isActive: true,
    preferences: {
      studyMode: 'practice',
      difficulty: 'intermediate',
      timePerQuestion: 90,
      showExplanations: true,
      shuffleQuestions: true,
      shuffleAnswers: false,
    },
  },
  {
    userId: 'user-2',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isActive: true,
    preferences: {
      studyMode: 'exam',
      difficulty: 'advanced',
      timePerQuestion: 60,
      showExplanations: false,
      shuffleQuestions: false,
      shuffleAnswers: true,
    },
  },
  {
    userId: 'user-3',
    email: 'inactive.user@example.com',
    firstName: 'Inactive',
    lastName: 'User',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isActive: false,
    preferences: {
      studyMode: 'practice',
      difficulty: 'beginner',
      timePerQuestion: 120,
      showExplanations: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
    },
  },
];

export const mockUserResponse = {
  success: true,
  data: mockUsers[0],
  message: 'User retrieved successfully',
  timestamp: '2024-01-01T00:00:00.000Z',
  requestId: 'test-request-id',
};

export const mockUsersListResponse = {
  success: true,
  data: {
    items: mockUsers,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: mockUsers.length,
      itemsPerPage: 20,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  message: 'Users retrieved successfully',
  timestamp: '2024-01-01T00:00:00.000Z',
  requestId: 'test-request-id',
};