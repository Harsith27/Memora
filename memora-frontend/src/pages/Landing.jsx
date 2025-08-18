import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Target, Calendar, Flag, ChevronDown, Clock, FileText, Play, BarChart3, Zap, Users, Smartphone, LogOut } from 'lucide-react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Logo from '../components/Logo';
import logoImg from '../assets/logo.jpg';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { useAuth } from '../contexts/AuthContext';

// Floating Particles Component
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          transition={{
            duration: Math.random() * 15 + 10,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear"
          }}
        />
      ))}
      {/* Larger floating elements */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={`large-${i}`}
          className="absolute w-2 h-2 bg-purple-400/10 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{
            duration: Math.random() * 25 + 15,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

// Animated Section Component
const AnimatedSection = ({ children, className = "", delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

function Landing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // Stay on landing page after logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <motion.div
                className="flex items-center space-x-2 cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-8 h-8"
                >
                  <img
                    src={logoImg}
                    alt="Memora Logo"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </motion.div>
                <span className="font-semibold text-lg">Memora</span>
              </motion.div>
              <div className="hidden lg:flex items-center space-x-6">
                <a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Features
                </a>
                <a href="#pricing" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Pricing
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                // Authenticated user
                <div className="flex items-center space-x-4">
                  <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
                    Dashboard
                  </Link>
                  <UserProfileDropdown />
                </div>
              ) : (
                // Not authenticated
                <>
                  <Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm">Sign In</Link>
                  <Link to="/signup" className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Grid */}
      <div className="relative min-h-screen overflow-hidden">
        {/* Animated Gradient Background */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(600px circle at 0% 0%, rgba(120, 119, 198, 0.3), transparent 50%)",
              "radial-gradient(600px circle at 100% 100%, rgba(120, 119, 198, 0.3), transparent 50%)",
              "radial-gradient(600px circle at 0% 100%, rgba(120, 119, 198, 0.3), transparent 50%)",
              "radial-gradient(600px circle at 100% 0%, rgba(120, 119, 198, 0.3), transparent 50%)",
              "radial-gradient(600px circle at 0% 0%, rgba(120, 119, 198, 0.3), transparent 50%)"
            ]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Floating Particles */}
        <FloatingParticles />

        {/* Animated Grid Background */}
        <motion.div
          className="absolute inset-0 opacity-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 2 }}
        >
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}>
          </div>
        </motion.div>

        {/* Animated Plus signs at grid intersections */}
        <motion.div
          className="absolute top-32 left-32"
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: 1, rotate: 360 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <div className="w-3 h-3 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
            <div className="absolute left-1/2 top-0 w-px h-full bg-white/30"></div>
          </div>
        </motion.div>
        <motion.div
          className="absolute top-64 right-64"
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: 1, rotate: -360 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          <div className="w-3 h-3 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
            <div className="absolute left-1/2 top-0 w-px h-full bg-white/30"></div>
          </div>
        </motion.div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-10">
          <div className="text-center">
            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.span
                className="block"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Learn smarter, not harder with
              </motion.span>
              <motion.span
                className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                memory-powered learning.
              </motion.span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Master any subject with scientifically-proven spaced repetition. Transform how you learn,
              remember, and retain knowledge with personalized study schedules that adapt to your progress.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <motion.div
                whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/dashboard" className="bg-white text-black px-8 py-3 rounded-md font-medium hover:bg-gray-100 transition-all duration-300 flex items-center group">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut"
                    }}
                  >
                    <Logo size="sm" className="text-black mr-2" variant="blackOutline" />
                  </motion.div>
                  Start Learning Free
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
              <motion.button
                className="border border-white/20 text-white px-8 py-3 rounded-md font-medium hover:bg-white/5 transition-all duration-300"
                whileHover={{ scale: 1.05, borderColor: "rgba(255,255,255,0.4)" }}
                whileTap={{ scale: 0.95 }}
              >
                Get a Demo
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="relative">
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">

          {/* Neuro Engine Deep Dive Section */}
          <motion.div
            className="mt-16"
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
          >
            <div className="text-center mb-16">
              <motion.h2
                className="text-4xl font-bold mb-8"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: false }}
              >
                Powered by the Neuro Engine
              </motion.h2>
              <motion.p
                className="text-xl text-gray-400 max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: false }}
              >
                Our proprietary algorithm leverages the Ebbinghaus Forgetting Curve to optimize your learning schedule,
                ensuring maximum retention with minimal effort.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px">

              {/* Forgetting Curve Visualization */}
              <div className="relative border border-white/20 p-8 bg-black">
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <h3 className="text-xl font-bold mb-4">The Science Behind Spaced Repetition</h3>
                <p className="text-gray-400 text-sm mb-8">
                  Traditional learning wastes time. Our algorithm identifies the optimal moment to review,
                  just before you forget, maximizing retention efficiency.
                </p>

                {/* Forgetting curve chart */}
                <div className="relative h-48 mb-6">
                  <div className="absolute bottom-0 left-0 w-full h-px bg-white/20"></div>
                  <div className="absolute bottom-0 left-0 w-px h-full bg-white/20"></div>

                  {/* Traditional curve (declining) */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200">
                    <path d="M 20 40 Q 100 80 150 120 Q 200 150 280 170"
                          stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                    <text x="200" y="180" className="text-xs fill-red-400">Traditional Learning</text>
                  </svg>

                  {/* Spaced repetition curve (maintained) */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200">
                    <path d="M 20 40 Q 60 50 80 45 Q 120 55 140 50 Q 180 60 200 55 Q 240 65 280 60"
                          stroke="#22c55e" strokeWidth="2" fill="none" />
                    <text x="150" y="35" className="text-xs fill-green-400">Memora's Approach</text>
                  </svg>

                  {/* Review points */}
                  <div className="absolute bottom-8 left-20 w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="absolute bottom-6 left-32 w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="absolute bottom-5 left-48 w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="absolute bottom-4 left-64 w-2 h-2 bg-green-400 rounded-full"></div>
                </div>

                <div className="text-xs text-gray-500">
                  <div className="mb-1">Y-axis: Memory Retention</div>
                  <div>X-axis: Time</div>
                </div>
              </div>

              {/* Algorithm Features */}
              <div className="relative border border-white/20 p-8 bg-black">
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <h3 className="text-xl font-bold mb-6">Adaptive Intelligence</h3>

                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Personal Learning Patterns</h4>
                      <p className="text-gray-400 text-sm">Analyzes your response accuracy and timing to create a unique cognitive profile.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Dynamic Interval Adjustment</h4>
                      <p className="text-gray-400 text-sm">Automatically adjusts review intervals based on your performance and retention strength.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Difficulty Calibration</h4>
                      <p className="text-gray-400 text-sm">Identifies challenging concepts and increases review frequency to strengthen weak areas.</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Optimal Timing Prediction</h4>
                      <p className="text-gray-400 text-sm">Predicts the exact moment when memory begins to fade, scheduling reviews for maximum impact.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

          {/* Comprehensive Feature Showcase */}
          <motion.div
            id="features"
            className="mt-16"
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: false, margin: "-100px" }}
          >
            <div className="text-center mb-16">
              <motion.h2
                className="text-4xl font-bold mb-8"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: false }}
              >
                Your toolkit for accelerated learning.
              </motion.h2>
            </div>

            {/* First row of features */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-3 gap-px mb-px"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: false }}
            >

              {/* ReviseBy Feature */}
              <motion.div
                className="relative border border-white/20 p-8 bg-black group"
                initial={{ opacity: 0, y: 80, rotateX: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                viewport={{ once: false, margin: "-50px" }}
                whileHover={{
                  boxShadow: "0 15px 30px rgba(59, 130, 246, 0.2)",
                  borderColor: "rgba(59, 130, 246, 0.6)",
                  transition: { duration: 0.15 }
                }}
              >
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <div className="flex items-center mb-4">
                  <Clock className="w-5 h-5 text-blue-400 mr-2" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Smart Scheduling</span>
                </div>

                <h3 className="text-lg font-semibold mb-2">ReviseBy deadlines</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Automatically schedule optimal review sessions to prevent cramming and ensure long-term retention before critical deadlines.
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-white/10">
                    <span className="text-sm">Organic Chemistry</span>
                    <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">Due tomorrow</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-white/10">
                    <span className="text-sm">Statistics Final</span>
                    <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded">Review in 3 days</span>
                  </div>
                </div>

                <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300 group-hover:translate-x-1">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

              {/* DocTags Feature */}
              <motion.div
                className="relative border border-white/20 p-8 bg-black group"
                initial={{ opacity: 0, y: 80, rotateX: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                viewport={{ once: false, margin: "-50px" }}
                whileHover={{
                  boxShadow: "0 15px 30px rgba(34, 197, 94, 0.2)",
                  borderColor: "rgba(34, 197, 94, 0.6)",
                  transition: { duration: 0.15 }
                }}
              >
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <div className="flex items-center mb-4">
                  <FileText className="w-5 h-5 text-green-400 mr-2" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Organization</span>
                </div>

                <h3 className="text-lg font-semibold mb-2">DocTags management</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Attach PDFs, YouTube videos, and Google Drive files with intelligent tagging for instant organization and retrieval.
                </p>

                <div className="grid grid-cols-2 gap-2 mb-6">
                  <div className="p-3 bg-gray-900/50 rounded border border-white/10 text-center">
                    <FileText className="w-6 h-6 text-red-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">PDFs</div>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded border border-white/10 text-center">
                    <Play className="w-6 h-6 text-red-500 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">Videos</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Theory</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Practice</span>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Research</span>
                </div>

                <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Performance Analytics */}
              <motion.div
                className="relative border border-white/20 p-8 bg-black group"
                initial={{ opacity: 0, y: 80, rotateX: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                viewport={{ once: false, margin: "-50px" }}
                whileHover={{
                  boxShadow: "0 15px 30px rgba(168, 85, 247, 0.2)",
                  borderColor: "rgba(168, 85, 247, 0.6)",
                  transition: { duration: 0.15 }
                }}
              >
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <div className="flex items-center mb-4">
                  <BarChart3 className="w-5 h-5 text-purple-400 mr-2" />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Analytics</span>
                </div>

                <h3 className="text-lg font-semibold mb-2">Performance insights</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Track your learning velocity, retention rates, and identify knowledge gaps with detailed analytics and progress visualization.
                </p>

                {/* Mini chart */}
                <div className="h-16 mb-4 relative">
                  <div className="absolute bottom-0 left-0 w-full h-px bg-white/20"></div>
                  <div className="flex items-end justify-between h-full">
                    <div className="w-4 bg-blue-400 rounded-t" style={{height: '60%'}}></div>
                    <div className="w-4 bg-green-400 rounded-t" style={{height: '80%'}}></div>
                    <div className="w-4 bg-purple-400 rounded-t" style={{height: '45%'}}></div>
                    <div className="w-4 bg-orange-400 rounded-t" style={{height: '90%'}}></div>
                    <div className="w-4 bg-cyan-400 rounded-t" style={{height: '70%'}}></div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">94%</div>
                  <div className="text-xs text-gray-400">Average Retention</div>
                </div>

                <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300 mt-4">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

            </motion.div>

            {/* Second row of features */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-px"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              viewport={{ once: false }}
            >

              {/* Advanced Learning Features */}
              <motion.div
                className="relative border border-white/20 p-8 bg-black group"
                initial={{ opacity: 0, x: -80, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                viewport={{ once: false, margin: "-50px" }}
                whileHover={{
                  boxShadow: "0 12px 25px rgba(168, 85, 247, 0.2)",
                  borderColor: "rgba(168, 85, 247, 0.6)",
                  transition: { duration: 0.15 }
                }}
              >
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <h3 className="text-xl font-bold mb-6">Advanced learning capabilities</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 border border-white/10 rounded">
                    <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold">Quick Reviews</div>
                    <div className="text-xs text-gray-400">Micro-learning sessions</div>
                  </div>
                  <div className="text-center p-4 border border-white/10 rounded">
                    <Target className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold">Focus Mode</div>
                    <div className="text-xs text-gray-400">Distraction-free learning</div>
                  </div>
                  <div className="text-center p-4 border border-white/10 rounded">
                    <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold">Study Groups</div>
                    <div className="text-xs text-gray-400">Collaborative learning</div>
                  </div>
                  <div className="text-center p-4 border border-white/10 rounded">
                    <Smartphone className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold">Mobile Sync</div>
                    <div className="text-xs text-gray-400">Learn anywhere</div>
                  </div>
                </div>

                <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Integration Ecosystem */}
              <motion.div
                className="relative border border-white/20 p-8 bg-black group"
                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                viewport={{ once: false, margin: "-50px" }}
                whileHover={{
                  boxShadow: "0 12px 25px rgba(34, 197, 94, 0.2)",
                  borderColor: "rgba(34, 197, 94, 0.6)",
                  transition: { duration: 0.15 }
                }}
              >
                {/* Corner plus signs */}
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
                </div>

                <h3 className="text-xl font-bold mb-6">Seamless integrations</h3>
                <p className="text-gray-400 text-sm mb-8">
                  Connect with your existing workflow. Import from popular platforms and export your progress anywhere.
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-900/50 rounded border border-white/10">
                    <div className="w-8 h-8 bg-red-500 rounded mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">YT</span>
                    </div>
                    <div className="text-xs text-gray-400">YouTube</div>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded border border-white/10">
                    <div className="w-8 h-8 bg-blue-500 rounded mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">GD</span>
                    </div>
                    <div className="text-xs text-gray-400">Google Drive</div>
                  </div>
                  <div className="text-center p-3 bg-gray-900/50 rounded border border-white/10">
                    <div className="w-8 h-8 bg-purple-500 rounded mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">N</span>
                    </div>
                    <div className="text-xs text-gray-400">Notion</div>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-400 mb-4">
                  + 15 more integrations
                </div>

                <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>

            </motion.div>
          </motion.div>

          {/* Complex Feature Showcase - Vercel Style */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-px mt-px"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            viewport={{ once: false }}
          >

            {/* Neuro Engine Card */}
            <motion.div
              className="relative border border-white/20 p-8 bg-black group"
              initial={{ opacity: 0, y: 80, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              viewport={{ once: false, margin: "-50px" }}
              whileHover={{
                boxShadow: "0 15px 30px rgba(168, 85, 247, 0.2)",
                borderColor: "rgba(168, 85, 247, 0.6)",
                transition: { duration: 0.15 }
              }}
            >
              {/* Corner plus signs */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <div className="flex items-center mb-4">
                <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Intelligence</span>
              </div>

              <h3 className="text-xl font-bold mb-2">Neuro Engine</h3>
              <h4 className="text-lg text-gray-300 mb-4">powers your learning.</h4>

              <p className="text-gray-400 text-sm mb-8">
                AI-powered spaced repetition that adapts to your patterns.
              </p>

              {/* Visual representation */}
              <div className="relative h-32 mb-6">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  {/* Orbiting dots */}
                  <div className="absolute w-24 h-24 border border-white/10 rounded-full animate-spin" style={{animationDuration: '10s'}}>
                    <div className="absolute -top-1 left-1/2 w-2 h-2 bg-blue-400 rounded-full transform -translate-x-1/2"></div>
                  </div>
                  <div className="absolute w-32 h-32 border border-white/5 rounded-full animate-spin" style={{animationDuration: '15s', animationDirection: 'reverse'}}>
                    <div className="absolute -top-1 left-1/2 w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2"></div>
                  </div>
                </div>
              </div>

              <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* MemScore Analytics Card */}
            <motion.div
              className="relative border border-white/20 p-8 bg-black group"
              initial={{ opacity: 0, y: 80, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              viewport={{ once: false, margin: "-50px" }}
              whileHover={{
                boxShadow: "0 15px 30px rgba(34, 197, 94, 0.2)",
                borderColor: "rgba(34, 197, 94, 0.6)",
                transition: { duration: 0.15 }
              }}
            >
              {/* Corner plus signs */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <div className="space-y-6">
                {/* Header */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-2">Your Memory Intelligence</div>
                  <div className="text-2xl font-bold text-green-400 mb-1">MemScore</div>
                </div>

                {/* Main Score Display */}
                <div className="flex items-center justify-center space-x-6">
                  {/* Circular progress indicator */}
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="6" fill="none" className="text-gray-800" />
                      <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" className="text-green-400" strokeDasharray={`${9 * 1.5} 150`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-2xl font-bold text-green-400">9</div>
                    </div>
                  </div>

                  {/* Score Details */}
                  <div className="text-left">
                    <div className="text-sm text-gray-300 mb-1">Excellent Memory</div>
                    <div className="text-xs text-gray-400">Top 15% of learners</div>
                    <div className="flex items-center mt-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs text-green-400">Active Learning</span>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-lg font-bold text-blue-400">92%</div>
                    <div className="text-xs text-gray-400">Retention Rate</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-lg font-bold text-purple-400">2.3x</div>
                    <div className="text-xs text-gray-400">Learning Speed</div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Memory Strength</span>
                    <span className="text-xs text-green-400">Strong</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-green-500 to-green-400 h-1.5 rounded-full" style={{width: '90%'}}></div>
                  </div>
                </div>
              </div>

              <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300 mt-4">
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Chronicle Learning Journey Card */}
            <motion.div
              className="relative border border-white/20 p-8 bg-black group"
              initial={{ opacity: 0, y: 80, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              viewport={{ once: false, margin: "-50px" }}
              whileHover={{
                boxShadow: "0 15px 30px rgba(59, 130, 246, 0.2)",
                borderColor: "rgba(59, 130, 246, 0.6)",
                transition: { duration: 0.15 }
              }}
            >
              {/* Corner plus signs */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <div className="text-center mb-6">
                <Calendar className="w-8 h-8 text-white mx-auto mb-2" />
                <div className="text-xs text-gray-400">Chronicle</div>
              </div>

              {/* Grid pattern visualization */}
              <div className="grid grid-cols-5 gap-1 mb-6">
                {Array.from({length: 25}).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${
                    i < 15 ? 'bg-blue-400' :
                    i < 20 ? 'bg-green-400' :
                    'bg-gray-700'
                  }`}></div>
                ))}
              </div>

              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  <span>Completed Sessions</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  <span>Active Learning</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-700 rounded-full mr-2"></div>
                  <span>Upcoming</span>
                </div>
              </div>

              <button className="w-10 h-10 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300 mt-4">
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

          </motion.div>

        </div>
      </div>

      {/* Testimonials Section */}
      <motion.div
        className="relative py-20"
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: false, margin: "-100px" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-8">Trusted by learners worldwide</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              See how Memora has transformed the learning experience for students, professionals, and lifelong learners.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Testimonial 1 */}
            <div className="relative border border-white/20 p-8 bg-black rounded-lg">
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <blockquote className="text-lg text-gray-300 mb-6 leading-relaxed">
                "Switching to Memora transformed our medical school study group, reducing our collective study time from 6 hours daily to 2 hours while achieving 95% retention rates on board exams. The ReviseBy feature alone prevented three all-nighters before our anatomy final."
              </blockquote>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center overflow-hidden">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Sarah Chen</div>
                  <div className="text-gray-400 text-sm">4th Year Medical Student, Stanford University School of Medicine</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="relative border border-white/20 p-8 bg-black rounded-lg">
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <blockquote className="text-lg text-gray-300 mb-6 leading-relaxed">
                "As a software engineer preparing for technical interviews, Memora's algorithm helped me retain complex data structures and algorithms effortlessly. I landed my dream job at Google after just 3 months of consistent practice. The MemScore tracking kept me motivated throughout."
              </blockquote>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Marcus Rodriguez</div>
                  <div className="text-gray-400 text-sm">Senior Software Engineer, Google</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="relative border border-white/20 p-8 bg-black rounded-lg">
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <blockquote className="text-lg text-gray-300 mb-6 leading-relaxed">
                "Learning Mandarin seemed impossible until I discovered Memora. The DocTags feature let me organize video lessons, PDFs, and audio files seamlessly. After 8 months, I achieved HSK Level 4 proficiency. The Chronicle feature showed my incredible progress journey."
              </blockquote>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Aisha Patel</div>
                  <div className="text-gray-400 text-sm">International Business Consultant</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

      {/* Final CTA section */}
      <div className="relative py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}>
          </div>
        </div>

        <div id="pricing" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px">

            {/* Ready to learn */}
            <div className="relative border border-white/20 p-8">
              {/* Corner plus signs */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <h3 className="text-xl font-semibold mb-4">Ready to optimize your learning?</h3>
              <p className="text-gray-400 mb-8">Start building with a free account. Upgrade to Pro for advanced analytics and team features.</p>

              <div className="space-y-4">
                <button className="w-full bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors">
                  Start Learning
                </button>
                <button className="w-full border border-white/20 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors">
                  Talk to an Expert
                </button>
              </div>
            </div>

            {/* Explore Memora Pro */}
            <div className="relative border border-white/20 p-8">
              {/* Corner plus signs */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/40"></div>
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/40"></div>
              </div>

              <h3 className="text-xl font-semibold mb-4">Explore Memora Pro</h3>
              <p className="text-gray-400 mb-8">with enhanced analytics, team collaboration, and priority support for serious learners.</p>

              <button className="border border-white/20 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors">
                Explore Pro Features
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Logo size="sm" className="text-white" />
                <span className="font-semibold">Memora</span>
              </div>
              <p className="text-gray-400 text-sm">
                Intelligent spaced repetition for optimized learning and memory retention.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Features</a>
                <a href="#" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#" className="block hover:text-white transition-colors">Enterprise</a>
                <a href="#" className="block hover:text-white transition-colors">API</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Resources</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Docs</a>
                <a href="#" className="block hover:text-white transition-colors">Guides</a>
                <a href="#" className="block hover:text-white transition-colors">Blog</a>
                <a href="#" className="block hover:text-white transition-colors">Community</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">About</a>
                <a href="#" className="block hover:text-white transition-colors">Contact</a>
                <a href="#" className="block hover:text-white transition-colors">Privacy</a>
                <a href="#" className="block hover:text-white transition-colors">Terms</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
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
}

export default Landing;
