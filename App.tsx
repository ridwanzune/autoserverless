
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { findAndAnalyzeBestArticleFromList } from './services/gemini';
import { fetchLatestBangladeshiNews } from './services/news';
import { composeImage, loadImage } from './utils/canvas';
import { LOGO_URL, BRAND_TEXT, OVERLAY_IMAGE_URL, NEWS_CATEGORIES, API_FETCH_DELAY_MS } from './constants';
import { BatchTask, TaskStatus, WebhookPayload, NewsAnalysis, NewsDataArticle, StatusWebhookPayload } from './types';
import { uploadToCloudinary } from './services/cloudinary';
import { sendToMakeWebhook, sendStatusUpdate } from './services/webhook';
import { BatchStatusDisplay } from './components/BatchStatusDisplay';
import { generateImageFromPrompt } from './services/imageGenerator';

interface CollectedData {
    taskId: string;
    analysis: NewsAnalysis;
    article: NewsDataArticle;
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [baseUrl, setBaseUrl] = useState('');
  const [hasTriggeredFromUrl, setHasTriggeredFromUrl] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<'warmup' | 'start' | null>(null);

  /**
   * Main function to orchestrate the content generation process for all categories.
   * This now operates in two distinct phases:
   * 1. Gather all news articles first.
   * 2. Process all gathered articles.
   */
  const handleStartAutomation = useCallback(async () => {
    sendStatusUpdate({ level: 'INFO', message: 'Automation process started by trigger.' });
    setIsProcessing(true);
    setCompletedCount(0);
    
    // Initialize tasks state
    const initialTasks: BatchTask[] = NEWS_CATEGORIES.map(cat => ({
        id: cat.apiValue,
        categoryName: cat.name,
        status: TaskStatus.PENDING,
    }));
    setTasks(initialTasks);

    const usedArticleLinks = new Set<string>();

    // Helper to update state immutably
    const updateTask = (taskId: string, updates: Partial<BatchTask>) => {
        setTasks(prevTasks => prevTasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
        ));
    };
    
    // --- PHASE 1: GATHER ALL NEWS ARTICLES ---
    const collectedData: CollectedData[] = [];
    sendStatusUpdate({ level: 'INFO', message: 'Starting Phase 1: Article Gathering.' });

    for (const category of NEWS_CATEGORIES) {
        const taskId = category.apiValue;
        try {
            updateTask(taskId, { status: TaskStatus.GATHERING });
            sendStatusUpdate({ level: 'INFO', message: `Gathering articles for category: ${category.name}` });

            let allArticles: NewsDataArticle[];

            if (category.apiValue === 'top') {
                sendStatusUpdate({ level: 'INFO', message: 'Creating synthetic "Trending" category.' });
                const otherCategoryValues = NEWS_CATEGORIES
                    .filter(c => c.apiValue !== 'top')
                    .map(c => c.apiValue);

                const articlesFromAllCategories = (await Promise.all(
                    otherCategoryValues.map(cat => fetchLatestBangladeshiNews(cat))
                )).flat();

                const uniqueArticles = Array.from(new Map(articlesFromAllCategories.map(article => [article.link, article])).values());
                
                uniqueArticles.sort((a, b) => {
                    if (!a.pubDate || !b.pubDate) return 0;
                    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
                });
                
                allArticles = uniqueArticles.slice(0, 10);
                
                if (allArticles.length === 0) {
                    throw new Error('Could not find any valid articles to construct a "Trending" category.');
                }
                 sendStatusUpdate({ level: 'INFO', message: `Created "Trending" category with ${allArticles.length} articles.`});

            } else {
                 allArticles = await fetchLatestBangladeshiNews(category.apiValue);
            }
            
            const unusedArticles = allArticles.filter(article => !usedArticleLinks.has(article.link));

            if (unusedArticles.length === 0) {
                 throw new Error(`No new, unused articles found for ${category.name}.`);
            }
            
            sendStatusUpdate({ level: 'INFO', message: `Found ${unusedArticles.length} new articles. Analyzing with AI...`, category: category.name });
            const result = await findAndAnalyzeBestArticleFromList(unusedArticles);
            
            if (!result) {
                throw new Error(`AI deemed all articles irrelevant for ${category.name}.`);
            }
            
            const { analysis, article: relevantArticle } = result;
            usedArticleLinks.add(relevantArticle.link);
            collectedData.push({ taskId, analysis, article: relevantArticle });
            
            updateTask(taskId, { status: TaskStatus.GATHERED });
            sendStatusUpdate({ level: 'SUCCESS', message: `Successfully gathered and analyzed article for ${category.name}.`, details: { headline: analysis.headline, source: relevantArticle.link }});

            if (API_FETCH_DELAY_MS > 0) {
                await new Promise(resolve => setTimeout(resolve, API_FETCH_DELAY_MS));
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed to gather article for category ${category.name}:`, err);
            updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
            sendStatusUpdate({ level: 'ERROR', message: `Failed to gather for category: ${category.name}`, details: { error: errorMessage } });
        }
    }

    // --- PHASE 2: PROCESS ALL GATHERED ARTICLES ---
    sendStatusUpdate({ level: 'INFO', message: `Finished gathering. Starting Phase 2: Processing ${collectedData.length} articles.` });
    for (const data of collectedData) {
        const { taskId, analysis, article } = data;
        const categoryName = NEWS_CATEGORIES.find(c => c.apiValue === taskId)?.name || taskId;

        try {
            updateTask(taskId, { status: TaskStatus.PROCESSING });
            sendStatusUpdate({ level: 'INFO', message: 'Starting image processing.', category: categoryName });
            // 1. LOAD OR GENERATE IMAGE
            let imageToCompose: HTMLImageElement;
            try {
                imageToCompose = await loadImage(article.image_url!);
            } catch (error) {
                sendStatusUpdate({ level: 'INFO', message: `Article image failed. Generating new one.`, category: categoryName, details: { error: error instanceof Error ? error.message : String(error) }});
                updateTask(taskId, { status: TaskStatus.GENERATING_IMAGE });
                const generatedImageBase64 = await generateImageFromPrompt(analysis.imagePrompt);
                imageToCompose = await loadImage(generatedImageBase64);
            }

            // 2. COMPOSING IMAGE
            updateTask(taskId, { status: TaskStatus.COMPOSING });
            sendStatusUpdate({ level: 'INFO', message: 'Composing final image.', category: categoryName });
            const compiledImage = await composeImage(
              imageToCompose,
              analysis.headline,
              analysis.highlightPhrases,
              LOGO_URL,
              BRAND_TEXT,
              OVERLAY_IMAGE_URL
            );

            // 3. UPLOADING IMAGE TO CLOUDINARY
            updateTask(taskId, { status: TaskStatus.UPLOADING });
            sendStatusUpdate({ level: 'INFO', message: 'Uploading image to Cloudinary.', category: categoryName });
            const imageUrl = await uploadToCloudinary(compiledImage);

            // 4. SENDING TO WEBHOOK
            updateTask(taskId, { status: TaskStatus.SENDING_WEBHOOK });
            sendStatusUpdate({ level: 'INFO', message: 'Sending final data to main workflow webhook.', category: categoryName });
            const webhookPayload: WebhookPayload = {
                headline: analysis.headline,
                imageUrl: imageUrl,
                summary: analysis.caption,
                newsLink: article.link,
                status: 'Queue'
            };
            await sendToMakeWebhook(webhookPayload);
            
            // TASK DONE
            updateTask(taskId, { 
                status: TaskStatus.DONE,
                result: {
                    headline: analysis.headline,
                    imageUrl: imageUrl,
                    caption: analysis.caption,
                    sourceUrl: article.link,
                    sourceName: analysis.sourceName,
                }
            });
            setCompletedCount(prev => prev + 1);
            sendStatusUpdate({ level: 'SUCCESS', message: 'Task completed successfully!', category: categoryName, details: { headline: analysis.headline, imageUrl }});

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(`Failed task for category ${categoryName}:`, err);
            updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
            sendStatusUpdate({ level: 'ERROR', message: `Processing failed for category: ${categoryName}`, details: { error: errorMessage } });
        }
    }

    setIsProcessing(false);
    sendStatusUpdate({ level: 'SUCCESS', message: 'Automation process finished.' });
  }, []);

  // Effect to handle URL triggers and set base URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);

      if (!hasTriggeredFromUrl && !isProcessing) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'start') {
          console.log('Start action triggered from URL.');
          setHasTriggeredFromUrl(true); // Prevent re-triggering on the same page load
          handleStartAutomation();
        }
      }
    }
  }, [handleStartAutomation, hasTriggeredFromUrl, isProcessing]);

  const copyToClipboard = (text: string, type: 'warmup' | 'start') => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedUrl(type);
        setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const overallProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <Header />
        <main className="mt-8 text-center">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-semibold text-gray-200">Generate Social Media Post Batch</h2>
            <p className="mt-2 text-gray-400 max-w-2xl mx-auto">
              Click start to first gather news from 5 categories, then process them into social media posts for your workflow.
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
          
          <div className="mt-8 w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-left">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Cron Job Trigger URLs</h3>
            <p className="text-sm text-gray-400 mb-4">
                Use this URL to trigger the automation process via a cron job service.
            </p>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-medium text-gray-400" htmlFor="start-url">Start Automation URL</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            id="start-url"
                            type="text"
                            readOnly
                            value={baseUrl ? `${baseUrl}/?action=start` : 'Loading...'}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm text-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label="Start Automation URL"
                        />
                        <button 
                          onClick={() => copyToClipboard(`${baseUrl}/?action=start`, 'start')}
                          disabled={!baseUrl}
                          className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed transition-colors duration-200 text-sm flex-shrink-0"
                        >
                          {copiedUrl === 'start' ? 'Copied!' : 'Copy'}
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
