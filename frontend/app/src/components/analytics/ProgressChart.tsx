import React from 'react'

interface ProgressChartProps {
  className?: string
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ className = '' }) => {
  return (
    <div className={`ProgressChart ${className}`}>
      {/* TODO: Implement ProgressChart */}
    </div>
  )
}
