import React, { Suspense } from 'react';

// This is a lazy-loaded chart components module for Analytics
// Reduces initial bundle size by code-splitting chart rendering logic

const ChartFallback = () => (
  <div className="h-56 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center">
    <p className="text-sm text-gray-400">Loading charts...</p>
  </div>
);

export const AnalyticsChartsWrapper = ({ children }) => (
  <Suspense fallback={<ChartFallback />}>
    {children}
  </Suspense>
);

export default AnalyticsChartsWrapper;
