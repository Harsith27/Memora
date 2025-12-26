import { useState } from 'react';
import { motion } from 'framer-motion';

const SimpleBarChart = ({ 
  data = [], 
  title = "Chart", 
  xKey = "label", 
  yKey = "value",
  color = "#3B82F6",
  height = 200,
  showValues = true,
  formatValue = (value) => value
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);

  if (!data.length) {
    return (
      <div className="bg-black border border-white/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className={`bg-gray-900/50 rounded-lg flex items-center justify-center border border-white/10`} style={{ height }}>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">No data available</p>
            <p className="text-gray-500 text-xs">Data will appear here once available</p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item[yKey]));
  const chartHeight = height - 60; // Leave space for labels

  return (
    <div className="bg-black border border-white/20 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      
      <div className="relative" style={{ height }}>
        <div className="flex items-end justify-between h-full space-x-2">
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item[yKey] / maxValue) * chartHeight : 0;
            const isHovered = hoveredBar === index;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                {/* Bar */}
                <div className="relative flex-1 flex items-end w-full">
                  <motion.div
                    className="w-full rounded-t-md cursor-pointer relative"
                    style={{ 
                      backgroundColor: color,
                      height: barHeight,
                      opacity: isHovered ? 1 : 0.8
                    }}
                    onMouseEnter={() => setHoveredBar(index)}
                    onMouseLeave={() => setHoveredBar(null)}
                    whileHover={{ scale: 1.05 }}
                    initial={{ height: 0 }}
                    animate={{ height: barHeight }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    {/* Value label on hover */}
                    {isHovered && showValues && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-white/20 rounded px-2 py-1 text-xs text-white font-medium whitespace-nowrap z-10"
                      >
                        {formatValue(item[yKey])}
                      </motion.div>
                    )}
                  </motion.div>
                </div>
                
                {/* Label */}
                <div className="mt-2 text-xs text-gray-400 text-center w-full truncate">
                  {item[xKey]}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue(maxValue * 0.75)}</span>
          <span>{formatValue(maxValue * 0.5)}</span>
          <span>{formatValue(maxValue * 0.25)}</span>
          <span>0</span>
        </div>
      </div>
      
      {/* Summary stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-400">
              {formatValue(Math.max(...data.map(item => item[yKey])))}
            </div>
            <div className="text-xs text-gray-400">Peak</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-400">
              {formatValue(data.reduce((sum, item) => sum + item[yKey], 0) / data.length)}
            </div>
            <div className="text-xs text-gray-400">Average</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-400">
              {formatValue(data.reduce((sum, item) => sum + item[yKey], 0))}
            </div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleBarChart;
