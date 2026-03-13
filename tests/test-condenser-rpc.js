const { Client } = require('/home/adam/Projects/skatehive/monorepo/mobileapp/node_modules/@hiveio/dhive');

const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://techcoderx.com",
  "https://api.hive.blog",
  "https://anyx.io",
]);

async function testRPC() {
  const username = 'vaipraonde';
  
  console.log('--- Testing condenser_api.get_following for "blog" ---');
  try {
    const result = await HiveClient.call('condenser_api', 'get_following', [username, '', 'blog', 10]);
    console.log('Success!', result.length, 'results');
    if (result.length > 0) console.log('First following:', result[0].following);
  } catch (error) {
    console.error('Failed:', error.message);
  }

  console.log('\n--- Testing condenser_api.get_followers for "blog" ---');
  try {
    const result = await HiveClient.call('condenser_api', 'get_followers', [username, '', 'blog', 10]);
    console.log('Success!', result.length, 'results');
    if (result.length > 0) console.log('First follower:', result[0].follower);
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

testRPC();
