
import React, { useState } from 'react';
import type { TaskResult } from '../types';

interface ResultCardProps {
  result: TaskResult;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const [captionCopied, setCaptionCopied] = useState(false);

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `news-content-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(result.caption).then(() => {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    });
  };

  return (
    <div className="mt-10 w-full bg-gray-800/50 border border-gray-700 rounded-2xl shadow-2xl p-6 text-left animate-fade-in">
      <h3 className="text-2xl font-bold text-center text-gray-100 mb-6">Your Content is Ready!</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Column */}
        <div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">Generated Image</h4>
          <img src={result.imageUrl} alt="Generated news content" className="rounded-lg shadow-lg w-full" />
          <button
            onClick={handleDownloadImage}
            className="w-full mt-4 bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-500 disabled:bg-gray-600 transition-colors duration-200"
          >
            Download Image
          </button>
        </div>
        
        {/* Caption Column */}
        <div>
          <h4 className="text-lg font-semibold text-gray-300 mb-2">Generated Caption</h4>
          <div className="bg-gray-900 p-4 rounded-lg min-h-[200px] text-gray-300 whitespace-pre-wrap">
            {result.caption}
          </div>
          <button
            onClick={handleCopyCaption}
            className="w-full mt-4 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 transition-colors duration-200"
          >
            {captionCopied ? 'Copied!' : 'Copy Caption'}
          </button>
          
          <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-300 mb-2">News Source</h4>
            <a 
                href={result.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-indigo-400 hover:text-indigo-300 break-all underline"
            >
                {result.sourceName || result.sourceUrl}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add fade-in animation to tailwind config or a style tag if needed
// For simplicity, we can add it directly in the component's parent or a global css file
// Here, we'll just add the class name and assume tailwind.config.js is set up for it.
// To make it work with just the CDN, we'll define the keyframes in a style tag in index.html,
// but for this project, let's just use a class and assume it's there.
// A simple way is to define it in the component file for clarity.
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }
`;

// Inject styles into the head
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}