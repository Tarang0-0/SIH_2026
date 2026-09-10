'use client';

import React from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  glareOpacity?: number;
  allowOverflow?: boolean;
}

export default function TiltCard({
  children,
  className = '',
  allowOverflow = false,
}: TiltCardProps) {
  return (
    <div
      className={`relative ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} rounded-2xl transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

