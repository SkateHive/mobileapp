import { Client } from '@hiveio/dhive';
import { MarkdownProcessor } from './lib/markdown/MarkdownProcessor';

const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://api.hive.blog",
]);

async function debugVitimSnaps() {
  const username = 'vitimribeiro';
  console.log(`Fetching last posts/comments for @${username}...`);

  try {
    // get_account_posts with sort: 'comments' gets his replies (snaps)
    const posts = await HiveClient.call('bridge', 'get_account_posts', {
      account: username,
      sort: 'comments',
      limit: 20
    });

    console.log(`Found ${posts.length} comments. Filtering for snaps...`);

    const snaps = posts.filter((p: any) => {
      try {
        const meta = typeof p.json_metadata === 'string' ? JSON.parse(p.json_metadata) : p.json_metadata;
        return meta.tags && meta.tags.includes('hive-173115');
      } catch {
        return false;
      }
    }).slice(0, 5);

    console.log(`Analyzing last ${snaps.length} snaps:\n`);

    for (const snap of snaps) {
      console.log('==========================================');
      console.log(`PERMLINK: ${snap.permlink}`);
      console.log(`CREATED: ${snap.created}`);
      console.log('--- RAW BODY ---');
      console.log(snap.body);
      
      const processed = MarkdownProcessor.process(snap.body);
      console.log('\n--- PROCESSED CONTENT ---');
      console.log(processed.contentWithPlaceholders);
      
      const parts = processed.contentWithPlaceholders.split(/(\[\[(?:YOUTUBE|VIMEO|ODYSEE|THREESPEAK|IPFSVIDEO|INSTAGRAM|ZORACOIN|SNAPSHOT|IMAGE):[^\]]+\]\])/g);
      console.log('\n--- SPLIT PARTS ---');
      parts.forEach((part, i) => {
        if (part.trim()) {
          console.log(`Part ${i}: ${part.trim().substring(0, 100)}${part.length > 100 ? '...' : ''}`);
        }
      });
      console.log('==========================================\n');
    }
  } catch (error) {
    console.error('Error debugging snaps:', error);
  }
}

debugVitimSnaps();
