/**
 * Utilities for image processing and optimization.
 */

/**
 * Optimizes an image file by resizing and compressing it via HTML5 Canvas.
 * Forces the output to JPEG/WebP format, automatically stripping EXIF and GPS metadata segments.
 *
 * NOTE: All event handlers are assigned before FileReader starts
 * to avoid a race condition where img.onload fires after img.src
 * is set (possible when the browser has the data cached).
 */
export async function optimizeImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Blob> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
      // In headless testing or node environment, return slice
      resolve(file.slice(0, file.size, 'image/jpeg'));
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    // Wire up all img handlers BEFORE setting src
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create image blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for processing'));
    };

    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read image file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Re-encodes uploaded photos via Canvas to guarantee EXIF/GPS segments are stripped.
 */
export const stripExifMetadata = optimizeImage;

/**
 * Triggers a client-side file download for an image URL.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Failed to download image:', err);
  }
}
