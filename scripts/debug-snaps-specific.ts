import { Client } from '@hiveio/dhive';

const client = new Client(['https://api.hive.blog', 'https://api.deathwing.me', 'https://anyx.io']);

async function debugSnaps(username: string) {
  console.log(`\n--- Debugging SNAPS for @${username} ---`);
  try {
    // Snaps are usually comments. We can get them via get_account_history or just searching discussions by author if they are treated as posts in some contexts, 
    // but the user said "snaps are not posts, are comments inside a post".
    // Let's try to get content for recent perminks if we can find them, or use get_discussions_by_comments
    
    const comments = await client.database.call('get_discussions_by_comments', [{
      start_author: username,
      limit: 10
    }]);

    comments.forEach((snap: any, index: number) => {
      console.log(`\n[Snap ${index}] @${snap.author}/${snap.permlink}`);
      console.log(`Content Snapshot (first 500 chars):\n${snap.body.substring(0, 500)}...`);
      
      const hasOdysee = snap.body.includes('odysee.com');
      const hasIPFS = snap.body.includes('ipfs.skatehive.app') || snap.body.includes('data-ipfs-hash');
      const hasYouTube = snap.body.includes('youtube.com') || snap.body.includes('youtu.be');
      const hasIframe = snap.body.includes('<iframe');
      
      console.log(`Media: Odysee=${hasOdysee}, IPFS=${hasIPFS}, YouTube=${hasYouTube}, Iframe=${hasIframe}`);
    });
  } catch (error) {
    console.error(`Error fetching snaps for ${username}:`, error);
  }
}

async function run() {
  await debugSnaps('skaters');
  await debugSnaps('nogenta');
}

run();
