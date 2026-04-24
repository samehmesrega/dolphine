import multer from 'multer';
import path from 'path';
import type { RequestHandler } from 'express';
import { config } from '../config';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const maxSize = config.upload.maxSizeMB * 1024 * 1024;

const imageFilter = (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept?: boolean) => void) => {
  const mimeAllowed = /jpeg|jpg|png|gif|webp/i.test(file.mimetype);
  const extAllowed = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname);
  if (mimeAllowed && extAllowed) cb(null, true);
  else cb(new Error('نوع الملف غير مسموح. استخدم صورة (jpg, png, gif, webp)'));
};

// Accepts multiple transfer images under field name "transferImages",
// plus a single legacy field "transferImage" for backward compatibility.
const multi = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: imageFilter,
}).fields([
  { name: 'transferImages', maxCount: 10 },
  { name: 'transferImage', maxCount: 1 },
]);

export const uploadSingle: RequestHandler = (req, res, next) => {
  multi(req, res, (err: unknown) => {
    if (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ error: 'حجم الصورة كبير جداً' });
      return res.status(400).json({ error: e.message || 'خطأ في رفع الملف' });
    }
    next();
  });
};

export const upload = multer({
  storage,
  limits: { fileSize: maxSize },
});
