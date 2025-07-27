
export interface NewsAnalysis {
  headline: string;
  highlightPhrases: string[];
  caption: string;
  sourceName: string;
  imagePrompt: string;
}

export interface NewsDataArticle {
  title: string;
  link: string;
  pubDate: string;
  source_id: string;
  image_url: string | null;
  description: string | null;
  content: string | null;
}

export interface WebhookPayload {
  headline: string;
  imageUrl: string;
  summary: string;
  newsLink: string;
  status: 'Queue';
}

export enum TaskStatus {
  PENDING = 'Pending',
  // Phase 1: Gathering
  GATHERING = 'Finding article...',
  GATHERED = 'Article found, queued for processing',
  // Phase 2: Processing
  PROCESSING = 'Processing content...',
  GENERATING_IMAGE = 'Generating new image...',
  COMPOSING = 'Creating image...',
  UPLOADING = 'Uploading image...',
  SENDING_WEBHOOK = 'Sending to workflow...',
  DONE = 'Done',
  ERROR = 'Error'
}

export interface TaskResult {
    headline: string;
    imageUrl: string; // Cloudinary URL
    caption: string;
    sourceUrl: string;
    sourceName: string;
}

export interface BatchTask {
  id: string; 
  categoryName: string;
  status: TaskStatus;
  result?: TaskResult;
  error?: string;
}