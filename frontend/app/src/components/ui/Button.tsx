import React from 'react'

interface ButtonProps {
  children?: React.ReactNode
  className?: string
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`button ${className}`}>
      {children}
    </div>
  )
}
