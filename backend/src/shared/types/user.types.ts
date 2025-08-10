// User domain types and interfaces

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  defaultProvider?: string;
  studyReminderEmail?: boolean;
  progressEmailFrequency?: 'daily' | 'weekly' | 'monthly' | 'never';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  preferences?: UserPreferences;
}

// Validation schemas using Zod (future enhancement)
export interface UserValidationRules {
  email: {
    required: true;
    format: 'email';
    maxLength: 255;
  };
  password: {
    required: true;
    minLength: 8;
    maxLength: 128;
    pattern: string; // Will include complexity requirements
  };
  firstName: {
    required: true;
    minLength: 1;
    maxLength: 50;
    pattern: string; // Alphabetic characters and basic punctuation
  };
  lastName: {
    required: true;
    minLength: 1;
    maxLength: 50;
    pattern: string; // Alphabetic characters and basic punctuation
  };
}