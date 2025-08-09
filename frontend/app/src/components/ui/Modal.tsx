import React from 'react'

interface ModalProps {
  children?: React.ReactNode
  className?: string
}

export const Modal: React.FC<ModalProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`modal ${className}`}>
      {children}
    </div>
  )
}
