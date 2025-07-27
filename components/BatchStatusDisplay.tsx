import React from 'react';
import type { BatchTask } from '../types';
import { TaskStatus } from '../types';

const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.PENDING:
        case TaskStatus.GATHERED: // Show a clock for gathered/queued status
            return <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        case TaskStatus.DONE:
            return <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        case TaskStatus.ERROR:
            return <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
        default: // In-progress statuses (Gathering, Processing, Composing, etc.)
            return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>;
    }
}

const getStatusColorClass = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.DONE: return "border-green-500/30 bg-green-900/20";
        case TaskStatus.ERROR: return "border-red-500/30 bg-red-900/20";
        case TaskStatus.PENDING: return "border-gray-700 bg-gray-800/40";
        case TaskStatus.GATHERED: return "border-gray-600 bg-gray-800/60";
        default: return "border-indigo-500/30 bg-indigo-900/20";
    }
}

interface BatchStatusDisplayProps {
  tasks: BatchTask[];
}

export const BatchStatusDisplay: React.FC<BatchStatusDisplayProps> = ({ tasks }) => {
  return (
    <div className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl p-6 text-left animate-fade-in">
        <h3 className="text-xl font-bold text-center text-gray-100 mb-6">Batch Progress</h3>
        <div className="space-y-3">
            {tasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between transition-all duration-300 ${getStatusColorClass(task.status)}`}>
                    <div className="flex items-center gap-4 flex-1 mb-3 sm:mb-0">
                        <div>{getStatusIcon(task.status)}</div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-200">{task.categoryName}</p>
                            <p className="text-sm text-gray-400">{task.status}</p>
                        </div>
                    </div>
                    {task.error && (
                        <p className="text-xs text-red-300 bg-red-900/50 p-2 rounded-md sm:max-w-xs text-left break-words">{task.error}</p>
                    )}
                    {task.status === TaskStatus.DONE && task.result && (
                        <div className="text-xs text-gray-400 text-left sm:text-right">
                           <p className="font-medium text-gray-300 truncate" title={task.result.headline}>{task.result.headline}</p>
                           <a href={task.result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                               Source: {task.result.sourceName}
                           </a>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

// Add fade-in animation to tailwind config or a style tag if needed
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
