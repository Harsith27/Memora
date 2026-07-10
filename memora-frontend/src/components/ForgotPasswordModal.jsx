import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import apiService from '../services/api';

function ForgotPasswordModal({ isOpen, onClose, initialEmail = '', onResetSuccess, inline = false }) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sendCooldown, setSendCooldown] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    setStep('request');
    setEmail(initialEmail || '');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSendCode = async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await apiService.requestPasswordReset(email);
      if (!response?.success) {
        setErrorMessage(response?.message || 'Unable to send reset code right now.');
        return;
      }

      if (response.resetCode) {
        setCode(response.resetCode);
      }

      setSuccessMessage(response.message || (response.resetCode ? 'Reset code generated. Use the code shown below.' : 'Reset code sent. Please check your email.'));
      // keep on the request step so user can enter the code in the inline field
      setSendCooldown(60);
      // start countdown
      const interval = setInterval(() => {
        setSendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to send reset code right now. Ensure backend is running and VITE_API_URL is configured.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await apiService.verifyResetCode({ email, code });
      if (!response?.success) {
        setErrorMessage(response?.message || 'Invalid or expired reset code.');
        return;
      }

      setStep('reset');
      setSuccessMessage('Code verified. Enter a new password.');
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to verify reset code right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await apiService.resetPasswordWithCode({
        email,
        code,
        newPassword
      });

      if (!response?.success) {
        setErrorMessage(response?.message || 'Unable to reset password.');
        return;
      }

      setSuccessMessage(response.message || 'Password reset successful.');
      if (typeof onResetSuccess === 'function') {
        onResetSuccess(email);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const card = (
    <div className="w-full rounded-2xl border border-white/12 bg-black shadow-[0_18px_42px_rgba(0,0,0,0.65)]" aria-live="polite">
      <div className="flex items-start justify-between border-b border-white/10 p-5 sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Forgot Password</h3>
          <p className="mt-1 text-sm text-gray-400">
            {step === 'request' ? 'Get your 6-digit reset code.' : 'Enter code and choose a new password.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/10 p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black p-5 sm:p-8 backdrop-blur-md">
        {step === 'request' ? (
          <form onSubmit={handleSendCode} className="space-y-5 sm:space-y-6" aria-label="Request reset code">
            <div>
              <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-gray-300">
                Account email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-3 py-2.5 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="inline-code" className="mb-2 block text-sm font-medium text-gray-300">
                6-digit code
              </label>
              <input
                id="inline-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                className="w-full px-3 py-2.5 bg-black border border-white/20 rounded-lg text-white tracking-[0.35em] placeholder-gray-500 focus:outline-none focus:border-white/50 transition-colors text-center"
                placeholder="000000"
              />

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isLoading || !email || sendCooldown > 0}
                  aria-label="Send reset code"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-cyan-400/30 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
                >
                  {sendCooldown > 0 ? `Sent (${sendCooldown}s)` : (isLoading ? 'Sending…' : 'Send code')}
                </button>

                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isLoading || code.length !== 6}
                  aria-label="Verify code"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-cyan-400/30 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
                >
                  Verify
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              <span>We will send a 6-digit code to your email. Check spam if you don't see it.</span>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5 sm:space-y-6" autoComplete="off">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-300">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full px-3 py-2.5 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/50 transition-colors"
                placeholder="At least 8 chars, with upper/lower/number"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-300">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-3 py-2.5 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/50 transition-colors"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-lg border border-cyan-400/30 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors font-medium"
            >
              {isLoading ? 'Resetting password...' : 'Reset password'}
            </button>
          </form>
        )}

        {errorMessage ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <CheckCircle className="mt-0.5 h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {step === 'reset' ? (
          <button
            type="button"
            onClick={() => {
              setStep('request');
              setCode('');
              setNewPassword('');
              setConfirmPassword('');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className="mt-4 text-sm text-gray-400 transition-colors hover:text-white"
          >
            Request a new code
          </button>
        ) : null}
      </div>
    </div>
  );

  if (inline) {
    return card;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6" aria-live="polite">
      {card}
    </div>
  );
}

export default ForgotPasswordModal;
