import React from 'react';
import logoImg from '../assets/logo.jpg';
import logoBlackOutline from '../assets/logoblackoutline.png';

const Logo = ({ size = 'md', className = '', variant = 'default' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const logoSrc = variant === 'blackOutline' ? logoBlackOutline : logoImg;

  return (
    <div className={`${sizeClasses[size]} ${className} rounded-lg overflow-hidden`}>
      <img
        src={logoSrc}
        alt="Memora Logo"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default Logo;
