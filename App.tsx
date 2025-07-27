
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { LOGO_URL, BRAND_TEXT, OVERLAY_IMAGE_URL, NEWS_CATEGORIES, API_FETCH_DELAY_MS } from './constants';
import { BatchTask, TaskStatus } from './types';
import { BatchStatusDisplay } from './components/BatchStatusDisplay';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [automationTriggered, setAutomationTriggered] = useState(false);
  const [warmupCopied, setWarmupCopied] = useState(false);
  const [startCopied, setStartCopied] = useState(false);

  // Initialize tasks state with all categories
  const initializeTasks = () => {
      const initialTasks: BatchTask[] = NEWS_CATEGORIES.map(cat => ({
          id: cat.apiValue,
          categoryName: cat.name,
          status: TaskStatus.PENDING,
      }));
      setTasks(initialTasks);
      setCompletedCount(0);
  };
  
  // Set initial state on mount
  useEffect(() => {
      initializeTasks();
  }, []);


  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const warmupUrl = baseUrl;
  // The start URL now points to our reliable serverless function
  const startUrl = `${baseUrl}/api/automate`;

  const handleCopy = (text: string, type: 'warmup' | 'start') => {
    navigator.clipboard.writeText(text).then(() => {
        if (type === 'warmup') {
            setWarmupCopied(true);
            setTimeout(() => setWarmupCopied(false), 2000);
        } else {
            setStartCopied(true);
            setTimeout(() => setStartCopied(false), 2000);
        }
    });
  };

  /**
   * Main function to orchestrate the content generation process.
   * It now calls a serverless function and listens for streaming updates.
   */
  const handleStartAutomation = useCallback(async () => {
    if (isProcessing) return; // Prevent multiple simultaneous runs

    setIsProcessing(true);
    initializeTasks(); // Reset tasks to pending state before starting

    try {
        const response = await fetch('/api/automate');
        if (!response.ok) {
            throw new Error(`Automation request failed: ${response.statusText}`);
        }
        if (!response.body) {
            throw new Error('Automation response is empty.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last partial line

            for (const line of lines) {
                if (line.trim() === '') continue;
                try {
                    const update: BatchTask = JSON.parse(line);
                    
                    setTasks(prevTasks => {
                        let alreadyDone = false;
                        const newTasks = prevTasks.map(t => {
                            if (t.id === update.id) {
                                if (t.status === TaskStatus.DONE) alreadyDone = true;
                                return update;
                            }
                            return t;
                        });

                        // Only increment completed count if the status transitions to DONE
                        if (update.status === TaskStatus.DONE && !alreadyDone) {
                            setCompletedCount(prev => prev + 1);
                        }
                        
                        return newTasks;
                    });

                } catch (e) {
                    console.error("Failed to parse stream update:", line, e);
                }
            }
        }
    } catch (error) {
        console.error("An error occurred during automation:", error);
        // Optionally, update all tasks to show a general error
        setTasks(prev => prev.map(t => ({ ...t, status: TaskStatus.ERROR, error: 'Automation failed to start.'})));
    } finally {
        setIsProcessing(false);
    }
  }, [isProcessing]);

  // Effect to trigger automation via URL parameter, now robust.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'start_automation' && !isProcessing && !automationTriggered) {
        setAutomationTriggered(true); // Prevent re-triggering
        handleStartAutomation();
    }
  }, [handleStartAutomation, isProcessing, automationTriggered]);

  const overallProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <Header />
        <main className="mt-8 text-center">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-semibold text-gray-200">Generate Social Media Post Batch</h2>
            <p className="mt-2 text-gray-400 max-w-2xl mx-auto">
              Click the button to manually start the process, or use the cron job URLs below to automate it.
            </p>
            <div className="mt-8">
              <button
                onClick={handleStartAutomation}
                disabled={isProcessing}
                className="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed disabled:text-gray-400 transition-all duration-300 transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                {isProcessing ? `Processing... (${completedCount}/${tasks.length})` : 'Start Automation'}
              </button>
            </div>
          </div>

          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl text-left">
            <h3 className="text-xl font-semibold text-gray-200 mb-2 text-center">Cron Job Triggers</h3>
            <p className="text-center text-sm text-gray-400 mb-6">Use these URLs to automate the process. Schedule the warm-up first, then the start link 1-2 minutes later.</p>
            <div className="space-y-4">
                {/* Warm-up URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Warm-up URL (pings the app to prevent cold starts)</label>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={warmupUrl} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button onClick={() => handleCopy(warmupUrl, 'warmup')} className="bg-gray-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-gray-500 transition-colors w-28">
                            {warmupCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
                {/* Start Automation URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Start Automation URL (initiates the process)</label>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={startUrl} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button onClick={() => handleCopy(startUrl, 'start')} className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-indigo-500 transition-colors w-28">
                            {startCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            </div>
          </div>
          
          {tasks.length > 0 && (
             <div className="mt-8">
                {isProcessing && (
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
                        <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${overallProgress}%`, transition: 'width 0.5s ease-in-out' }}></div>
                    </div>
                )}
               <BatchStatusDisplay tasks={tasks} />
             </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;
