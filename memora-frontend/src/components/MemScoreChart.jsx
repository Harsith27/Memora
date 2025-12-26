import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MemScoreChart = ({ data = [], currentScore = 0 }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Only use real data - no dummy data
  const chartData = useMemo(() => {
    if (data.length > 0) return data;

    // If no data and no current score, return empty
    if (!currentScore || currentScore === 0) return [];

    // If we have a current score but no historical data, show just today's point
    const today = new Date();
    return [{
      date: today.toISOString().split('T')[0],
      score: currentScore, // Use the score as-is, no division needed
      label: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }];
  }, [data, currentScore]);

  // Chart dimensions
  const width = 300;
  const height = 120;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate scales (now working with 0-10 scale)
  const maxScore = Math.max(...chartData.map(d => d.score), 10);
  const minScore = Math.min(...chartData.map(d => d.score), 0);
  const scoreRange = maxScore - minScore || 1;

  // Generate path for the line
  const pathData = chartData.map((point, index) => {
    const x = padding + (index / (chartData.length - 1)) * chartWidth;
    const y = padding + ((maxScore - point.score) / scoreRange) * chartHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate gradient path for area under curve
  const areaPath = pathData + 
    ` L ${padding + chartWidth} ${padding + chartHeight}` +
    ` L ${padding} ${padding + chartHeight} Z`;

  // Calculate trend
  const firstScore = chartData[0]?.score || 0;
  const lastScore = chartData[chartData.length - 1]?.score || 0;
  const trend = lastScore - firstScore;
  const trendPercentage = firstScore > 0 ? ((trend / firstScore) * 100).toFixed(1) : 0;

  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (trend > 0) return 'text-green-400';
    if (trend < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  // Don't render if no data
  if (chartData.length === 0) {
    return (
      <div className="bg-black border border-white/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">MemScore Trend</h3>
        <div className="h-32 bg-gray-900/50 rounded-lg flex items-center justify-center border border-white/10">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">No data yet</p>
            <p className="text-gray-500 text-xs">Complete your evaluation or study sessions to see your progress</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-white/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">MemScore Trend</h3>
        {chartData.length > 1 && (
          <div className="flex items-center space-x-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {trend > 0 ? '+' : ''}{trend} ({trend > 0 ? '+' : ''}{trendPercentage}%)
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Grid lines */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Horizontal grid lines */}
          {[0, 2.5, 5, 7.5, 10].map(score => {
            const y = padding + ((maxScore - score) / scoreRange) * chartHeight;
            return (
              <line
                key={score}
                x1={padding}
                y1={y}
                x2={padding + chartWidth}
                y2={y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            );
          })}

          {/* Area under curve */}
          <path
            d={areaPath}
            fill="url(#scoreGradient)"
          />

          {/* Main line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.map((point, index) => {
            const x = padding + (index / (chartData.length - 1)) * chartWidth;
            const y = padding + ((maxScore - point.score) / scoreRange) * chartHeight;
            
            return (
              <motion.circle
                key={index}
                cx={x}
                cy={y}
                r={hoveredPoint === index ? 4 : 3}
                fill="#3B82F6"
                stroke="#1E293B"
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
                whileHover={{ scale: 1.2 }}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bg-gray-900 border border-white/20 rounded-lg p-2 pointer-events-none z-10"
            style={{
              left: padding + (hoveredPoint / (chartData.length - 1)) * chartWidth - 30,
              top: -10,
              transform: 'translateY(-100%)'
            }}
          >
            <div className="text-xs text-white font-medium">
              Score: {chartData[hoveredPoint]?.score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-400">
              {chartData[hoveredPoint]?.label}
            </div>
          </motion.div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="text-center p-2 rounded-lg hover:bg-blue-500/10 transition-colors duration-200">
          <motion.div
            className="text-lg font-semibold text-blue-400"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {lastScore.toFixed(1)}
          </motion.div>
          <div className="text-xs text-gray-400">Current</div>
        </div>
        <div className="text-center p-2 rounded-lg hover:bg-green-500/10 transition-colors duration-200">
          <motion.div
            className="text-lg font-semibold text-green-400"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {Math.max(...chartData.map(d => d.score)).toFixed(1)}
          </motion.div>
          <div className="text-xs text-gray-400">Peak</div>
        </div>
        <div className="text-center p-2 rounded-lg hover:bg-purple-500/10 transition-colors duration-200">
          <motion.div
            className="text-lg font-semibold text-purple-400"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length).toFixed(1)}
          </motion.div>
          <div className="text-xs text-gray-400">Average</div>
        </div>
      </div>
    </div>
  );
};

export default MemScoreChart;
