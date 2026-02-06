# PR: Fix Mobile Image Upload

## Problem
Image uploads were failing on some devices with generic error messages. The issue was traced to commit `59f6976` which removed the file existence validation before attempting JPEG conversion.

## Root Cause
Without the file existence check, if the image URI is invalid (permissions issue, cache cleared, etc.), the `ImageManipulator` fails with an unclear error instead of a helpful message.

## Solution
Restored the file existence check in `image-converter.ts` that validates the file exists before attempting conversion:

```typescript
const fileInfo = await FileSystem.getInfoAsync(uri);
if (!fileInfo.exists) {
  throw new Error(`Image file not found: ${uri}`);
}
```

## Testing
- [ ] Test image upload on iOS (HEIC and JPEG)
- [ ] Test image upload on Android
- [ ] Test with large images (>10MB)
- [ ] Verify video upload still works (unaffected)

## Related
- Trello: https://trello.com/c/69810dc56c8a79301abf146a
- GitHub Issue: SkateHive/mobileapp#1
