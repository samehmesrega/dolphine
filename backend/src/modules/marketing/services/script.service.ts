import { prisma } from '../../../db';
import type { ScriptStatus } from '@prisma/client';

interface CreateScriptInput {
  title: string;
  projectId: string;
  platform: string;
  audience?: string;
  language?: string;
  ideaId?: string;
  scenes?: {
    order: number;
    description: string;
    cameraAngle?: string;
    setting?: string;
    textOverlay?: string;
    voiceover?: string;
    durationSec?: number;
  }[];
}

export async function createScript(input: CreateScriptInput) {
  const { scenes, ...scriptData } = input;
  return prisma.script.create({
    data: {
      ...scriptData,
      scenes: scenes
        ? { create: scenes }
        : undefined,
    },
    include: { scenes: { orderBy: { order: 'asc' } }, project: true },
  });
}

export async function listScripts(filters: {
  projectId?: string;
  status?: ScriptStatus;
  page?: number;
  pageSize?: number;
}) {
  const { projectId, status, page = 1, pageSize = 20 } = filters;
  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;

  const [scripts, total] = await Promise.all([
    prisma.script.findMany({
      where,
      include: { project: true, idea: true, _count: { select: { scenes: true, versions: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.script.count({ where }),
  ]);

  return { scripts, total, page, pageSize };
}

export async function getScriptById(id: string) {
  return prisma.script.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: 'asc' } },
      versions: { orderBy: { version: 'desc' } },
      project: true,
      idea: true,
      assignee: true,
    },
  });
}

export async function updateScript(id: string, data: Record<string, unknown>) {
  return prisma.script.update({
    where: { id },
    data,
    include: { scenes: { orderBy: { order: 'asc' } }, project: true },
  });
}

export async function updateScriptStatus(id: string, status: ScriptStatus) {
  return prisma.script.update({
    where: { id },
    data: { status },
  });
}

export async function assignScript(id: string, assignedTo: string) {
  return prisma.script.update({
    where: { id },
    data: { assignedTo },
  });
}

export async function updateScene(id: string, sceneId: string, data: Record<string, unknown>) {
  return prisma.scriptScene.update({
    where: { id: sceneId, scriptId: id },
    data,
  });
}

export async function createScriptVersion(scriptId: string) {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    include: { scenes: { orderBy: { order: 'asc' } } },
  });
  if (!script) throw new Error('Script not found');

  const lastVersion = await prisma.scriptVersion.findFirst({
    where: { scriptId },
    orderBy: { version: 'desc' },
  });

  return prisma.scriptVersion.create({
    data: {
      scriptId,
      version: (lastVersion?.version ?? 0) + 1,
      content: { title: script.title, scenes: script.scenes },
    },
  });
}
