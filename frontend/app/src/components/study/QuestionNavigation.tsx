import React from 'react'

interface QuestionNavigationProps {
  className?: string
}

export const QuestionNavigation: React.FC<QuestionNavigationProps> = ({ className = '' }) => {
  return (
    <div className={`QuestionNavigation ${className}`}>
      {/* TODO: Implement QuestionNavigation */}
    </div>
  )
}
