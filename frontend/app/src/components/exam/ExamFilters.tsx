import React from 'react'

interface ExamFiltersProps {
  className?: string
}

export const ExamFilters: React.FC<ExamFiltersProps> = ({ className = '' }) => {
  return (
    <div className={`ExamFilters ${className}`}>
      {/* TODO: Implement ExamFilters */}
    </div>
  )
}
