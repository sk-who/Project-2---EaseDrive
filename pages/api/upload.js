import multer from 'multer';
import nextConnect from 'next-connect';
import { uploadToGCS } from '../../lib/gcs';
import sharp from 'sharp';

const upload = multer();

const apiRoute = nextConnect({
  onError(error, req, res) {
    res.status(501).json({ error: `Something went wrong! ${error.message}` });
  },
});

apiRoute.use(upload.single('file'));

apiRoute.post(async (req, res) => {
  const compressedBuffer = await sharp(req.file.buffer)
    .resize(800) // Resize to max width 800px
    .jpeg({ quality: 70 })
    .toBuffer();

  const url = await uploadToGCS(compressedBuffer, req.file.originalname, req.file.mimetype);
  res.status(200).json({ url });
});

export default apiRoute;
export const config = { api: { bodyParser: false } };