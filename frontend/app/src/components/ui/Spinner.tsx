import React from 'react'

interface SpinnerProps {
  children?: React.ReactNode
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`spinner ${className}`}>
      {children}
    </div>
  )
}
