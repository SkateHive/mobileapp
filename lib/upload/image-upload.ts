import * as FileSystem from 'expo-file-system';
import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';

interface ImageUploadResult {
  url: string;
}

export interface ImageUploadOptions {
  username: string;
  privateKey: string;
}

/**
 * Create signature for image upload to Hive images
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param privateKey - User's private posting key
 * @returns Promise with signature string
 */
async function createImageSignature(fileUri: string, privateKey: string): Promise<string> {
  try {
    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to buffer
    const content = Buffer.from(base64Data, 'base64');

    // Create hash
    const hash = sha256.create();
    hash.update('ImageSigningChallenge');
    hash.update(content);
    const hashHex = hash.hex();

    // Sign the hash
    const key = PrivateKey.fromString(privateKey);
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const signature = key.sign(hashBuffer);

    return signature.toString();
  } catch (error) {
    console.error('Error creating image signature:', error);
    throw new Error('Failed to create image signature');
  }
}

/**
 * Upload image to Hive images service
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param fileName - Original file name
 * @param mimeType - MIME type of the image
 * @param options - Upload options including username and private key
 * @returns Promise with image URL
 */
export async function uploadImageToHive(
  fileUri: string,
  fileName: string,
  mimeType: string,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  try {
    // Create signature
    const signature = await createImageSignature(fileUri, options.privateKey);

    // Create FormData for upload
    const formData = new FormData();

    // Add the image file
    const fileData = {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any;

    formData.append('file', fileData);

    // Upload to Hive images
    const uploadUrl = `https://images.hive.blog/${options.username}/${signature}`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hive image upload failed:', response.status, errorText);
      throw new Error(`Image upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.url) {
      throw new Error('No URL returned from image upload');
    }

    return { url: result.url };
  } catch (error) {
    console.error('Failed to upload image to Hive:', error);
    throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create markdown image markup for Hive post
 * @param imageUrl - URL of the uploaded image
 * @param altText - Alt text for the image
 * @returns Markdown image string
 */
export function createImageMarkdown(imageUrl: string, altText: string = 'image'): string {
  return `![${altText}](${imageUrl})`;
}
