
import { NEWSDATA_API_KEY } from '../constants';
import type { NewsDataArticle } from '../types';

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage: string | null;
}

/**
 * --- NEWS FETCHING STRATEGY ---
 * This function fetches news from Bangladesh for a specific category using the `country` filter.
 * This approach is more robust than specifying a fixed list of domains, as it queries all sources
 * the news API has for Bangladesh, preventing errors related to unrecognized or changed domain names.
 */
export const fetchLatestBangladeshiNews = async (category: string): Promise<NewsDataArticle[]> => {
  // Use the 'country' parameter to fetch news from all available sources in Bangladesh.
  // Add size=10 to get a larger pool of articles for the AI to choose from.
  const countryCode = 'bd';
  const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&country=${countryCode}&language=en&image=1&category=${category}&size=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // If the API returns a non-2xx status, parse the JSON for more detailed error info.
      const errorData = await response.json();
      throw new Error(`News API request failed with status ${response.status}: ${errorData.results?.message || response.statusText}`);
    }

    const data: NewsDataResponse = await response.json();
    if (data.status === 'error' || !data.results) {
        throw new Error(`News API returned an error in its response body: ${JSON.stringify(data)}`);
    }

    // --- Post-Fetch Filtering ---
    // Even with `image=1`, some results might lack a usable image_url or content.
    // This step ensures we only process articles that are complete enough for our automation.
    const validArticles = data.results.filter(
      (article) => article.image_url && article.link && (article.content || article.description)
    );

    if (validArticles.length === 0) {
      console.warn(`No suitable news articles with images found for category "${category}" from Bangladesh.`);
    }

    // Return all valid articles. The main application logic will now send this entire list
    // to the AI for efficient, single-call analysis.
    return validArticles;

  } catch (error) {
    console.error("Failed to fetch news:", error);
    // Re-throw the error to be caught by the main try-catch block in App.tsx.
    throw error;
  }
};
