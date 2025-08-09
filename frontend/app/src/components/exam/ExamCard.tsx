import React from 'react'

interface ExamCardProps {
  className?: string
}

export const ExamCard: React.FC<ExamCardProps> = ({ className = '' }) => {
  return (
    <div className={`ExamCard ${className}`}>
      {/* TODO: Implement ExamCard */}
    </div>
  )
}
