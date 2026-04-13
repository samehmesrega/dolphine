/**
 * BullMQ Workers — معالجات المهام في الخلفية
 *
 * 1. publish-posts: ينشر الـ posts المجدولة اللي وصل وقتها
 * 2. task-rules: يفحص قواعد المهام وينشئ tasks تلقائي
 * 3. meta-sync: يزامن Meta Ads (بدل setInterval)
 */

import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { prisma } from '../../db';

const connection = redis as any;
const workers: Worker[] = [];

// ═══════════════════════════════════════════════════════════
// Worker 1: Publish Scheduled Posts
// يفحص كل دقيقة — لو فيه post حالته SCHEDULED ووقته فات → ينشره
// ═══════════════════════════════════════════════════════════

async function processScheduledPosts(): Promise<number> {
  const now = new Date();

  // جيب كل الـ posts اللي حالتها SCHEDULED ووقتها <= الآن
  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: {
      pages: {
        include: {
          socialPage: true,
        },
      },
      creative: true,
    },
  });

  if (posts.length === 0) return 0;

  let published = 0;

  for (const post of posts) {
    try {
      // حدّث الحالة لـ PUBLISHING عشان ما حدش تاني ياخده
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHING' },
      });

      const { decryptToken } = await import('../utils/token-encryption');

      let allSuccess = true;

      // انشر على كل صفحة مربوطة
      for (const postPage of post.pages) {
        const page = postPage.socialPage;
        if (!page.isActive || !page.accessToken) continue;

        try {
          const token = decryptToken(page.accessToken);
          const graphUrl = `https://graph.facebook.com/v21.0/${page.pageId}`;

          if (post.postType === 'POST' || post.postType === 'REEL') {
            // نشر post عادي أو reel
            if (post.mediaUrl) {
              // صورة أو فيديو
              const endpoint = post.mediaUrl.match(/\.(mp4|mov|avi)/i)
                ? `${graphUrl}/videos`
                : `${graphUrl}/photos`;
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: post.mediaUrl,
                  ...(post.caption ? { message: post.caption, description: post.caption } : {}),
                  access_token: token,
                }),
              });
              const data = await res.json() as { id?: string; error?: { message: string } };
              if (data.error) throw new Error(data.error.message);

              await prisma.scheduledPostPage.update({
                where: { id: postPage.id },
                data: { publishedId: data.id, status: 'PUBLISHED' },
              });
            } else {
              // نص فقط
              const res = await fetch(`${graphUrl}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: post.caption,
                  access_token: token,
                }),
              });
              const data = await res.json() as { id?: string; error?: { message: string } };
              if (data.error) throw new Error(data.error.message);

              await prisma.scheduledPostPage.update({
                where: { id: postPage.id },
                data: { publishedId: data.id, status: 'PUBLISHED' },
              });
            }
          } else if (post.postType === 'STORY') {
            // Stories — photo upload مع published=false ثم story publish
            if (post.mediaUrl) {
              const res = await fetch(`${graphUrl}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: post.mediaUrl,
                  published: false,
                  access_token: token,
                }),
              });
              const data = await res.json() as { id?: string; error?: { message: string } };
              if (data.error) throw new Error(data.error.message);

              await prisma.scheduledPostPage.update({
                where: { id: postPage.id },
                data: { publishedId: data.id, status: 'PUBLISHED' },
              });
            }
          }

          logger.info(`[PublishWorker] Published post ${post.id} to page ${page.pageName}`);
        } catch (pageErr: any) {
          allSuccess = false;
          logger.error({ err: pageErr }, `[PublishWorker] Failed to publish post ${post.id} to page ${page.pageName}`);
          await prisma.scheduledPostPage.update({
            where: { id: postPage.id },
            data: { status: 'FAILED', error: pageErr.message?.slice(0, 500) },
          });
        }
      }

      // حدّث الحالة النهائية
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: allSuccess ? 'PUBLISHED' : 'FAILED',
          publishedAt: allSuccess ? new Date() : undefined,
          error: allSuccess ? null : 'بعض الصفحات فشلت في النشر',
        },
      });

      if (allSuccess) published++;
    } catch (err: any) {
      logger.error({ err }, `[PublishWorker] Error processing post ${post.id}`);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'FAILED', error: err.message?.slice(0, 500) },
      });
    }
  }

  return published;
}

// ═══════════════════════════════════════════════════════════
// Worker 2: Task Rules Check
// يفحص كل ساعة — لو فيه lead في حالة معينة لمدة X ساعة → ينشئ task
// ═══════════════════════════════════════════════════════════

async function processTaskRules(): Promise<number> {
  const rules = await prisma.taskRule.findMany({ where: { isActive: true } });
  let created = 0;

  for (const rule of rules) {
    const r = rule as any;
    const cutoff = new Date(Date.now() - r.afterHours * 3_600_000);

    // ليدز في حالة معينة ومر عليها X ساعة من تغيير الحالة
    // بدون مهمة pending من نفس القاعدة
    const leads = await prisma.lead.findMany({
      where: {
        status: { slug: r.statusSlug },
        lastStatusChangedAt: { lte: cutoff },
        assignedToId: { not: null },
        deletedAt: null,
        NOT: [{ tasks: { some: { ruleId: r.id, status: 'pending' } } }],
      },
      select: { id: true, name: true, assignedToId: true },
    });

    for (const lead of leads) {
      if (!lead.assignedToId) continue;
      await prisma.task.create({
        data: {
          type: 'rule_task',
          title: `${r.action}: ${lead.name}`,
          leadId: lead.id,
          assignedToId: lead.assignedToId,
          ruleId: r.id,
          status: 'pending',
        },
      });
      created++;
    }
  }

  return created;
}

// ═══════════════════════════════════════════════════════════
// Worker 3: Meta Ads Sync
// يزامن كل الحسابات النشطة كل ساعتين
// ═══════════════════════════════════════════════════════════

async function processMetaSync(): Promise<number> {
  const { autoSyncAll } = await import('../../modules/marketing/services/meta-ads.service');
  await autoSyncAll();
  return 1;
}

// ═══════════════════════════════════════════════════════════
// Start all workers
// ═══════════════════════════════════════════════════════════

export function startWorkers(): void {
  // Worker 1: Scheduled Posts
  const publishWorker = new Worker(
    'publish-posts',
    async () => {
      const count = await processScheduledPosts();
      if (count > 0) logger.info(`[PublishWorker] Published ${count} posts`);
    },
    { connection, concurrency: 1 },
  );
  publishWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, '[PublishWorker] Job failed');
  });
  workers.push(publishWorker);

  // Worker 2: Task Rules
  const rulesWorker = new Worker(
    'task-rules',
    async () => {
      const count = await processTaskRules();
      if (count > 0) logger.info(`[TaskRulesWorker] Created ${count} tasks`);
    },
    { connection, concurrency: 1 },
  );
  rulesWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, '[TaskRulesWorker] Job failed');
  });
  workers.push(rulesWorker);

  // Worker 3: Meta Sync
  const metaWorker = new Worker(
    'meta-sync',
    async () => {
      await processMetaSync();
    },
    { connection, concurrency: 1 },
  );
  metaWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, '[MetaSyncWorker] Job failed');
  });
  workers.push(metaWorker);

  logger.info('[Workers] All 3 workers started: publish-posts, task-rules, meta-sync');
}

/** Graceful shutdown — يقفل كل الـ workers */
export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  logger.info('[Workers] All workers stopped');
}
