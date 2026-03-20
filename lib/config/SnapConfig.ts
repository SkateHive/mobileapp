import { Platform } from 'react-native';

export interface SnapSettings {
  /**
   * Whether to use the Skatehive API for fetching user snaps.
   * If false, falls back to direct dhive blockchain calls.
   */
  useApi: boolean;
  /**
   * This adds a layer of validation by checking the metadata on-chain.
   */
  verifyDeletion: boolean;
  /**
   * Number of items to display per page in the UI.
   */
  pageSize: number;
  /**
   * Number of items to fetch from the blockchain/API in a single request.
   * This should be larger than pageSize to account for filtering (blocked users, etc).
   */
  fetchLimit: number;
}

/**
 * Platform-specific snap configuration.
 * This allows toggling between the new Skatehive API and direct blockchain calls.
 */
export const SnapConfig: SnapSettings = Platform.select({
  ios: {
    useApi: true,
    verifyDeletion: true,
    pageSize: 20,
    fetchLimit: 40,
  },
  android: {
    useApi: true,
    verifyDeletion: true,
    pageSize: 10,
    fetchLimit: 20,
  },
  default: {
    useApi: true,
    verifyDeletion: true,
    pageSize: 10,
    fetchLimit: 20,
  },
})!;
