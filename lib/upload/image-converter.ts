import * as ImageManipulator from 'expo-image-manipulator';

export interface ConvertedImage {
  uri: string;
  width: number;
  height: number;
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
    // Convert to JPEG using ImageManipulator
    // ImageManipulator will handle reading the file internally
    // Even for non-HEIC images, this ensures consistent JPEG output
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No transformations, just format conversion
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
