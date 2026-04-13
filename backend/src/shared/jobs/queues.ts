/**
 * BullMQ Queues — تعريف طوابير المهام
 * كل queue مسؤول عن نوع واحد من المهام
 */

import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const connection = redis as any;

// ── Queues ─────────────────────────────────────────────

/** نشر الـ posts المجدولة على منصات التواصل */
export const publishPostsQueue = new Queue('publish-posts', { connection });

/** فحص قواعد المهام وإنشاء tasks تلقائي */
export const taskRulesQueue = new Queue('task-rules', { connection });

/** مزامنة Meta Ads (بدل setInterval) */
export const metaSyncQueue = new Queue('meta-sync', { connection });

// ── Setup repeatable jobs ──────────────────────────────

/**
 * يُستدعى مرة واحدة عند بدء الـ server
 * يضيف الـ repeatable jobs (لو مش موجودة)
 */
export async function setupRepeatableJobs(): Promise<void> {
  try {
    // Publish posts — كل دقيقة (يفحص لو فيه post وصل وقته)
    await publishPostsQueue.upsertJobScheduler(
      'check-scheduled-posts',
      { every: 60_000 },
      { data: {} },
    );

    // Task rules — كل ساعة
    await taskRulesQueue.upsertJobScheduler(
      'check-task-rules',
      { every: 3_600_000 },
      { data: {} },
    );

    // Meta ads sync — كل ساعتين
    await metaSyncQueue.upsertJobScheduler(
      'auto-sync-meta-ads',
      { every: 7_200_000 },
      { data: {} },
    );

    logger.info('[Jobs] Repeatable jobs scheduled: publish-posts (1m), task-rules (1h), meta-sync (2h)');
  } catch (err) {
    logger.warn({ err }, '[Jobs] Failed to setup repeatable jobs (Redis may be down)');
  }
}
