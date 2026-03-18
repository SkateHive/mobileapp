export interface ProcessedMarkdown {
  originalContent: string;
  contentWithPlaceholders: string;
}

import { Registry } from './providers';

export class MarkdownProcessor {
  /**
   * Processes markdown content to replace specific media links with placeholders
   * for the mobile app to render natively.
   */
  static process(content: string): ProcessedMarkdown {
    if (!content) return { originalContent: '', contentWithPlaceholders: '' };

    let processedContent = content;

    // A. Use Modular Providers (Registry)
    // We iterate through all registered providers and apply their patterns
    Registry.getAllProviders().forEach(provider => {
      provider.patterns.forEach(pattern => {
        processedContent = processedContent.replace(pattern, (match) => {
          const id = provider.resolve(match);
          return `[[${provider.name}:${id}]]`;
        });
      });
    });

    // B. Generic Media Cleanup (for tags that clutter the rendering)


    // 5. Instagram links
    processedContent = processedContent.replace(
      /(?:^|\s)https?:\/\/(www\.)?instagram\.com\/p\/([\w-]+)\/?[^\s]*(?=\s|$)/gim,
      '[[INSTAGRAM:$2]]'
    );

    // 6. Zora Coin/NFT links
    processedContent = processedContent.replace(
      /(?:^|\s)https?:\/\/(?:www\.)?(?:zora\.co|skatehive\.app)\/coin\/(0x[a-fA-F0-9]{40}(?::\d+)?).*?(?=\s|$)/gim,
      '[[ZORACOIN:$1]]'
    );

    // 7. Snapshot Proposals
    processedContent = processedContent.replace(
      /(?:^|\s)https?:\/\/(?:www\.)?(?:snapshot\.(?:org|box)|demo\.snapshot\.org)\/.*\/proposal\/(0x[a-fA-F0-9]{64})(?=\s|$)/gim,
      '[[SNAPSHOT:$1]]'
    );

    // 10. Deep Clean HTML tags that clutter or break rendering
    // Strip specific Hive/PeakD schema wrappers
    processedContent = processedContent.replace(/<div itemscope itemtype="https:\/\/schema\.org\/VideoObject">/gi, '');
    
    processedContent = processedContent.replace(/<center>/gi, '\n\n');
    processedContent = processedContent.replace(/<\/center>/gi, '\n\n');
    processedContent = processedContent.replace(/<div[^>]*>/gi, '\n');
    processedContent = processedContent.replace(/<\/div>/gi, '\n');
    processedContent = processedContent.replace(/<meta[^>]*>/gi, ''); 
    processedContent = processedContent.replace(/<link[^>]*>/gi, ''); 
    processedContent = processedContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''); 
    processedContent = processedContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ''); 

    // Final cleanup: remove excessive newlines and whitespace around tokens
    processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    processedContent = processedContent.trim();

    return {
      originalContent: content,
      contentWithPlaceholders: processedContent,
    };
  }
}
