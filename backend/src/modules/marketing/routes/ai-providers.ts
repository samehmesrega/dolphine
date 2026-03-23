import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../../shared/middleware/auth';
import { prisma } from '../../../db';
import { encryptToken, decryptToken } from '../../../shared/utils/token-encryption';

const router = Router();

const AI_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
};

// GET /api/v1/marketing/ai-providers
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const providers = await prisma.aiProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const result = providers.map((provider) => {
      let masked = '';
      if (provider.apiKey) {
        try {
          masked = decryptToken(provider.apiKey).slice(0, 6) + '****';
        } catch {
          masked = provider.apiKey.slice(0, 6) + '****';
        }
      }
      return {
        id: provider.id,
        provider: provider.provider,
        name: provider.name,
        maskedKey: masked,
        isActive: provider.isActive,
        createdAt: provider.createdAt,
      };
    });
    res.json({ providers: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/marketing/ai-providers/models
router.get('/models', async (_req: AuthRequest, res: Response) => {
  try {
    const activeProviders = await prisma.aiProvider.findMany({
      where: { isActive: true },
    });
    const models: Array<{ provider: string; id: string; name: string }> = [];
    for (const p of activeProviders) {
      const providerModels = AI_MODELS[p.provider];
      if (providerModels) {
        for (const m of providerModels) {
          models.push({ provider: p.provider, ...m });
        }
      }
    }
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/marketing/ai-providers
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { provider, name, apiKey } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider و apiKey مطلوبين' });
    }
    let encrypted: string;
    try {
      encrypted = encryptToken(apiKey);
    } catch (encErr: any) {
      return res.status(500).json({ error: 'TOKEN_ENCRYPTION_KEY غير مضبوط. أضفه في ملف .env' });
    }
    const result = await prisma.aiProvider.upsert({
      where: { provider },
      update: { name, apiKey: encrypted, isActive: true },
      create: { provider, name, apiKey: encrypted },
    });
    res.status(201).json({ provider: { id: result.id, provider: result.provider, name: result.name } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/marketing/ai-providers/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.aiProvider.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
