import React from 'react'

interface TooltipProps {
  children?: React.ReactNode
  className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`tooltip ${className}`}>
      {children}
    </div>
  )
}
