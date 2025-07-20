import React from 'react';

const Logo = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="currentColor"
      >
        {/* M Logo - Sharp geometric design */}
        <path
          d="M15 85 L15 15 L30 15 L50 45 L70 15 L85 15 L85 85 L70 85 L70 35 L55 60 L45 60 L30 35 L30 85 Z"
          className="fill-current"
        />
      </svg>
    </div>
  );
};

export default Logo;
