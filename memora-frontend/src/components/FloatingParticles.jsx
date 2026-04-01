import React from 'react';
import { motion } from 'framer-motion';

function FloatingParticles({
  count = 14,
  color = '147, 197, 253',
  sizeRange = [2, 6],
  opacityRange = [0.12, 0.28],
}) {
  const minSize = Math.min(sizeRange[0], sizeRange[1]);
  const maxSize = Math.max(sizeRange[0], sizeRange[1]);
  const minOpacity = Math.min(opacityRange[0], opacityRange[1]);
  const maxOpacity = Math.max(opacityRange[0], opacityRange[1]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => {
        const size = Math.random() * (maxSize - minSize) + minSize;
        const opacity = Math.random() * (maxOpacity - minOpacity) + minOpacity;

        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: `rgba(${color}, ${opacity})`,
            }}
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            }}
            animate={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            }}
            transition={{
              duration: Math.random() * 18 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear',
            }}
          />
        );
      })}
    </div>
  );
}

export default FloatingParticles;
