import { Client } from '@hiveio/dhive';
const client = new Client('https://api.hive.blog');
async function run() {
  const result = await client.database.call('get_discussions_by_feed', [{tag: 'vaipraonde', limit: 10}]);
  console.log('Results length:', result.length);
  result.forEach(r => console.log('Author:', r.author, 'Category:', r.category, 'Title:', r.title));
}
run().catch(console.error);
