import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/** Longest side an uploaded image is scaled down to. */
const MAX_UPLOAD_DIMENSION = 1600;

export interface ConvertedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Image dimensions, or null when they can't be read.
 *
 * Bounded on purpose: Image.getSize takes success and error callbacks and there's
 * no guarantee either fires — an unreadable URI can leave the promise pending, and
 * this sits directly in the upload path. Falling through to null just skips the
 * resize, which is the pre-existing behaviour.
 */
function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), 3000);

    Image.getSize(
      uri,
      (width, height) => {
        clearTimeout(timer);
        finish({ width, height });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      }
    );
  });
}

/**
 * Checks if a file URI or MIME type indicates a HEIC image
 * @param uri - File URI
 * @param mimeType - Optional MIME type
 * @returns true if the image is HEIC format
 */
export function isHeicImage(uri: string, mimeType?: string): boolean {
  // Check MIME type first
  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime === 'image/heic' || lowerMime === 'image/heif') {
      return true;
    }
  }

  // Check file extension
  const extension = uri.split('.').pop()?.toLowerCase();
  return extension === 'heic' || extension === 'heif';
}

/**
 * Converts an image to JPEG format for cross-platform compatibility
 * This is particularly important for HEIC images from iOS devices
 * which are not supported by many web browsers and servers
 * 
 * @param uri - Local file URI from Expo ImagePicker
 * @param quality - JPEG compression quality (0-1), default 0.8
 * @returns Promise with converted image URI and dimensions
 */
export async function convertToJPEG(
  uri: string,
  quality: number = 0.8
): Promise<ConvertedImage> {
  try {
    // Scale the longest side down before uploading. A phone camera produces
    // ~3000x4000, while nothing here renders above ~1080px and a profile grid
    // tile is ~390px — those pixels are uploaded, stored and downloaded only to
    // be discarded at draw time. A smaller body is also far less exposed to
    // whatever truncated two spot photos mid-upload (#39).
    const size = await getImageSize(uri);
    const longestSide = size ? Math.max(size.width, size.height) : 0;
    const actions: ImageManipulator.Action[] =
      size && longestSide > MAX_UPLOAD_DIMENSION
        ? [
            {
              resize:
                size.width >= size.height
                  ? { width: MAX_UPLOAD_DIMENSION }
                  : { height: MAX_UPLOAD_DIMENSION },
            },
          ]
        : []; // already small enough — never upscale

    // Even for non-HEIC images, this ensures consistent JPEG output
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error('Error converting image to JPEG:', error);
    throw new Error(
      `Failed to convert image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Converts multiple images to JPEG format
 * @param uris - Array of local file URIs
 * @param quality - JPEG compression quality (0-1), default 0.8
 * @returns Promise with array of converted images
 */
export async function convertMultipleToJPEG(
  uris: string[],
  quality: number = 0.8
): Promise<ConvertedImage[]> {
  const results = await Promise.all(
    uris.map(uri => convertToJPEG(uri, quality))
  );
  return results;
}

/**
 * Prepares an image for upload by converting HEIC to JPEG if needed
 * For non-HEIC images, passes through unchanged unless forceConvert is true
 * 
 * @param uri - Local file URI
 * @param mimeType - MIME type of the image
 * @param options - Optional settings for conversion
 * @returns Promise with the prepared image URI and updated MIME type
 */
export async function prepareImageForUpload(
  uri: string,
  mimeType: string,
  options: {
    quality?: number;
    forceConvert?: boolean;
  } = {}
): Promise<{ uri: string; mimeType: string; fileName: string }> {
  const { quality = 0.8, forceConvert = false } = options;

  const needsConversion = isHeicImage(uri, mimeType) || forceConvert;

  if (needsConversion) {
    const converted = await convertToJPEG(uri, quality);
    return {
      uri: converted.uri,
      mimeType: 'image/jpeg',
      fileName: `image-${Date.now()}.jpg`,
    };
  }

  // Return original if no conversion needed
  const originalFileName = uri.split('/').pop() || `image-${Date.now()}.jpg`;
  return {
    uri,
    mimeType,
    fileName: originalFileName,
  };
}
