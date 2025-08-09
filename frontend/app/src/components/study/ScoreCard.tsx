import React from 'react'

interface ScoreCardProps {
  className?: string
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ className = '' }) => {
  return (
    <div className={`ScoreCard ${className}`}>
      {/* TODO: Implement ScoreCard */}
    </div>
  )
}
