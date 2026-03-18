import React from 'react';

export interface MediaProvider {
  /**
   * Unique name of the provider (e.g., 'ODYSEE', 'IPFS')
   */
  name: string;

  /**
   * Regular expressions used to identify this media in raw markdown/HTML.
   * Matches will be replaced with standardized tokens: [[MEDIA:name:id]]
   */
  patterns: RegExp[];

  /**
   * Resolves a match from a pattern into a stable ID.
   * @param match The string matched by one of the patterns.
   */
  resolve: (match: string) => string;

  /**
   * The React component responsible for rendering this media.
   */
  Component: React.FC<{ id: string; isVisible?: boolean }>;
}
