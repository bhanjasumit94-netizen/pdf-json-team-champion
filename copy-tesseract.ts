import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public', 'tesseract');
fs.mkdirSync(publicDir, { recursive: true });

function copyFile(src, destFilename) {
  const dest = path.join(publicDir, destFilename);
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} to ${dest}`);
}

copyFile('node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js');
// tesseract v7 has several core versions. Let's just copy all .js and .wasm files from tesseract.js-core.
const coreDir = 'node_modules/tesseract.js-core';
const files = fs.readdirSync(coreDir);
files.forEach(f => {
  if (f.endsWith('.js') || f.endsWith('.wasm')) {
    copyFile(path.join(coreDir, f), f);
  }
});
