
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon } from './icons/Icons';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // On successful sign-up, show the confirmation message
        setIsAwaitingConfirmation(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // For sign-in, the onAuthStateChange listener in App.tsx will handle closing the modal.
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md relative border border-gray-700/50"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={onClose} aria-label="Close authentication modal">
            <XIcon className="w-6 h-6" />
        </Button>

        {isAwaitingConfirmation ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-gray-400 mb-6">
                We've sent a confirmation link to <span className="font-semibold text-emerald-300">{email}</span>. Please click the link to activate your account.
            </p>
            <Button variant="primary" size="lg" className="w-full mt-6" onClick={onClose}>
                Got it
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                {isSigningUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-gray-400 mb-6">
                {isSigningUp ? 'Start tracking your favorite items.' : 'Sign in to access your watchlist.'}
                </p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md mb-4" role="alert">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                    <label htmlFor="email" className="sr-only">Email address</label>
                    <input
                    id="email"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                    />
                </div>
                <div>
                    <label htmlFor="password-auth" className="sr-only">Password</label>
                    <input
                    id="password-auth"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                    />
                </div>
              </div>
              {isSigningUp && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs p-3 rounded-md text-center">
                    For your security, please do not use your RuneScape account password.
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" className="w-full mt-6" disabled={loading}>
                {loading ? <Loader size="sm" /> : (isSigningUp ? 'Sign Up' : 'Sign In')}
              </Button>
            </form>

            <div className="text-center mt-6">
              <button onClick={() => { setIsSigningUp(!isSigningUp); setError(null); }} className="text-sm text-emerald-400 hover:underline font-medium">
                {isSigningUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
