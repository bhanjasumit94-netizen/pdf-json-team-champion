import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public', 'pdfjs');
fs.mkdirSync(publicDir, { recursive: true });

function copyFile(src, destFilename) {
  const dest = path.join(publicDir, destFilename);
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} to ${dest}`);
}

copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs');
