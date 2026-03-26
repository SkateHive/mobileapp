import { Client } from '@hiveio/dhive';

const client = new Client(['https://api.hive.blog', 'https://api.deathwing.me', 'https://anyx.io']);

async function debugUserPosts(username: string) {
  console.log(`\n--- Debugging posts for @${username} ---`);
  try {
    const posts = await client.database.call('get_discussions_by_author_before_date', [
      username,
      '',
      new Date().toISOString().split('.')[0],
      10
    ]);

    posts.forEach((post: any, index: number) => {
      // console.log(`\n[Post ${index}] @${post.author}/${post.permlink}`);
      // console.log(`Title: ${post.title}`);
      // console.log(`JSON Metadata: ${post.json_metadata}`);
      // console.log(`BODY (RAW): \n${post.body.substring(0, 1000)}${post.body.length > 1000 ? '...' : ''}`);
      // console.log('------------------------------------------');
    });
  } catch (error) {
    console.error(`Error fetching posts for ${username}:`, error);
  }
}

async function debugUserComments(username: string) {
  console.log(`\n--- Debugging comments/snaps for @${username} ---`);
  try {
    const comments = await client.database.call('get_discussions_by_comments', [{
      start_author: username,
      limit: 10
    }]);

    comments.forEach((snap: any, index: number) => {
      console.log(`\n[Snap ${index}] @${snap.author}/${snap.permlink}`);
      console.log(`JSON Metadata: ${snap.json_metadata}`);
      console.log(`BODY (RAW): \n${snap.body.substring(0, 1000)}${snap.body.length > 1000 ? '...' : ''}`);
      console.log('------------------------------------------');
    });
  } catch (error) {
    console.error(`Error fetching comments for ${username}:`, error);
  }
}

async function run() {
  await debugUserPosts('sk84ever');
  await debugUserComments('sk84ever');
  await debugUserPosts('tallessilva');
  await debugUserComments('tallessilva');
}

run();
