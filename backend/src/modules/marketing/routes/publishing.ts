import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import * as publishingService from '../services/publishing.service';
import type { PostStatus } from '@prisma/client';

const router = Router();

// GET /api/v1/marketing/calendar - Posts by date range
router.get('/calendar', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    if (!q.from || !q.to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }
    const posts = await publishingService.getCalendarPosts(q.from, q.to);
    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/posts
router.get('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await publishingService.listScheduledPosts({
      status: q.status as PostStatus | undefined,
      from: q.from,
      to: q.to,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/posts/:id
router.get('/posts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const post = await publishingService.getPostById(String(req.params.id));
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/posts
router.post('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const post = await publishingService.createScheduledPost({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json({ post });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/posts/:id
router.put('/posts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const post = await publishingService.updatePost(String(req.params.id), req.body);
    res.json({ post });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/v1/marketing/posts/:id/status
router.put('/posts/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const post = await publishingService.updatePostStatus(String(req.params.id), req.body.status);
    res.json({ post });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/posts/:id
router.delete('/posts/:id', async (req: AuthRequest, res: Response) => {
  try {
    await publishingService.deletePost(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Social Pages ---

// GET /api/v1/marketing/social-pages
router.get('/social-pages', async (_req: AuthRequest, res: Response) => {
  try {
    const pages = await publishingService.listSocialPages();
    res.json({ pages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/social-pages/connect
router.post('/social-pages/connect', async (req: AuthRequest, res: Response) => {
  try {
    const page = await publishingService.connectSocialPage(req.body);
    res.status(201).json({ page });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/social-pages/:id
router.delete('/social-pages/:id', async (req: AuthRequest, res: Response) => {
  try {
    await publishingService.disconnectSocialPage(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Brands ---

// GET /api/v1/marketing/brands
router.get('/brands', async (_req: AuthRequest, res: Response) => {
  try {
    const brands = await publishingService.listBrands();
    res.json({ brands });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/brands
router.post('/brands', async (req: AuthRequest, res: Response) => {
  try {
    const brand = await publishingService.createBrand(req.body);
    res.status(201).json({ brand });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
