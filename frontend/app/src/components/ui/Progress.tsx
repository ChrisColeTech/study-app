import React from 'react'

interface ProgressProps {
  children?: React.ReactNode
  className?: string
}

export const Progress: React.FC<ProgressProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`progress ${className}`}>
      {children}
    </div>
  )
}
