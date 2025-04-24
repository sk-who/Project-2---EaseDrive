import { Storage } from '@google-cloud/storage';

const storage = new Storage({ keyFilename: process.env.GCS_KEY_FILE });
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

export async function uploadToGCS(fileBuffer, filename, mimetype) {
  const file = bucket.file(filename);
  const stream = file.createWriteStream({
    metadata: {
      contentType: mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', () => {
      resolve(`https://storage.googleapis.com/${bucket.name}/${filename}`);
    });
    stream.end(fileBuffer);
  });
}