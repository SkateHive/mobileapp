export interface AppSettings {
  /**
   * The type of loading effect to show (e.g., 'skeleton', 'spinner').
   */
  loadingEffect: 'skeleton' | 'spinner' | 'none';
  /**
   * The type of background to show on the login screen.
   */
  loginBackgroundType: 'matrix' | 'video' | 'image';
}

/**
 * Default application configuration.
 */
export const AppConfig: AppSettings = {
  loadingEffect: 'skeleton',
  loginBackgroundType: 'matrix',
};
