import React from 'react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';
import CyberGrid from '../components/CyberGrid';

const Landing = () => {
  const features = [
    {
      name: 'Neuro Engine',
      description: 'AI-powered spaced repetition algorithm that adapts to your learning patterns',
      icon: '🧠'
    },
    {
      name: 'MemScore',
      description: 'Personalized memory retention scoring system for optimized learning',
      icon: '🎯'
    },
    {
      name: 'ReviseBy',
      description: 'Smart deadline management that prevents cramming and ensures retention',
      icon: '🚩'
    },
    {
      name: 'Chronicle',
      description: 'Visual calendar interface showing your learning journey and progress',
      icon: '📅'
    }
  ];

  return (
    <div className="min-h-screen bg-cyber-black text-cyber-white relative overflow-hidden">
      {/* Animated Background Grid */}
      <CyberGrid />
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6">
        <motion.div 
          className="flex items-center space-x-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Logo size="md" className="text-cyber-blue" />
          <span className="text-xl font-cyber font-semibold">Memora</span>
        </motion.div>
        
        <motion.div 
          className="flex space-x-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <button className="px-4 py-2 text-cyber-white hover:text-cyber-blue transition-colors font-mono">
            Sign In
          </button>
          <button className="cyber-button">
            Sign Up
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
        <motion.div
          className="text-center max-w-4xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-6xl md:text-8xl font-cyber font-bold mb-6 leading-tight">
            <span className="neon-text text-cyber-blue">Sets Your</span>
            <br />
            <span className="text-cyber-white">Memory in</span>
            <br />
            <span className="neon-text text-cyber-green terminal-cursor">Motion</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-cyber-light mb-12 font-mono max-w-2xl mx-auto">
            Intelligent spaced repetition powered by neural algorithms. 
            Optimize your learning with personalized memory retention scoring.
          </p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <button className="cyber-button text-lg px-8 py-4">
              Start Learning
            </button>
            <button className="px-8 py-4 text-cyber-white border border-cyber-light hover:border-cyber-blue transition-colors font-mono">
              Watch Demo
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Preview */}
      <section className="relative z-10 py-20 px-6">
        <motion.div
          className="max-w-6xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <h2 className="text-4xl font-cyber font-bold text-center mb-16 text-cyber-white">
            Neural <span className="text-cyber-blue">Learning</span> System
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                className="glass-panel p-6 hover:border-cyber-blue transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 + index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-cyber font-semibold mb-3 text-cyber-blue">
                  {feature.name}
                </h3>
                <p className="text-cyber-light font-mono text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyber-gray py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <Logo size="sm" className="text-cyber-blue" />
            <span className="font-cyber text-cyber-light">© 2025 Memora</span>
          </div>
          <div className="flex space-x-6 text-cyber-light font-mono text-sm">
            <a href="#" className="hover:text-cyber-blue transition-colors">Privacy</a>
            <a href="#" className="hover:text-cyber-blue transition-colors">Terms</a>
            <a href="#" className="hover:text-cyber-blue transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
