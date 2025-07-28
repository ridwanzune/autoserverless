
export const NEWSDATA_API_KEY = 'pub_1058e1309a4d4112a59c6f7847c1a98a';

// --- NEW: CLOUDINARY & WEBHOOK CONSTANTS ---
export const CLOUDINARY_CLOUD_NAME = 'dukaroz3u';
export const CLOUDINARY_API_KEY = '151158368369834';
// IMPORTANT: This upload preset must be created in your Cloudinary account
// and configured for unsigned uploads for this to work.
export const CLOUDINARY_UPLOAD_PRESET = 'Autoupload'; 
export const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/mvsz33n18i6dl18xynls7ie9gnoxzghl';
export const MAKE_WEBHOOK_AUTH_TOKEN = 'xR@7!pZ2#qLd$Vm8^tYe&WgC*oUeXsKv';

// --- NEW: STATUS REPORTING WEBHOOK ---
// Create a new, separate webhook in Make.com for receiving status updates.
// This is critical for monitoring and debugging the cron job.
// Paste the new webhook URL here.
export const MAKE_STATUS_WEBHOOK_URL = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';


// --- NEW: NEWS CATEGORIES FOR BATCH PROCESSING ---
// These map to the categories supported by the newsdata.io API
export const NEWS_CATEGORIES = [
  { name: 'Trending', apiValue: 'top' },
  { name: 'Politics', apiValue: 'politics' },
  { name: 'Crime', apiValue: 'crime' },
  { name: 'Entertainment', apiValue: 'entertainment' },
  { name: 'Business/Corporate', apiValue: 'business' },
];

// The delay in milliseconds between fetching news for each category.
// This has been set to 0 to prevent cron job timeouts.
export const API_FETCH_DELAY_MS = 0;


// URL for the new logo image
export const LOGO_URL = 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1753507647/scs_cqidjz.png';

// Text to be displayed on the bottom right of the image
export const BRAND_TEXT = 'Dhaka Dispatch';

// URL for the visual overlay
export const OVERLAY_IMAGE_URL = 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1753644798/Untitled-1_hxkjvt.png';
