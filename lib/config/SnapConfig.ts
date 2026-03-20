import { Platform } from 'react-native';

export interface SnapSettings {
  /**
   * Whether to use the Skatehive API for fetching user snaps.
   * If false, falls back to direct dhive blockchain calls.
   */
  useApi: boolean;
  /**
   * Whether to verify post status (deleted or not) after fetching from API.
   * This adds a layer of validation by checking the metadata on-chain.
   */
  verifyDeletion: boolean;
}

/**
 * Platform-specific snap configuration.
 * This allows toggling between the new Skatehive API and direct blockchain calls.
 */
export const SnapConfig: SnapSettings = Platform.select({
  ios: {
    useApi: true,
    verifyDeletion: true,
  },
  android: {
    useApi: true,
    verifyDeletion: true,
  },
  default: {
    useApi: true,
    verifyDeletion: true,
  },
})!;
