import React, { useState } from 'react';
import type { Profile } from '../types';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { XIcon } from './icons/Icons';
import { updateProfile } from '../services/database';

interface ProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onProfileUpdate: (updatedProfile: Profile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose, onProfileUpdate }) => {
  const [username, setUsername] = useState(profile.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isNewUser = !profile.username;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (username.length < 3 || username.length > 20) {
      setError("Username must be between 3 and 20 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError("Username can only contain letters, numbers, and underscores.");
        return;
    }
    
    setLoading(true);

    try {
      await updateProfile(profile.id, { username });
      onProfileUpdate({ ...profile, username });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-80 z-40 flex justify-center items-center p-4"
      onClick={isNewUser ? undefined : onClose} // Prevent closing on outside click for new users
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md relative border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {!isNewUser && (
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white" onClick={onClose} aria-label="Close profile settings">
              <XIcon className="w-6 h-6" />
          </Button>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            {isNewUser ? 'Welcome to GE Pulse!' : 'Profile Settings'}
          </h2>
          <p className="text-gray-400 mb-6">
            {isNewUser ? 'Please choose a unique username to continue.' : 'Update your public username.'}
          </p>
        </div>

        {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-md mb-4" role="alert">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="e.g., Zezima"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
                 <p className="text-xs text-gray-500 mt-1">3-20 characters. Letters, numbers, and underscores only.</p>
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full mt-6" disabled={loading}>
            {loading ? <Loader size="sm" /> : 'Save Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
};
