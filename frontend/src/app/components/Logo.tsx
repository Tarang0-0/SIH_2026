'use client';

import React from 'react';
import Image from 'next/image';

export interface LogoProps {
  variant?: 'icon' | 'horizontal' | 'full';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
  alt?: string;
}

export default function Logo({
  variant = 'icon',
  size = 'md',
  className = '',
  priority = false,
  alt = 'RailTrackr Logo',
}: LogoProps) {
  // Dimensions based on variant and size preset
  const getDimensions = () => {
    switch (variant) {
      case 'horizontal':
        switch (size) {
          case 'xs': return { width: 140, height: 26 };
          case 'sm': return { width: 180, height: 33 };
          case 'md': return { width: 220, height: 40 };
          case 'lg': return { width: 280, height: 51 };
          case 'xl': return { width: 360, height: 65 };
        }
        break;
      case 'full':
        switch (size) {
          case 'xs': return { width: 100, height: 53 };
          case 'sm': return { width: 140, height: 74 };
          case 'md': return { width: 180, height: 95 };
          case 'lg': return { width: 240, height: 126 };
          case 'xl': return { width: 320, height: 168 };
        }
        break;
      case 'icon':
      default:
        switch (size) {
          case 'xs': return { width: 24, height: 24 };
          case 'sm': return { width: 32, height: 32 };
          case 'md': return { width: 40, height: 40 };
          case 'lg': return { width: 56, height: 56 };
          case 'xl': return { width: 72, height: 72 };
        }
        break;
    }
  };

  const { width, height } = getDimensions();

  // Source paths for light and dark modes
  const lightSrc = 
    variant === 'horizontal' ? '/logo-horizontal-light.png' :
    variant === 'full' ? '/logo-full-light.png' :
    '/logo-icon-light.png';

  const darkSrc = 
    variant === 'horizontal' ? '/logo-horizontal-dark.png' :
    variant === 'full' ? '/logo-full-dark.png' :
    '/logo-icon-dark.png';

  return (
    <span className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}>
      {/* Light Mode Logo (hidden in dark mode) */}
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="w-auto h-auto max-w-full max-h-full object-contain dark:hidden transition-opacity duration-200"
      />
      {/* Dark Mode Logo (hidden in light mode) */}
      <Image
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="w-auto h-auto max-w-full max-h-full object-contain hidden dark:block transition-opacity duration-200"
      />
    </span>
  );
}
