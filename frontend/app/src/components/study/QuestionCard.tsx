import React from 'react'

interface QuestionCardProps {
  className?: string
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ className = '' }) => {
  return (
    <div className={`QuestionCard ${className}`}>
      {/* TODO: Implement QuestionCard */}
    </div>
  )
}
