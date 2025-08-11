import { Platform } from 'react-native';
import { PINATA_API_KEY, PINATA_SECRET_API_KEY } from '@env';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

interface VideoUploadResult {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface VideoUploadOptions {
  creator: string;
  thumbnailUrl?: string;
}

/**
 * Upload video to Pinata IPFS
 * @param fileUri - Local file URI from Expo ImagePicker
 * @param fileName - Original file name
 * @param mimeType - MIME type of the video
 * @param options - Upload options including creator and thumbnail
 * @returns Promise with IPFS hash and metadata
 */
export async function uploadVideoToPinata(
  fileUri: string,
  fileName: string,
  mimeType: string,
  options: VideoUploadOptions
): Promise<VideoUploadResult> {
  const pinataApiKey = PINATA_API_KEY;
  const pinataSecretApiKey = PINATA_SECRET_API_KEY;

  if (!pinataApiKey || !pinataSecretApiKey) {
    throw new Error('Pinata API credentials are missing from environment variables');
  }

  try {
    // Create FormData for the upload
    const formData = new FormData();

    // Add the video file
    const fileData = {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any;

    formData.append('file', fileData);

    // Add pinataMetadata with keyvalues
    const pinataMetadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        creator: options.creator || 'anonymous',
        fileType: mimeType,
        uploadDate: new Date().toISOString(),
        platform: Platform.OS,
        ...(options.thumbnailUrl && { thumbnailUrl: options.thumbnailUrl }),
      }
    });

    formData.append('pinataMetadata', pinataMetadata);

    // Add pinataOptions for making it public
    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', pinataOptions);

    const uploadResponse = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretApiKey,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Pinata upload failed:', uploadResponse.status, errorText);
      throw new Error(`Pinata upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const upload = await uploadResponse.json();

    // Return the result in the same format for compatibility
    const result: VideoUploadResult = {
      IpfsHash: upload.IpfsHash,
      PinSize: upload.PinSize,
      Timestamp: upload.Timestamp || new Date().toISOString(),
    };

    return result;
  } catch (error) {
    console.error('Failed to upload video to Pinata:', error);
    throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate IPFS URL from hash
 * @param ipfsHash - IPFS hash returned from upload
 * @returns Public IPFS URL
 */
export function getIPFSUrl(ipfsHash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}

/**
 * Create video iframe markup for Hive post
 * @param ipfsHash - IPFS hash of the uploaded video
 * @param title - Optional title for the video
 * @returns HTML iframe string
 */
export function createVideoIframe(ipfsHash: string, title?: string): string {
  const ipfsUrl = getIPFSUrl(ipfsHash);
  return `<iframe src="${ipfsUrl}" width="100%" height="400" frameborder="0" allowfullscreen title="${title || 'Video'}"></iframe>`;
}
