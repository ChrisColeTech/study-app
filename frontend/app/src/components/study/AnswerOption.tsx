import React from 'react'

interface AnswerOptionProps {
  className?: string
}

export const AnswerOption: React.FC<AnswerOptionProps> = ({ className = '' }) => {
  return (
    <div className={`AnswerOption ${className}`}>
      {/* TODO: Implement AnswerOption */}
    </div>
  )
}
