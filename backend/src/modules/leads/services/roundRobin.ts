/**
 * توزيع الليدز تلقائياً (Round Robin حقيقي) حسب الشيفتات النشطة
 * - بيوزّع بالتوالي: 1→2→3→1→2→3
 * - بيرجع من الأول كل يوم
 * - بيدعم شيفتات بعد منتصف الليل
 * - بيدعم التوقيت الصيفي (Africa/Cairo)
 * - بيتأكد إن الموظف active
 */

import { prisma } from '../../../db';

// ===== Timezone-safe current time in Egypt =====

function getCurrentDayAndTime(): { dayOfWeek: number; time: string; dateStr: string } {
  const now = new Date();
  // استخدم Africa/Cairo عشان يدعم التوقيت الصيفي تلقائي
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[get('weekday')] ?? now.getDay();
  const h = get('hour').padStart(2, '0');
  const m = get('minute').padStart(2, '0');
  const time = `${h}:${m}`;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

  return { dayOfWeek, time, dateStr };
}

// ===== Midnight-crossing safe time check =====

function isTimeBetween(time: string, start: string, end: string): boolean {
  if (start <= end) {
    // شيفت عادي (مثلاً 08:00 - 16:00)
    return time >= start && time <= end;
  }
  // شيفت يعدّي منتصف الليل (مثلاً 22:00 - 06:00)
  return time >= start || time <= end;
}

// ===== Types =====

export type AssignmentResult = {
  userId: string | null;
  reason?: string;
};

// ===== Main function =====

/**
 * يُرجع userId للموظف التالي في التوزيع بالتوالي، أو null مع السبب
 */
export async function getNextAssignedUserId(): Promise<AssignmentResult> {
  const { dayOfWeek, time, dateStr } = getCurrentDayAndTime();
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // 1. جيب كل الشيفتات النشطة + roundRobin مفعّل
  const shifts = await prisma.shift.findMany({
    where: {
      isActive: true,
      roundRobin: true,
    },
    include: {
      shiftMembers: {
        where: { dayOfWeek },
        orderBy: { orderNum: 'asc' },
        include: {
          user: { select: { id: true, isActive: true, status: true } },
        },
      },
    },
  });

  if (shifts.length === 0) {
    return { userId: null, reason: 'لا يوجد شيفتات نشطة بها توزيع تلقائي' };
  }

  // 2. فلتر بالوقت + جمع الموظفين الـ active
  let matchedShift: typeof shifts[0] | null = null;
  let candidates: string[] = [];

  for (const shift of shifts) {
    const days = shift.daysOfWeek as number[] | null;
    if (!Array.isArray(days) || !days.includes(dayOfWeek)) continue;
    if (!isTimeBetween(time, shift.startTime, shift.endTime)) continue;

    // فلتر الموظفين: لازم يكونوا active
    const activeMembers = shift.shiftMembers.filter(
      m => m.user.isActive && (m.user.status === 'active' || !m.user.status)
    );

    if (activeMembers.length > 0) {
      matchedShift = shift;
      candidates = activeMembers.map(m => m.userId);
      break; // الشيفتات مش بتتعارض — أول واحد يكفي
    }
  }

  if (!matchedShift || candidates.length === 0) {
    return {
      userId: null,
      reason: `لا يوجد شيفت نشط بموظفين فعّالين الآن (${dayNames[dayOfWeek]} ${time} توقيت مصر)`,
    };
  }

  // 3. لو موظف واحد بس → يروحله مباشرة
  if (candidates.length === 1) {
    return { userId: candidates[0] };
  }

  // 4. حساب الـ index التالي (Round Robin بالتوالي + reset يومي)
  let lastIndex = matchedShift.lastAssignedIndex;

  // لو يوم جديد → نرجع من الأول
  if (matchedShift.lastAssignedDate !== dateStr) {
    lastIndex = -1;
  }

  const nextIndex = (lastIndex + 1) % candidates.length;
  const chosenUserId = candidates[nextIndex];

  // 5. حدّث الـ shift بالـ index الجديد + التاريخ
  await prisma.shift.update({
    where: { id: matchedShift.id },
    data: {
      lastAssignedIndex: nextIndex,
      lastAssignedDate: dateStr,
    },
  });

  return { userId: chosenUserId };
}
