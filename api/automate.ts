
import { findAndAnalyzeBestArticleFromList } from '../services/gemini';
import { fetchLatestBangladeshiNews } from '../services/news';
import { composeImage } from '../utils/canvas';
import { LOGO_URL, BRAND_TEXT, OVERLAY_IMAGE_URL, NEWS_CATEGORIES, API_FETCH_DELAY_MS } from '../constants';
import { BatchTask, TaskStatus, WebhookPayload, NewsAnalysis, NewsDataArticle } from '../types';
import { uploadToCloudinary } from '../services/cloudinary';
import { sendToMakeWebhook } from '../services/webhook';
import { generateImageFromPrompt } from '../services/imageGenerator';

export const config = {
    runtime: 'nodejs',
    maxDuration: 300, // 5 minutes, as the full batch can take time
};

interface CollectedData {
    taskId: string;
    analysis: NewsAnalysis;
    article: NewsDataArticle;
}

export default async function handler(req: Request) {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            
            // Helper to push updates to the client stream
            const pushUpdate = (task: BatchTask) => {
                controller.enqueue(encoder.encode(JSON.stringify(task) + '\n'));
            };

            const tasks: BatchTask[] = NEWS_CATEGORIES.map(cat => ({
                id: cat.apiValue,
                categoryName: cat.name,
                status: TaskStatus.PENDING,
            }));

            // Immediately send the initial pending state for all tasks
            tasks.forEach(pushUpdate);
            
            const usedArticleLinks = new Set<string>();

            // Helper to update state and push it to the client
            const updateTask = (taskId: string, updates: Partial<BatchTask>) => {
                const taskIndex = tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
                    pushUpdate(tasks[taskIndex]);
                }
            };
    
            // --- PHASE 1: GATHER ALL NEWS ARTICLES ---
            const collectedData: CollectedData[] = [];
            for (const category of NEWS_CATEGORIES) {
                const taskId = category.apiValue;
                try {
                    updateTask(taskId, { status: TaskStatus.GATHERING });
                    const allArticles = await fetchLatestBangladeshiNews(category.apiValue);
                    const unusedArticles = allArticles.filter(article => !usedArticleLinks.has(article.link));

                    if (unusedArticles.length === 0) {
                         throw new Error(`No new, unused articles found for ${category.name}.`);
                    }

                    const result = await findAndAnalyzeBestArticleFromList(unusedArticles);
                    
                    if (!result) {
                        throw new Error(`Could not find a relevant, unused Bangladesh-specific article for ${category.name}.`);
                    }
                    
                    const { analysis, article: relevantArticle } = result;
                    usedArticleLinks.add(relevantArticle.link);
                    collectedData.push({ taskId, analysis, article: relevantArticle });
                    
                    updateTask(taskId, { status: TaskStatus.GATHERED });

                    await new Promise(resolve => setTimeout(resolve, API_FETCH_DELAY_MS));

                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                    console.error(`Failed to gather article for category ${category.name}:`, err);
                    updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
                }
            }

            // --- PHASE 2: PROCESS ALL GATHERED ARTICLES ---
            for (const data of collectedData) {
                const { taskId, analysis, article } = data;
                try {
                    updateTask(taskId, { status: TaskStatus.PROCESSING });

                    let imageSrcToCompose: string;
                    try {
                        if (!article.image_url) throw new Error("Article has no image_url.");
                        // The loadImage check is implicit in composeImage, but we use src now
                        imageSrcToCompose = article.image_url;
                    } catch (error) {
                        console.warn(`Failed to load article image, generating a new one. Reason: ${error}`);
                        updateTask(taskId, { status: TaskStatus.GENERATING_IMAGE });
                        imageSrcToCompose = await generateImageFromPrompt(analysis.imagePrompt);
                    }

                    updateTask(taskId, { status: TaskStatus.COMPOSING });
                    // Pass image source string to composeImage now
                    const compiledImage = await composeImage(
                      imageSrcToCompose,
                      analysis.headline,
                      analysis.highlightPhrases,
                      LOGO_URL,
                      BRAND_TEXT,
                      OVERLAY_IMAGE_URL
                    );

                    updateTask(taskId, { status: TaskStatus.UPLOADING });
                    const imageUrl = await uploadToCloudinary(compiledImage);

                    updateTask(taskId, { status: TaskStatus.SENDING_WEBHOOK });
                    const webhookPayload: WebhookPayload = {
                        headline: analysis.headline,
                        imageUrl: imageUrl,
                        summary: analysis.caption,
                        newsLink: article.link,
                        status: 'Queue'
                    };
                    await sendToMakeWebhook(webhookPayload);
                    
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

                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                    console.error(`Failed task for category ${NEWS_CATEGORIES.find(c=>c.apiValue === taskId)?.name}:`, err);
                    updateTask(taskId, { status: TaskStatus.ERROR, error: errorMessage });
                }
            }
            
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
