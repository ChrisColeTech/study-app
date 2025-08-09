import React from 'react'

interface ExamDetailsProps {
  className?: string
}

export const ExamDetails: React.FC<ExamDetailsProps> = ({ className = '' }) => {
  return (
    <div className={`ExamDetails ${className}`}>
      {/* TODO: Implement ExamDetails */}
    </div>
  )
}
