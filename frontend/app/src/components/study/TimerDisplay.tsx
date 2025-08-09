import React from 'react'

interface TimerDisplayProps {
  className?: string
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ className = '' }) => {
  return (
    <div className={`TimerDisplay ${className}`}>
      {/* TODO: Implement TimerDisplay */}
    </div>
  )
}
