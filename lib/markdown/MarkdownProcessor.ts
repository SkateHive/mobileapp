export interface ProcessedMarkdown {
  originalContent: string;
  contentWithPlaceholders: string;
}

export class MarkdownProcessor {
  /**
   * Processes markdown content to replace specific media links with placeholders
   * for the mobile app to render natively.
   */
  static process(content: string): ProcessedMarkdown {
    if (!content) return { originalContent: '', contentWithPlaceholders: '' };

    let processedContent = content;

    // 1. YouTube direct links and embeds
    processedContent = processedContent.replace(
      /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[\S]*/gim,
      '[[YOUTUBE:$1]]'
    );
    processedContent = processedContent.replace(
      /<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtu.be)\/embed\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*><\/iframe>/gim,
      '[[YOUTUBE:$1]]'
    );

    // 2. Vimeo direct links and embeds
    processedContent = processedContent.replace(
      /^https?:\/\/(?:www\.)?(?:vimeo.com\/(?:channels\/[\w]+\/)?|player.vimeo.com\/video\/)([0-9]+)[\S]*/gim,
      '[[VIMEO:$1]]'
    );
    processedContent = processedContent.replace(
      /<iframe[^>]*src=["'](?:https?:)?\/\/(?:player\.)?vimeo.com\/video\/([0-9]+)[^"']*["'][^>]*><\/iframe>/gim,
      '[[VIMEO:$1]]'
    );

    // 3. Odysee embeds and direct links
    processedContent = processedContent.replace(
      /^https?:\/\/odysee\.com\/\$\/embed\/[\w@:%._\+~#=\/-]+/gim,
      '[[ODYSEE:$0]]'
    );
    processedContent = processedContent.replace(
      /<iframe[^>]*src=["'](https?:\/\/odysee\.com\/[^"']+)["'][^>]*><\/iframe>/gim,
      '[[ODYSEE:$1]]'
    );

    // 4. 3Speak links
    processedContent = processedContent.replace(
       /\[!\[.*?\]\(.*?\)\]\((https?:\/\/3speak\.tv\/watch\?v=([\w\-/]+))\)/g,
       '[[THREESPEAK:$2]]'
    );

    // 5. Instagram links
    processedContent = processedContent.replace(
      /^https?:\/\/(www\.)?instagram\.com\/p\/([\w-]+)\/?[^\s]*$/gim,
      '[[INSTAGRAM:$0]]'
    );

    // 6. Zora Coin/NFT links
    processedContent = processedContent.replace(
      /^https?:\/\/(?:www\.)?(?:zora\.co|skatehive\.app)\/coin\/(0x[a-fA-F0-9]{40}(?::\d+)?).*$/gim,
      '[[ZORACOIN:$1]]'
    );

    // 7. Snapshot Proposals
    processedContent = processedContent.replace(
      /^https?:\/\/(?:www\.)?(?:snapshot\.(?:org|box)|demo\.snapshot\.org)\/.*\/proposal\/(0x[a-fA-F0-9]{64})$/gim,
      '[[SNAPSHOT:$0]]'
    );

    // 8. IPFS Video tags
    processedContent = processedContent.replace(
      /<div class="video-embed" data-ipfs-hash="([^"]+)">[\s\S]*?<\/div>/g,
      '[[IPFSVIDEO:$1]]'
    );
    
    // 9. Images (IPFS and external)
    // IPFS Images
    processedContent = processedContent.replace(
      /!\[.*?\]\((https?:\/\/(?:gateway\.pinata\.cloud|ipfs\.skatehive\.app)\/ipfs\/([\w-]+)(\.[a-zA-Z0-9]+)?)[^)]*\)/gi,
      '[[IMAGE:$1]]'
    );
    // Standard Markdown Images
    processedContent = processedContent.replace(
      /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:gif|jpg|jpeg|png|webp)(?:\?[^\s)]*)?)\)/gi,
      '[[IMAGE:$1]]'
    );
    // Standalone Image URLs
    processedContent = processedContent.replace(
      /^(https?:\/\/[^\s]+\.(?:gif|jpg|jpeg|png|webp)(?:\?[^\s]*)?)$/gmi,
      '[[IMAGE:$1]]'
    );

    return {
      originalContent: content,
      contentWithPlaceholders: processedContent,
    };
  }
}
