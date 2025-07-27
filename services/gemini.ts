

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { NewsAnalysis, NewsDataArticle } from '../types';
import { GEMINI_API_KEY } from '../constants';

// Initialize the AI client with the hardcoded API key from constants
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Parses the raw text response from the Gemini API into a structured NewsAnalysis object.
 * This function is designed to be robust against variations in whitespace and line endings.
 * @param text The raw string response from the AI.
 * @returns A structured NewsAnalysis object.
 * @throws An error if the response text cannot be parsed into the required format.
 */
const parseAnalysisResponse = (text: string): NewsAnalysis => {
    const lines = text.split('\n');
    const analysis: Partial<Omit<NewsAnalysis, 'highlightPhrases'> & { highlightPhrases: string[] }> = {
      highlightPhrases: []
    };
    let isParsingCaption = false;
    const captionLines: string[] = [];
    let isParsingImagePrompt = false;
    const imagePromptLines: string[] = [];


    // Iterate over each line to find and extract the required fields.
    lines.forEach(line => {
        // Reset flags when a new field is encountered
        if (line.startsWith('HEADLINE:') || line.startsWith('HIGHLIGHT_WORDS:') || line.startsWith('SOURCE_NAME:') || line.startsWith('CAPTION:') || line.startsWith('IMAGE_PROMPT:')) {
            isParsingCaption = false;
            isParsingImagePrompt = false;
        }

        if (line.startsWith('HEADLINE:')) {
            analysis.headline = line.substring('HEADLINE:'.length).trim();
        } else if (line.startsWith('HIGHLIGHT_WORDS:')) {
            analysis.highlightPhrases = line.substring('HIGHLIGHT_WORDS:'.length).trim().split(',').map(w => w.trim()).filter(Boolean);
        } else if (line.startsWith('SOURCE_NAME:')) {
            analysis.sourceName = line.substring('SOURCE_NAME:'.length).trim();
        } else if (line.startsWith('CAPTION:')) {
            isParsingCaption = true;
            const captionPart = line.substring('CAPTION:'.length).trim();
            if (captionPart) captionLines.push(captionPart);
        } else if (line.startsWith('IMAGE_PROMPT:')) {
            isParsingImagePrompt = true;
            const promptPart = line.substring('IMAGE_PROMPT:'.length).trim();
            if (promptPart) imagePromptLines.push(promptPart);
        } else if (isParsingCaption) {
            captionLines.push(line.trim());
        } else if (isParsingImagePrompt) {
            imagePromptLines.push(line.trim());
        }
    });

    // Join the captured lines back together with newlines.
    if (captionLines.length > 0) {
        analysis.caption = captionLines.filter(Boolean).join('\n');
    }
    if (imagePromptLines.length > 0) {
        analysis.imagePrompt = imagePromptLines.filter(Boolean).join(' ');
    }


    // Final validation to ensure all parts were successfully parsed.
    if (!analysis.headline || !analysis.caption || !analysis.sourceName || !analysis.highlightPhrases || analysis.highlightPhrases.length === 0 || !analysis.imagePrompt) {
        console.error("Failed to parse response text:", text);
        console.error("Parsed analysis object:", analysis);
        throw new Error("Could not parse all required fields from the AI response. The format might be incorrect.");
    }

    return analysis as NewsAnalysis;
}

/**
 * Reviews a list of news articles, asks the AI to select the single best one,
 * and then generates content for it. This is highly efficient as it uses one API call
 * to perform both selection and analysis.
 * @param articles A list of potential news articles.
 * @returns A Promise resolving to an object with the analysis and the chosen article, or null if none were relevant.
 */
