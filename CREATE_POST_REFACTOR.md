# CreatePost Component Refactor - Documentation

## Overview

The CreatePost component has been completely refactored to support modern video and image upload functionality using Pinata for video storage and Hive's image service for image storage. The component now uses the authentication system properly and posts directly to the Hive blockchain.

## Key Changes

### 1. Authentication Integration
- Now uses `useAuth()` hook to get the authenticated user's session
- Retrieves the decrypted private key from `session.decryptedKey` instead of SecureStore
- Properly validates authentication before allowing posts

### 2. Video Upload with Pinata
- Videos are uploaded to IPFS via Pinata's API
- Uses environment variables for Pinata API credentials
- Creates HTML iframe markup for video embedding in posts
- Supports progress tracking during upload

### 3. Image Upload with Hive Images
- Images are uploaded to Hive's image service
- Uses proper signature creation with the user's private key
- Creates markdown image markup for posts
- Follows the same pattern as the Next.js mycommunity project

### 4. Post Creation
- Posts are created directly on the Hive blockchain using the `comment` function
- Supports both full posts (with titles) and microblog posts (without titles)
- Extracts hashtags from content automatically
- Includes proper metadata with app identification and tags

## New Files Created

### `/lib/upload/video-upload.ts`
Handles video upload to Pinata IPFS:
- `uploadVideoToPinata()` - Uploads video file to Pinata
- `getIPFSUrl()` - Generates public IPFS URL
- `createVideoIframe()` - Creates HTML iframe for video embedding

### `/lib/upload/image-upload.ts`
Handles image upload to Hive images service:
- `uploadImageToHive()` - Uploads image with proper signature
- `createImageSignature()` - Creates required signature using private key
- `createImageMarkdown()` - Creates markdown image markup

### `/lib/upload/post-utils.ts`
Handles Hive blockchain post creation:
- `createHivePost()` - Creates top-level posts with titles
- `createHiveComment()` - Creates comments/microblog posts
- `generatePermlink()` - Generates unique permlinks
- `extractHashtags()` - Extracts hashtags from text

## Environment Variables Required

Add these to your `.env` file:

```env
EXPO_PUBLIC_PINATA_API_KEY=your_pinata_api_key_here
EXPO_PUBLIC_PINATA_SECRET_API_KEY=your_pinata_secret_api_key_here
```

## Dependencies Added

- `buffer` - For Buffer polyfill in React Native environment

## Technical Implementation

### Buffer Polyfill
- Added Buffer polyfill for React Native compatibility
- Updated metro.config.js to resolve buffer module
- Created polyfills.js file imported in index.js

### Upload Flow
1. **Image Upload**: Local file → Hive Images Service → Markdown in post body
2. **Video Upload**: Local file → Pinata IPFS → HTML iframe in post body
3. **Post Creation**: Content + media markup → Hive blockchain via `comment` function

### UI Improvements
- Added optional title field for full posts
- Progress indicators during upload
- Better error handling and user feedback
- Improved layout with proper spacing and visual hierarchy

## Usage

Users can now:
1. Create posts with optional titles
2. Upload images that get embedded as markdown
3. Upload videos that get embedded as HTML iframes
4. Have hashtags automatically extracted and included in metadata
5. See upload progress and proper error messages

## Mobile-Specific Considerations

- Uses Expo ImagePicker for media selection
- Handles different file types and MIME types properly
- Optimized for mobile performance with proper loading states
- Works with both iOS and Android platforms

## Security

- Private keys are handled securely through the auth system
- Image signatures are created locally using the user's private key
- No sensitive data is stored or transmitted insecurely
- Environment variables are used for API credentials

## Testing

Before using in production:
1. Ensure Pinata API credentials are set in environment variables
2. Test with both images and videos
3. Verify posts appear correctly in the feed
4. Test on both iOS and Android devices
