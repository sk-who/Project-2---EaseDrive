import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  keyFilename: process.env.GCS_KEY_FILE,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

export async function uploadToGCS(buffer, filename, mimetype) {
  const file = bucket.file(filename);

  const stream = file.createWriteStream({
    metadata: {
      contentType: mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', async () => {
      await file.makePublic(); // So the URL is publicly accessible
      resolve(`https://storage.googleapis.com/${bucket.name}/${filename}`);
    });
    stream.end(buffer);
  });
}