const { Client } = require('/home/adam/Projects/skatehive/monorepo/mobileapp/node_modules/@hiveio/dhive');

const HiveClient = new Client([
  "https://api.deathwing.me",
  "https://techcoderx.com",
  "https://api.hive.blog",
  "https://anyx.io",
]);

async function testRPC() {
  const username = 'vaipraonde';
  
  console.log('--- Testing bridge.get_following for "blog" ---');
  
  const variants = [
    { account: username, start: '', sort: 'blog', limit: 10 },
    { account: username, start: '', type: 'blog', limit: 10 },
  ];

  for (const params of variants) {
    console.log(`Testing with params: ${JSON.stringify(params)}`);
    try {
      const result = await HiveClient.call('bridge', 'get_following', params);
      console.log('Success!', result.length, 'results');
    } catch (error) {
      console.error('Failed:', error.message);
    }
  }

  console.log('\n--- Testing bridge.get_followers for "blog" ---');
  const followerVariants = [
    { account: username, start: '', sort: 'blog', limit: 10 },
    { account: username, start: '', type: 'blog', limit: 10 },
  ];

  for (const params of followerVariants) {
    console.log(`Testing with params: ${JSON.stringify(params)}`);
    try {
      const result = await HiveClient.call('bridge', 'get_followers', params);
      console.log('Success!', result.length, 'results');
    } catch (error) {
      console.error('Failed:', error.message);
    }
  }
}

testRPC();
