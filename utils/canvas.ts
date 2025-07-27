
/**
 * Asynchronously loads an image from a given URL (which can be a web URL or a base64 data URL).
 * It conditionally sets `crossOrigin` to 'anonymous' to handle images from different domains,
 * which is necessary for drawing them onto a canvas without tainting it.
 * @param src The URL of the image to load.
 * @returns A Promise that resolves with the loaded HTMLImageElement or rejects on error.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Data URLs don't need CORS and can cause errors with it.
    // Only apply for remote http/https images.
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => resolve(img);
    
    img.onerror = (err) => {
      // Check if this was a fallback image to provide a more specific error.
      if (!src.startsWith('http')) {
        // This error is critical because it means the AI-generated fallback image failed to load.
        reject(new Error('CRITICAL: The fallback image itself could not be loaded.'));
      } else {
        // This error indicates the original article image failed, and a fallback will be attempted.
        reject(new Error(`Failed to load image from ${src.substring(0, 100)}...`));
      }
    };

    img.src = src;
  });
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
  context: CanvasRenderingContext2D,
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
 * This is a complex function that works in two passes for each line:
 * 1.  It first draws the red highlight rectangles behind the text.
 * 2.  It then draws the actual text on top of the highlights.
 * This ensures the text is always crisp and readable.
 * @param context The 2D rendering context of the canvas.
 * @param lines An array of strings, where each entry is a line of text to be drawn.
 * @param highlightPhrases An array of phrases within the headline to highlight.
 * @param x The center X coordinate for the text block.
 * @param y The top Y coordinate for the text block.
 * @param lineHeight The height of each line of text.
 */
const drawHeadlineWithHighlights = (
  context: CanvasRenderingContext2D,
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
        
        // Calculate the position and width of the highlight rectangle.
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
  mainImage: HTMLImageElement,
  headline: string,
  highlightPhrases: string[],
  logoUrl: string,
  brandText: string,
  overlayUrl: string
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const size = 1080; // Standard square post size.
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // --- Drawing Step 1: Fill Background ---
  // The base layer is white, which will show through in the top 30% headline area.
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);

  // --- Drawing Step 2: Draw the Main Article Image ---
  // This image will occupy the bottom 70% of the canvas.
  const imageTop = size * 0.3;
  const imageHeight = size * 0.7;
  
  // The following logic calculates how to crop the source image to perfectly fit the
  // destination area (cover mode), preserving aspect ratio without distortion.
  const imgAspectRatio = mainImage.width / mainImage.height;
  const canvasAspectRatio = size / imageHeight;
  let sx, sy, sWidth, sHeight;

  if (imgAspectRatio > canvasAspectRatio) { // Image is wider than the canvas area.
    sHeight = mainImage.height;
    sWidth = sHeight * canvasAspectRatio;
    sx = (mainImage.width - sWidth) / 2; // Crop from the horizontal center.
    sy = 0;
  } else { // Image is taller or same aspect ratio.
    sWidth = mainImage.width;
    sHeight = sWidth / canvasAspectRatio;
    sx = 0;
    sy = (mainImage.height - sHeight) / 2; // Crop from the vertical center.
  }
  ctx.drawImage(mainImage, sx, sy, sWidth, sHeight, 0, imageTop, size, imageHeight);

  // --- Drawing Step 3: Draw Separator Line ---
  // A thick black line to cleanly separate the headline area from the image.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, imageTop - 2, size, 5); // Made thicker (5px height).

  // --- Drawing Step 4: Draw the Headline (with dynamic font sizing) ---
  // This section is now enhanced to prevent text from overflowing the white space.
  const textTopMargin = 60;
  const textSideMargin = 60;
  // Define the maximum vertical space available for the headline block.
  const maxTextHeight = imageTop - textTopMargin - 40; // Top margin - bottom margin
  const maxWidth = size - textSideMargin * 2;

  let fontSize = 72; // Start with the largest possible font size
  let lineHeight: number;
  let lines: string[];

  // This loop is the core of the overflow prevention. It starts with a large font size
  // and repeatedly reduces it until the entire headline block fits within the
  // designated `maxTextHeight`.
  while (fontSize > 20) { // We set a minimum font size to prevent text from becoming unreadable.
    lineHeight = fontSize * 1.2; // Keep line height proportional to the font size for good spacing.
    ctx.font = `bold ${fontSize}px 'Poppins', sans-serif`;

    // Calculate how the text will wrap with the current font size.
    lines = calculateLines(ctx, headline, maxWidth);
    const currentHeight = lines.length * lineHeight;

    // If the calculated height fits, we've found our ideal font size and can stop.
    if (currentHeight <= maxTextHeight) {
      break;
    }

    fontSize -= 4; // The text is too tall, so we reduce the font size and try again.
  }

  // Now, draw the headline using the calculated font size, line height, and wrapped lines.
  ctx.textAlign = 'left'; // The helper function will handle centering logic.
  drawHeadlineWithHighlights(
    ctx,
    lines!, // We know `lines` is defined from the loop above.
    highlightPhrases,
    size / 2, // Center X
    textTopMargin,
    lineHeight! // We know `lineHeight` is defined from the loop above.
  );
  
  // --- Drawing Step 5: Draw the Visual Overlay ---
  // This adds a texture over the entire image.
  const overlayImage = await loadImage(overlayUrl);
  ctx.drawImage(overlayImage, 0, 0, size, size);

  // --- Drawing Step 6: Draw the Logo ---
  // This is drawn on top of the overlay on the bottom-left.
  const logoImage = await loadImage(logoUrl);
  const logoHeight = 150; // Logo size increased.
  const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
  const margin = 40;
  ctx.drawImage(logoImage, margin, size - logoHeight - margin, logoWidth, logoHeight);

  // --- Drawing Step 7: Draw the Brand Text ---
  // This is drawn on top of the overlay on the bottom-right.
  ctx.fillStyle = 'white';
  ctx.font = "600 24px 'Inter', sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
  // Add a dark shadow for better readability against any background.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillText(brandText, size - margin, size - margin);

  // Reset shadow to prevent it from affecting subsequent drawings (good practice).
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // --- Final Step: Return the result ---
  // Convert the entire canvas to a PNG image represented as a base64 data URL.
  return canvas.toDataURL('image/png');
};

export { loadImage };
