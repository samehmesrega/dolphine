import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

const createShiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  roundRobin: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const updateShiftSchema = createShiftSchema.partial();

router.get('/', async (_req: Request, res: Response) => {
  const shifts = await prisma.shift.findMany({
    orderBy: { name: 'asc' },
    include: {
      shiftMembers: {
        orderBy: { orderNum: 'asc' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  res.json({ shifts });
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftMembers: {
        orderBy: { orderNum: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!shift) {
    res.status(404).json({ error: 'الشيفت غير موجود' });
    return;
  }
  res.json({ shift });
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
    return;
  }
  const shift = await prisma.shift.create({
    data: {
      name: parsed.data.name,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      daysOfWeek: (parsed.data.daysOfWeek as number[]) as unknown as Prisma.InputJsonValue,
      roundRobin: parsed.data.roundRobin,
      isActive: parsed.data.isActive,
    },
    include: { shiftMembers: { include: { user: { select: { id: true, name: true } } } } },
  });
  res.status(201).json({ shift });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
    return;
  }
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) {
    res.status(404).json({ error: 'الشيفت غير موجود' });
    return;
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.startTime !== undefined) data.startTime = parsed.data.startTime;
  if (parsed.data.endTime !== undefined) data.endTime = parsed.data.endTime;
  if (parsed.data.daysOfWeek !== undefined) data.daysOfWeek = parsed.data.daysOfWeek as unknown as Prisma.InputJsonValue;
  if (parsed.data.roundRobin !== undefined) data.roundRobin = parsed.data.roundRobin;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  const updated = await prisma.shift.update({
    where: { id },
    data,
    include: { shiftMembers: { include: { user: { select: { id: true, name: true } } } } },
  });
  res.json({ shift: updated });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) {
    res.status(404).json({ error: 'الشيفت غير موجود' });
    return;
  }
  await prisma.shift.delete({ where: { id } });
  res.status(204).send();
});

const addMemberSchema = z.object({ userId: z.string().uuid(), orderNum: z.number().int().min(0).optional().default(0) });

router.post('/:id/members', async (req: Request, res: Response) => {
  const shiftId = String(req.params.id);
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
    return;
  }
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    res.status(404).json({ error: 'الشيفت غير موجود' });
    return;
  }
  const member = await prisma.shiftMember.create({
    data: { shiftId, userId: parsed.data.userId, orderNum: parsed.data.orderNum },
    include: { user: { select: { id: true, name: true } } },
  });
  res.status(201).json({ shiftMember: member });
});

router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  const shiftId = String(req.params.id);
  const userId = String(req.params.userId);
  const member = await prisma.shiftMember.findFirst({ where: { shiftId, userId } });
  if (!member) {
    res.status(404).json({ error: 'العضو غير موجود في الشيفت' });
    return;
  }
  await prisma.shiftMember.delete({ where: { id: member.id } });
  res.status(204).send();
});

export default router;
