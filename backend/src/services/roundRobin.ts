/**
 * توزيع الليدز تلقائياً (Round Robin) حسب الشيفتات النشطة
 */

import { prisma } from '../db';

function getCurrentDayAndTime(): { dayOfWeek: number; time: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = الأحد
  const h = now.getHours();
  const m = now.getMinutes();
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { dayOfWeek, time };
}

function isTimeBetween(time: string, start: string, end: string): boolean {
  return time >= start && time <= end;
}

/**
 * يُرجع userId للموظف التالي في التوزيع (الأقل عدد ليدز معيّنة له)، أو null إن لم يوجد شيفت نشط
 */
export async function getNextAssignedUserId(): Promise<string | null> {
  const { dayOfWeek, time } = getCurrentDayAndTime();
  const shifts = await prisma.shift.findMany({
    where: {
      isActive: true,
      roundRobin: true,
      shiftMembers: { some: {} },
    },
    include: {
      shiftMembers: {
        orderBy: { orderNum: 'asc' },
        select: { userId: true },
      },
    },
  });

  const candidateUserIds: string[] = [];
  for (const shift of shifts) {
    const days = shift.daysOfWeek as number[] | null;
    if (!Array.isArray(days) || !days.includes(dayOfWeek)) continue;
    if (!isTimeBetween(time, shift.startTime, shift.endTime)) continue;
    for (const m of shift.shiftMembers) {
      candidateUserIds.push(m.userId);
    }
  }

  if (candidateUserIds.length === 0) return null;

  // عد الليدز المعيّنة لكل مستخدم (بدون حد زمني بسيط)
  const counts = await prisma.lead.groupBy({
    by: ['assignedToId'],
    where: { assignedToId: { in: candidateUserIds } },
    _count: { id: true },
  });

  const countByUser = new Map<string, number>();
  for (const id of candidateUserIds) countByUser.set(id, 0);
  for (const row of counts) {
    if (row.assignedToId) countByUser.set(row.assignedToId, row._count.id);
  }

  // الاختيار: الأقل عدداً مع الحفاظ على ترتيب الشيفت (أول من يظهر بأقل عدد)
  let minCount = Infinity;
  let chosen: string | null = null;
  for (const uid of candidateUserIds) {
    const c = countByUser.get(uid) ?? 0;
    if (c < minCount) {
      minCount = c;
      chosen = uid;
    }
  }
  return chosen;
}
