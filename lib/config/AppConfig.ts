export interface AppSettings {
  /**
   * The application theme.
   */
  theme: 'matrix' | 'skatehive';
}

/**
 * Default application configuration.
 */
export const AppConfig: AppSettings = {
  theme: 'skatehive',
};
