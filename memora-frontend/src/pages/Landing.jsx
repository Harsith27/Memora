import React from 'react';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

const Landing = () => {
  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <motion.div
          className="flex items-center space-x-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Logo size="sm" className="text-white" />
          <span className="text-lg font-medium">Memora</span>
        </motion.div>

        <motion.div
          className="flex items-center space-x-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
            Docs
          </a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
            Pricing
          </a>
          <button className="text-gray-400 hover:text-white transition-colors text-sm">
            Sign In
          </button>
          <button className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
            Sign Up
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32">
        <motion.div
          className="text-center max-w-4xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight">
            Sets Your Memory in{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Motion
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Memora provides intelligent spaced repetition algorithms and personalized
            memory retention scoring to build, scale, and optimize your learning.
          </p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <button className="bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors">
              Start Learning
            </button>
            <button className="text-gray-400 hover:text-white transition-colors px-6 py-3">
              Get a Demo
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-6 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Neuro Engine Card */}
            <motion.div
              className="border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              <div className="mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-cyan-400 rounded mb-4"></div>
                <h3 className="text-2xl font-bold mb-2">Neuro Engine</h3>
                <p className="text-gray-400 leading-relaxed">
                  AI-powered spaced repetition algorithm that adapts to your learning patterns and optimizes retention.
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="text-green-400">$ memora analyze --pattern</div>
                <div className="text-gray-500 mt-1">Analyzing learning patterns...</div>
                <div className="text-blue-400 mt-1">✓ Optimal interval: 3.2 days</div>
              </div>
            </motion.div>

            {/* MemScore Card */}
            <motion.div
              className="border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
            >
              <div className="mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded mb-4"></div>
                <h3 className="text-2xl font-bold mb-2">MemScore</h3>
                <p className="text-gray-400 leading-relaxed">
                  Personalized memory retention scoring system for optimized learning performance tracking.
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Current MemScore</span>
                  <span className="text-2xl font-bold text-green-400">87</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-400 to-blue-400 h-2 rounded-full" style={{width: '87%'}}></div>
                </div>
              </div>
            </motion.div>

            {/* ReviseBy Card */}
            <motion.div
              className="border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <div className="mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-400 rounded mb-4"></div>
                <h3 className="text-2xl font-bold mb-2">ReviseBy</h3>
                <p className="text-gray-400 leading-relaxed">
                  Smart deadline management that prevents cramming and ensures optimal retention timing.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <span className="text-sm">React Hooks</span>
                  <span className="text-xs text-orange-400">Due in 2 days</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded">
                  <span className="text-sm">Database Design</span>
                  <span className="text-xs text-green-400">Completed</span>
                </div>
              </div>
            </motion.div>

            {/* Chronicle Card */}
            <motion.div
              className="border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.3 }}
            >
              <div className="mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-400 rounded mb-4"></div>
                <h3 className="text-2xl font-bold mb-2">Chronicle</h3>
                <p className="text-gray-400 leading-relaxed">
                  Visual calendar interface showing your learning journey and progress over time.
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({length: 21}).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-sm ${
                      Math.random() > 0.7 ? 'bg-blue-400' :
                      Math.random() > 0.5 ? 'bg-gray-700' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to optimize your learning?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Start building with a free account. Upgrade to Pro for advanced features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors">
              Start Learning
            </button>
            <button className="border border-gray-700 text-white px-6 py-3 rounded-md font-medium hover:border-gray-600 transition-colors">
              Talk to an Expert
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Logo size="sm" className="text-white" />
                <span className="font-medium">Memora</span>
              </div>
              <p className="text-gray-400 text-sm">
                Intelligent spaced repetition for optimized learning.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Product</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Features</a>
                <a href="#" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#" className="block hover:text-white transition-colors">Enterprise</a>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Resources</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Docs</a>
                <a href="#" className="block hover:text-white transition-colors">Guides</a>
                <a href="#" className="block hover:text-white transition-colors">Blog</a>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Company</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">About</a>
                <a href="#" className="block hover:text-white transition-colors">Contact</a>
                <a href="#" className="block hover:text-white transition-colors">Privacy</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© 2025 Memora. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">GitHub</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
