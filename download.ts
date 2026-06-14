import fs from 'fs';
import https from 'https';

const url = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz';
const dest = 'public/eng.traineddata.gz';

fs.mkdirSync('public', { recursive: true });

const file = fs.createWriteStream(dest);
https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close();
    console.log('Downloaded eng.traineddata.gz');
  });
}).on('error', function(err) {
  fs.unlink(dest, () => {});
  console.error('Error downloading:', err.message);
});
