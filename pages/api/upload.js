const multer = require('multer');
const nextConnect = require('next-connect');
const sharp = require('sharp');
const { uploadToGCS } = require('../../lib/gcs');

const upload = multer(); // memory storage

const apiRoute = nextConnect({
  onError(error, req, res) {
    res.status(501).json({ error: `Something went wrong! ${error.message}` });
  },
});

apiRoute.use(upload.single('file')); // 'file' is the field name in the form

apiRoute.post(async (req, res) => {
  const { buffer, originalname, mimetype } = req.file;

  // Resize & compress using sharp
  const compressedBuffer = await sharp(buffer)
    .resize(800) // Resize to max width 800px
    .jpeg({ quality: 70 })
    .toBuffer();

  const filename = Date.now() + '-' + originalname;

  const url = await uploadToGCS(compressedBuffer, filename, mimetype);

  res.status(200).json({ url });
});

export default apiRoute;

// Important: disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};