export const findAndAnalyzeBestArticleFromList = async (
  articles: NewsDataArticle[]
): Promise<{ analysis: NewsAnalysis; article: NewsDataArticle } | null> => {
    const model = 'gemini-2.5-flash';

    const articleListForPrompt = articles
        .map((article, index) => `
ARTICLE ${index + 1}:
ID: ${index + 1}
Title: ${article.title}
Content: ${article.content || article.description}
Source: ${article.source_id}
---`
        ).join('\n');

    const prompt = `
You are an expert news editor for a Bangladeshi social media channel. Your goal is to find the single most important, impactful, and relevant story for your audience from a list of recent articles.

**Your First Task: Select the Best Article**
- Review all articles and select the ONE that is most newsworthy and DIRECTLY relevant to Bangladesh. This means the story's main subject is an event, person, or entity within Bangladesh, or has a significant, direct impact on Bangladesh or its citizens.
- **Crucial Rule:** AVOID articles that are primarily about neighboring countries (e.g., India, Pakistan) unless Bangladesh is a central part of the story (e.g., a bilateral agreement, a joint-venture, etc.). An article just mentioning Bangladesh in passing is not sufficient.
- If NONE of the articles meet this strict criteria, you MUST respond with ONLY the single word: IRRELEVANT.

**If you find a suitable article, proceed to Your Second Task:**
- Identify the article you chose by its ID.
- Perform a full analysis on ONLY that chosen article.

**Analysis Steps:**
**1. Headline Generation (IMPACT Principle):** Informative, Main Point, Prompting Curiosity, Active Voice, Concise, Targeted.
**2. Highlight Phrase Identification:** Identify 2-3 key phrases from your new headline that capture critical information (entities, key terms, numbers). List these exact phrases, separated by commas.
**3. Image Prompt Generation (SCAT Principle & Safety):** Generate a concise, descriptive prompt for an AI image generator. The prompt MUST be safe for work and MUST NOT contain depictions of specific people (especially political figures), violence, conflict, or other sensitive topics. Instead, focus on symbolic, abstract, or neutral representations of the news. For example, for a political story, prompt "Gavel on a table with a Bangladeshi flag in the background" instead of showing politicians. The prompt should follow the SCAT principle (Subject, Context, Atmosphere, Type).
**4. Caption & Source:** Create a social media caption (~50 words) with 3-5 relevant hashtags. The caption must end with 'Source: [Source Name]'.

**List of Articles to Analyze:**
${articleListForPrompt}

**Output Format (Strict):**
- If no article is relevant, respond ONLY with: IRRELEVANT
- If you find a relevant article, respond ONLY with the following format. Do not add any other text.

CHOSEN_ID: [The ID number of the article you selected]
HEADLINE: [Your generated headline for the chosen article]
HIGHLIGHT_WORDS: [phrase 1, phrase 2]
IMAGE_PROMPT: [Your generated image prompt]
CAPTION: [Your generated caption ending with Source: Source Name]
SOURCE_NAME: [The source name from the chosen article]
`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        
        const responseText = response.text?.trim();

        if (!responseText) {
            throw new Error("Received an empty text response from the API.");
        }
        
        if (responseText.toUpperCase() === 'IRRELEVANT') {
            console.log(`AI deemed all articles in the batch irrelevant to Bangladesh.`);
            return null; // Signal that no suitable article was found.
        }

        const chosenIdMatch = responseText.match(/^CHOSEN_ID:\s*(\d+)/m);
        if (!chosenIdMatch || !chosenIdMatch[1]) {
            throw new Error("AI response did not include a valid CHOSEN_ID.");
        }
        const chosenId = parseInt(chosenIdMatch[1], 10);
        const chosenArticle = articles[chosenId - 1]; // -1 because our IDs are 1-based index

        if (!chosenArticle) {
          throw new Error(`AI chose an invalid ID: ${chosenId} from a list of ${articles.length} articles.`);
        }

        const analysis = parseAnalysisResponse(responseText);
        
        return { analysis, article: chosenArticle };

    } catch (error) {
        let errorMessage = "Failed to analyze the news article.";
        if (error instanceof Error) {
            // Check for specific rate limit error from Gemini
            if (error.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "AI request failed due to rate limits (RESOURCE_EXHAUSTED). The application made too many requests in a short period. Please wait and try again.";
            } else {
                errorMessage = `Failed to analyze the news article. ${error.message}`;
            }
        }
        console.error("Error in findAndAnalyzeBestArticleFromList:", error);
        throw new Error(errorMessage);
    }
};