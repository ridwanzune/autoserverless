
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="text-center">
      <h1 
        className="text-4xl sm:text-5xl font-bold tracking-tight"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
          Bangla News Automator
        </span>
      </h1>
      <p className="mt-3 text-lg text-gray-400">AI-Powered Content Creation</p>
    </header>
  );
};
