/**
 * Sync Tickets — Pull new tickets from DB and save as local markdown files
 *
 * Usage: cd backend && npx tsx ../agent/sync-tickets.ts
 *
 * Creates/updates markdown files in agent/pending/ for Claude Code to read.
 * Run this before asking Claude to process tickets.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const AGENT_DIR = path.resolve(__dirname);
const PENDING_DIR = path.join(AGENT_DIR, 'pending');

const TYPE_LABELS: Record<string, string> = {
  bug: 'مشكلة',
  improvement: 'تحسين',
  suggestion: 'اقتراح',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'جديدة',
  reviewing: 'قيد المراجعة',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  closed: 'مغلقة',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'حرجة',
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

async function main() {
  // Create pending directory
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
  }

  // Fetch all non-closed, non-resolved tickets
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['resolved', 'closed'] },
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  });

  if (tickets.length === 0) {
    console.log('لا توجد تذاكر جديدة.');

    // Clean pending directory
    const existing = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.md'));
    for (const f of existing) {
      fs.unlinkSync(path.join(PENDING_DIR, f));
    }

    // Write empty summary
    fs.writeFileSync(
      path.join(PENDING_DIR, '_summary.md'),
      '# التذاكر المعلقة\n\nلا توجد تذاكر معلقة حالياً.\n'
    );
    return;
  }

  console.log(`تم العثور على ${tickets.length} تذكرة معلقة`);

  // Clean old files that no longer exist
  const existing = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.md') && f !== '_summary.md');
  const ticketIds = new Set(tickets.map(t => t.id));
  for (const f of existing) {
    const id = f.replace('.md', '');
    if (!ticketIds.has(id)) {
      fs.unlinkSync(path.join(PENDING_DIR, f));
    }
  }

  // Write each ticket as markdown
  for (const ticket of tickets) {
    const shortId = ticket.id.substring(0, 8);
    const typeLabel = TYPE_LABELS[ticket.type] || ticket.type;
    const statusLabel = STATUS_LABELS[ticket.status] || ticket.status;
    const priorityLabel = ticket.priority ? (PRIORITY_LABELS[ticket.priority] || ticket.priority) : 'غير محددة';

    let md = `# تذكرة: ${typeLabel} — ${shortId}\n\n`;
    md += `| الحقل | القيمة |\n|---|---|\n`;
    md += `| **المعرف** | \`${ticket.id}\` |\n`;
    md += `| **النوع** | ${typeLabel} |\n`;
    md += `| **الحالة** | ${statusLabel} |\n`;
    md += `| **الأولوية** | ${priorityLabel} |\n`;
    md += `| **المُبلِّغ** | ${ticket.creator.name} (${ticket.creator.email}) |\n`;
    md += `| **التاريخ** | ${ticket.createdAt.toISOString().split('T')[0]} |\n`;

    if (ticket.pageUrl) {
      md += `| **الصفحة** | \`${ticket.pageUrl}\` |\n`;
    }
    if (ticket.userAgent) {
      md += `| **المتصفح** | ${ticket.userAgent.substring(0, 80)}... |\n`;
    }

    md += `\n## الوصف\n\n${ticket.description}\n`;

    if (ticket.screenshot) {
      md += `\n## لقطة شاشة\n\n> موجودة (base64 محفوظة في قاعدة البيانات)\n`;
    }

    if (ticket.comments.length > 0) {
      md += `\n## التعليقات (${ticket.comments.length})\n\n`;
      for (const comment of ticket.comments) {
        const date = comment.createdAt.toISOString().split('T')[0];
        md += `**${comment.user.name}** (${date}):\n> ${comment.content}\n\n`;
      }
    }

    fs.writeFileSync(path.join(PENDING_DIR, `${ticket.id}.md`), md);
  }

  // Write summary file
  let summary = `# التذاكر المعلقة (${tickets.length})\n\n`;
  summary += `> آخر تحديث: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n\n`;

  // Group by type
  const byType: Record<string, typeof tickets> = {};
  for (const t of tickets) {
    const type = t.type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(t);
  }

  for (const [type, group] of Object.entries(byType)) {
    const typeLabel = TYPE_LABELS[type] || type;
    summary += `## ${typeLabel} (${group.length})\n\n`;

    for (const t of group) {
      const shortId = t.id.substring(0, 8);
      const statusLabel = STATUS_LABELS[t.status] || t.status;
      const desc = t.description.substring(0, 80).replace(/\n/g, ' ');
      summary += `- **[${shortId}](${t.id}.md)** — ${statusLabel} — ${desc}...\n`;
    }

    summary += '\n';
  }

  summary += `---\n\n`;
  summary += `## كيفية الاستخدام\n\n`;
  summary += `قل لـ Claude Code:\n`;
  summary += `- "شوف التذاكر" — لعرض ملخص كل التذاكر\n`;
  summary += `- "حلل تذكرة XXXXX" — لتحليل تذكرة معينة وعمل خطة\n`;
  summary += `- "نفذ خطة تذكرة XXXXX" — لتنفيذ الخطة المعتمدة\n`;

  fs.writeFileSync(path.join(PENDING_DIR, '_summary.md'), summary);

  console.log(`تم حفظ ${tickets.length} تذكرة في agent/pending/`);
  console.log('افتح Claude Code وقول: "شوف التذاكر"');
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
