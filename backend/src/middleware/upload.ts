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

const single = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('نوع الملف غير مسموح. استخدم صورة (jpg, png, gif, webp)'));
  },
}).single('transferImage');

export const uploadSingle: RequestHandler = (req, res, next) => {
  single(req, res, (err: unknown) => {
    if (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'حجم الصورة كبير جداً' });
      return res.status(400).json({ error: e.message || 'خطأ في رفع الملف' });
    }
    next();
  });
};
