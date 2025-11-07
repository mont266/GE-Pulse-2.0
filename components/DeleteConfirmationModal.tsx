import React from 'react';
import { Button } from './ui/Button';
import { Loader } from './ui/Loader';
import { Trash2Icon } from './icons/Icons';

interface DeleteConfirmationModalProps {
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isLoading: boolean;
  error: string | null;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ title, message, onClose, onConfirm, isLoading, error }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md relative border border-red-500/50 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/20 rounded-full">
            <Trash2Icon className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>

        {error && <p className="bg-red-500/20 text-red-300 text-sm p-3 rounded-md my-4">{error}</p>}
        
        <div className="text-gray-300 mb-6">{message}</div>
        
        <div className="flex justify-end gap-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? <Loader size="sm" /> : 'Confirm & Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
};