import React from 'react'

interface ExamProgressProps {
  className?: string
}

export const ExamProgress: React.FC<ExamProgressProps> = ({ className = '' }) => {
  return (
    <div className={`ExamProgress ${className}`}>
      {/* TODO: Implement ExamProgress */}
    </div>
  )
}
