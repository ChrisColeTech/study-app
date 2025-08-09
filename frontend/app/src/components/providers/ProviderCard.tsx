import React from 'react'

interface ProviderCardProps {
  className?: string
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ className = '' }) => {
  return (
    <div className={`ProviderCard ${className}`}>
      {/* TODO: Implement ProviderCard */}
    </div>
  )
}
