
import React from 'react';

interface LoadingIndicatorProps {
  message: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message }) => {
  return (
    <div className="mt-8 flex flex-col items-center justify-center p-6 bg-gray-800/50 border border-gray-700 rounded-2xl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
      <p className="mt-4 text-lg text-gray-300 font-semibold">{message}</p>
    </div>
  );
};
