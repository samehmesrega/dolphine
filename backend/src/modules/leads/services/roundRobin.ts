/**
 * توزيع الليدز تلقائياً (Round Robin) حسب الشيفتات النشطة
 */

import { prisma } from '../../../db';

function getCurrentDayAndTime(): { dayOfWeek: number; time: string } {
  // Use Egypt timezone (UTC+2) since shifts are configured in Egypt time
  const now = new Date();
  const egyptTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // UTC+2
  const dayOfWeek = egyptTime.getUTCDay(); // 0 = الأحد
  const h = egyptTime.getUTCHours();
  const m = egyptTime.getUTCMinutes();
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { dayOfWeek, time };
}

function isTimeBetween(time: string, start: string, end: string): boolean {
  return time >= start && time <= end;
}

export type AssignmentResult = {
  userId: string | null;
  reason?: string;
};

/**
 * يُرجع userId للموظف التالي في التوزيع (الأقل عدد ليدز معيّنة له)، أو null مع السبب
 */
export async function getNextAssignedUserId(): Promise<AssignmentResult> {
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

  if (shifts.length === 0) {
    return { userId: null, reason: 'لا يوجد شيفتات نشطة بها توزيع تلقائي' };
  }

  // جمع المرشحين مع إزالة التكرار لمنع تحيّز المستخدمين في شيفتات متعددة
  const seenUserIds = new Set<string>();
  const candidateUserIds: string[] = [];
  for (const shift of shifts) {
    const days = shift.daysOfWeek as number[] | null;
    if (!Array.isArray(days) || !days.includes(dayOfWeek)) continue;
    if (!isTimeBetween(time, shift.startTime, shift.endTime)) continue;
    for (const m of shift.shiftMembers) {
      if (!seenUserIds.has(m.userId)) {
        seenUserIds.add(m.userId);
        candidateUserIds.push(m.userId);
      }
    }
  }

  if (candidateUserIds.length === 0) {
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return { userId: null, reason: `لا يوجد شيفت نشط الآن (${dayNames[dayOfWeek]} ${time} توقيت مصر)` };
  }

  // عد الليدز المعيّنة لكل مستخدم
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

  // الاختيار: الأقل عدداً مع الحفاظ على ترتيب الشيفت
  let minCount = Infinity;
  let chosen: string | null = null;
  for (const uid of candidateUserIds) {
    const c = countByUser.get(uid) ?? 0;
    if (c < minCount) {
      minCount = c;
      chosen = uid;
    }
  }
  return { userId: chosen };
}
