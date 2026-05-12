import React from 'react';

const DashboardGlyph = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="3" width="8" height="6" rx="1.8" stroke="currentColor" strokeWidth="2" />
    <rect x="13" y="3" width="8" height="10" rx="1.8" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="11" width="8" height="10" rx="1.8" stroke="currentColor" strokeWidth="2" />
    <rect x="13" y="15" width="8" height="6" rx="1.8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export default DashboardGlyph;
