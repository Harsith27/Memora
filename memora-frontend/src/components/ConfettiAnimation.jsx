import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfettiAnimation = ({ isVisible, duration = 3000, onComplete }) => {
  const [particles, setParticles] = useState([]);

  // Confetti emojis for celebration
  const confettiEmojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎈', '🎁', '🏆', '🥳', '🎯'];

  useEffect(() => {
    if (isVisible) {
      // Generate random confetti particles
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        emoji: confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)],
        initialX: Math.random() * window.innerWidth,
        initialY: -50,
        targetX: Math.random() * window.innerWidth,
        targetY: window.innerHeight + 100,
        rotation: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.4,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2
      }));
      
      setParticles(newParticles);

      // Auto-complete after duration
      const timer = setTimeout(() => {
        setParticles([]);
        if (onComplete) {
          onComplete();
        }
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [isVisible, duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute text-2xl select-none"
              initial={{
                x: particle.initialX,
                y: particle.initialY,
                rotate: 0,
                scale: 0,
                opacity: 0
              }}
              animate={{
                x: particle.targetX,
                y: particle.targetY,
                rotate: particle.rotation,
                scale: particle.scale,
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: "easeOut"
              }}
              style={{
                filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))'
              }}
            >
              {particle.emoji}
            </motion.div>
          ))}
          
          {/* Central burst effect */}
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="text-6xl">🎉</div>
          </motion.div>

          {/* Radiating circles */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`circle-${i}`}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-yellow-400/30 rounded-full"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ 
                scale: [0, 3, 4], 
                opacity: [0.8, 0.3, 0] 
              }}
              transition={{ 
                duration: 2, 
                delay: i * 0.2,
                ease: "easeOut" 
              }}
              style={{
                width: '100px',
                height: '100px'
              }}
            />
          ))}

          {/* Sparkle effects */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute text-yellow-300"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                fontSize: `${12 + Math.random() * 8}px`
              }}
              initial={{ scale: 0, opacity: 0, rotate: 0 }}
              animate={{ 
                scale: [0, 1, 0], 
                opacity: [0, 1, 0],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 1.5, 
                delay: Math.random() * 1,
                ease: "easeInOut" 
              }}
            >
              ✨
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfettiAnimation;
