import React from 'react'

interface ProgressIndicatorProps {
  className?: string
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ className = '' }) => {
  return (
    <div className={`ProgressIndicator ${className}`}>
      {/* TODO: Implement ProgressIndicator */}
    </div>
  )
}
