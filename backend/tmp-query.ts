import { fullSync } from './src/modules/marketing/services/meta-ads.service';

async function main() {
  try {
    console.log('Starting full sync...');
    const result = await fullSync('f8b5e156-9c67-4548-9f0c-302b7b3aae03');
    console.log('Done!', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
main();
