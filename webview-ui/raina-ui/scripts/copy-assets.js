import { cp } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const source = path.resolve(__dirname, '../dist');
const target = path.resolve(__dirname, '../../../media/raina-ui'); // ✅ go up 3 levels

const run = async () => {
  try {
    await cp(source, target, { recursive: true });
    console.log(`✅ Copied build from ${source} to ${target}`);
  } catch (err) {
    console.error("❌ Failed to copy build output:", err);
  }
};

run();
