
import { Canvas, loadImage as skiaLoadImage, Image, Context2d } from 'skia-canvas';

/**
 * Asynchronously loads an image from a given URL (which can be a web URL or a base64 data URL)
 * for use in a Node.js environment with skia-canvas.
 * @param src The URL of the image to load.
 * @returns A Promise that resolves with the loaded skia-canvas Image object or rejects on error.
 */
const loadImage = (src: string): Promise<Image> => {
    try {
        if (src.startsWith('data:')) {
            // skia-canvas loadImage can't handle data urls directly, must use a Buffer
            const base64Data = src.split(',')[1];
            if (!base64Data) {
                return Promise.reject(new Error("Invalid data URL: missing base64 content."));
            }
            const buffer = Buffer.from(base64Data, 'base64');
            return skiaLoadImage(buffer);
        }
        // For http/https URLs, skia-canvas handles it directly.
        return skiaLoadImage(src);
    } catch (error) {
        console.error(`Failed to initiate image loading for src: ${src.substring(0, 100)}...`, error);
        return Promise.reject(error);
    }
};


/**
 * Calculates how to break a single string of text into multiple lines
 * that fit within a specified width.
 * @param context The 2D rendering context of the canvas.
 * @param text The full text to wrap.
 * @param maxWidth The maximum width each line can occupy.
 * @returns An array of strings, where each string is a single line of wrapped text.
 */
const calculateLines = (
  context: Context2d,
  text: string,
  maxWidth: number
): string[] => {
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    // Check if currentLine is empty to avoid a leading space
    const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine); // Add the last line
  return lines;
};


/**
 * Draws a pre-calculated set of text lines onto the canvas, applying highlights to specified phrases.
 * @param context The 2D rendering context of the canvas.
 * @param lines An array of strings, where each entry is a line of text to be drawn.
 * @param highlightPhrases An array of phrases within the headline to highlight.
 * @param x The center X coordinate for the text block.
 * @param y The top Y coordinate for the text block.
 * @param lineHeight The height of each line of text.
 */
const drawHeadlineWithHighlights = (
  context: Context2d,
  lines: string[],
  highlightPhrases: string[],
  x: number, // center X
  y: number,
  lineHeight: number
) => {
  let currentY = y;
  context.textBaseline = 'top'; // Align text from its top edge.

  for (const lineText of lines) {
    const totalLineWidth = context.measureText(lineText).width;
    const startX = x - totalLineWidth / 2; // Calculate the starting X for this centered line.

    // --- Draw Highlights First (Bottom Layer) ---
    context.fillStyle = '#ef4444'; // Red-500 from Tailwind color palette
    for (const phrase of highlightPhrases) {
      // Find all occurrences of the phrase in the current line, case-insensitively.
      let startIndex = -1;
      let searchFromIndex = 0;
      while ((startIndex = lineText.toLowerCase().indexOf(phrase.toLowerCase(), searchFromIndex)) !== -1) {
        const beforeText = lineText.substring(0, startIndex);
        const highlightText = lineText.substring(startIndex, startIndex + phrase.length);
        
        const offsetX = context.measureText(beforeText).width;
        const phraseWidth = context.measureText(highlightText).width;
        
        const highlightHeight = lineHeight * 0.45; // Make the highlight shorter than the text.
        const highlightYOffset = lineHeight * 0.4; // Position it towards the bottom half of the text line.
        context.fillRect(startX + offsetX, currentY + highlightYOffset, phraseWidth, highlightHeight);

        searchFromIndex = startIndex + 1; // Continue searching from the next character.
      }
    }

    // --- Draw Text Second (Top Layer) ---
    context.fillStyle = '#111827'; // Dark gray for the text color.
    context.fillText(lineText, startX, currentY);

    currentY += lineHeight; // Move to the next line.
  }
};


/**
 * The main image composition function. It layers multiple elements onto a canvas
 * to create the final social media image.
 * @returns A Promise that resolves to a base64-encoded data URL of the final image.
 */
export const composeImage = async (
  mainImageSrc: string, // Changed to src string to work on server
  headline: string,
  highlightPhrases: string[],
  logoUrl: string,
  brandText: string,
  overlayUrl: string
): Promise<string> => {
  const size = 1080; // Standard square post size.
  const canvas = new Canvas(size, size);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  const [mainImage, overlayImage, logoImage] = await Promise.all([
      loadImage(mainImageSrc),
      loadImage(overlayUrl),
      loadImage(logoUrl)
  ]);


  // --- Drawing Step 1: Fill Background ---
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);

  // --- Drawing Step 2: Draw the Main Article Image ---
  const imageTop = size * 0.3;
  const imageHeight = size * 0.7;
  const imgAspectRatio = mainImage.width / mainImage.height;
  const canvasAspectRatio = size / imageHeight;
  let sx, sy, sWidth, sHeight;

  if (imgAspectRatio > canvasAspectRatio) { // Image is wider than the canvas area.
    sHeight = mainImage.height;
    sWidth = sHeight * canvasAspectRatio;
    sx = (mainImage.width - sWidth) / 2;
    sy = 0;
  } else { // Image is taller or same aspect ratio.
    sWidth = mainImage.width;
    sHeight = sWidth / canvasAspectRatio;
    sx = 0;
    sy = (mainImage.height - sHeight) / 2;
  }
  ctx.drawImage(mainImage, sx, sy, sWidth, sHeight, 0, imageTop, size, imageHeight);

  // --- Drawing Step 3: Draw Separator Line ---
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, imageTop - 2, size, 5);

  // --- Drawing Step 4: Draw the Headline (with dynamic font sizing) ---
  const textTopMargin = 60;
  const textSideMargin = 60;
  const maxTextHeight = imageTop - textTopMargin - 40;
  const maxWidth = size - textSideMargin * 2;
  let fontSize = 72;
  let lineHeight: number;
  let lines: string[];

  // This needs pre-loading of fonts on server
  ctx.font = `bold 72px 'Poppins', 'sans-serif'`;
  await canvas.loadFont('https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2', { family: 'Poppins', weight: '700' });
  await canvas.loadFont('https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2', { family: 'Inter', weight: '400' });
  await canvas.loadFont('https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2', { family: 'Inter', weight: '600' });


  while (fontSize > 20) {
    lineHeight = fontSize * 1.2;
    ctx.font = `bold ${fontSize}px Poppins`;
    lines = calculateLines(ctx, headline, maxWidth);
    const currentHeight = lines.length * lineHeight;
    if (currentHeight <= maxTextHeight) break;
    fontSize -= 4;
  }

  ctx.textAlign = 'left';
  drawHeadlineWithHighlights(ctx, lines!, highlightPhrases, size / 2, textTopMargin, lineHeight!);
  
  // --- Drawing Step 5: Draw the Visual Overlay ---
  ctx.drawImage(overlayImage, 0, 0, size, size);

  // --- Drawing Step 6: Draw the Logo ---
  const logoHeight = 150;
  const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
  const margin = 40;
  ctx.drawImage(logoImage, margin, size - logoHeight - margin, logoWidth, logoHeight);

  // --- Drawing Step 7: Draw the Brand Text ---
  ctx.fillStyle = 'white';
  ctx.font = "600 24px Inter";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillText(brandText, size - margin, size - margin);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // --- Final Step: Return the result ---
  return await canvas.toDataURL('png');
};

export { loadImage };
