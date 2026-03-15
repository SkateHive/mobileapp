import { Client } from '@hiveio/dhive';
import { MarkdownProcessor } from '../lib/markdown/MarkdownProcessor';

const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://api.hive.blog",
]);

const SNAPS_CONTAINER_AUTHOR = 'peak.snaps';
const COMMUNITY_TAG = 'hive-173115';

async function findTallesSnap() {
  console.log(`Searching for @tallessilva's snap about Vale...`);

  try {
    const containers = await HiveClient.database.call('get_discussions_by_author_before_date', [
      SNAPS_CONTAINER_AUTHOR,
      '',
      new Date().toISOString().split('.')[0],
      20
    ]);

    for (const container of containers) {
      const replies = await HiveClient.database.call('get_content_replies', [container.author, container.permlink]);
      
      for (const snap of replies) {
        if (snap.author.toLowerCase() === 'tallessilva' && (snap.body.toLowerCase().includes('vale') || snap.permlink.toLowerCase().includes('vale'))) {
          console.log('\n==========================================');
          console.log(`FOUND SNAP: @${snap.author}`);
          console.log(`PERMLINK: ${snap.permlink}`);
          console.log(`BODY (RAW): \n${snap.body}`);
          
          const processed = MarkdownProcessor.process(snap.body);
          const tokens = processed.contentWithPlaceholders.match(/\[\[[a-zA-Z]+:[^\]]+\]\]/gi) || [];
          
          console.log(`\nTokens Found: ${tokens.length}`);
          tokens.forEach(t => console.log(`  - ${t}`));
          
          console.log('\n--- PROCESSED CONTENT ---');
          console.log(processed.contentWithPlaceholders);
          console.log('==========================================');
          return;
        }
      }
    }
    console.log('Post not found in the last 20 containers.');
  } catch (error) {
    console.error('Error finding post:', error);
  }
}

findTallesSnap();
