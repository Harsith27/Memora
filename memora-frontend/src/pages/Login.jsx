import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '../components/Logo';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import FloatingParticles from '../components/FloatingParticles';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    clearError(); // Clear any previous auth errors

    try {
      const result = await login({
        email: formData.email,
        password: formData.password
      });

      if (result.success) {
        setIsSuccess(true);

        // Navigate based on evaluation status
        setTimeout(() => {
          if (result.user.hasCompletedEvaluation) {
            navigate('/dashboard');
          } else {
            navigate('/evaluation');
          }
        }, 1000);
      } else {
        setErrors({
          submit: result.error || 'Invalid email or password. Please try again.'
        });
      }

    } catch (error) {
      setErrors({
        submit: error.message || 'Login failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <PublicNavbar mode="login" />

      <div className="relative flex-1">
        <FloatingParticles count={14} sizeRange={[2, 6]} opacityRange={[0.1, 0.26]} />

        {/* Grid Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px'
          }}>
          </div>
        </div>

        {/* Plus signs at grid intersections */}
        <div className="absolute top-16 left-16 sm:top-32 sm:left-32 pointer-events-none">
          <div className="w-3 h-3 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
            <div className="absolute left-1/2 top-0 w-px h-full bg-white/30"></div>
          </div>
        </div>
        <div className="absolute top-24 right-12 sm:top-64 sm:right-64 pointer-events-none">
          <div className="w-3 h-3 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
            <div className="absolute left-1/2 top-0 w-px h-full bg-white/30"></div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 min-h-[calc(100vh-8rem)]">
          <motion.div
            className="max-w-md w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            <Link to="/" className="inline-flex items-center space-x-2 mb-6 hover:scale-105 transition-transform">
              <Logo size="md" className="text-white" />
              <span className="text-xl font-semibold">Memora</span>
            </Link>
            <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
            <p className="text-gray-400">Sign in to your account to continue learning</p>
          </motion.div>

          {/* Login Form */}
          <motion.div
            className="relative rounded-2xl border border-white/16 bg-[#090b13]/95 shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/55 p-8 backdrop-blur-md">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2.5 bg-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.email
                        ? 'border-red-400/50 focus:border-red-400'
                        : 'border-white/20 focus:border-white/40'
                    }`}
                    placeholder="Enter your email"
                  />
                  <AnimatePresence>
                    {errors.email && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center space-x-1 mt-1 text-red-400 text-xs"
                      >
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.email}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/40 transition-colors pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 bg-black border border-white/20 rounded focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">
                      Forgot your password?
                    </a>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  whileHover={{ scale: isLoading || isSuccess ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading || isSuccess ? 1 : 0.98 }}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center ${
                    isSuccess
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-black hover:bg-gray-100 disabled:opacity-50'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Welcome back!
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </motion.button>

                {/* Submit Error */}
                <AnimatePresence>
                  {errors.submit && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center space-x-2 text-red-400 text-sm mt-2"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.submit}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Sign up
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>

          </motion.div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

export default Login;
