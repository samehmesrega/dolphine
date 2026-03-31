/**
 * Inbox Stats Service
 * Computes team and per-agent statistics for the inbox module
 */

import { prisma } from '../../../db';
import { Prisma } from '@prisma/client';

interface StatsFilters {
  brandId?: string;
  channelId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

interface AgentStats {
  userId: string;
  userName: string;
  conversationsHandled: number;
  messagesSent: number;
  commentReplies: number;
  avgResponseTimeMinutes: number | null;
  leadsConverted: number;
  ordersConverted: number;
}

interface TeamStatsResult {
  overview: {
    totalConversations: number;
    totalMessagesSent: number;
    totalCommentReplies: number;
    avgResponseTime: number | null;
    leadsCreated: number;
    ordersCreated: number;
  };
  agents: AgentStats[];
}

function buildDateFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}

function buildChannelFilter(filters: StatsFilters): any {
  if (filters.channelId) return { channelId: filters.channelId };
  if (filters.brandId) return { channel: { socialPage: { brandId: filters.brandId } } };
  return {};
}

/**
 * Get team stats with per-agent breakdown
 */
export async function getTeamStats(filters: StatsFilters): Promise<TeamStatsResult> {
  const dateFilter = buildDateFilter(filters.from, filters.to);
  const channelWhere = buildChannelFilter(filters);

  // Conversation filters
  const convWhere: any = { ...channelWhere };
  if (dateFilter) convWhere.createdAt = dateFilter;

  // Message filters (outbound only for sent count)
  const msgWhere: any = {
    direction: 'outbound',
    conversation: channelWhere,
  };
  if (dateFilter) msgWhere.createdAt = dateFilter;

  // Comment reply filters (outbound only)
  const commentWhere: any = {
    direction: 'outbound',
    thread: channelWhere,
  };
  if (dateFilter) commentWhere.createdAt = dateFilter;

  // Overview counts
  const [totalConversations, totalMessagesSent, totalCommentReplies] = await Promise.all([
    prisma.inboxConversation.count({ where: convWhere }),
    prisma.inboxMessage.count({ where: msgWhere }),
    prisma.inboxComment.count({ where: commentWhere }),
  ]);

  // Average response time from pre-computed field
  const avgResult = await prisma.inboxConversation.aggregate({
    where: { ...convWhere, firstResponseTimeMs: { not: null } },
    _avg: { firstResponseTimeMs: true },
  });
  const avgResponseTime = avgResult._avg.firstResponseTimeMs
    ? Math.round(avgResult._avg.firstResponseTimeMs / 60000) // ms to minutes
    : null;

  // Leads created from inbox (source = 'meta_inbox')
  const leadsWhere: any = { source: 'meta_inbox' };
  if (dateFilter) leadsWhere.createdAt = dateFilter;
  const leadsCreated = await prisma.lead.count({ where: leadsWhere });

  // Orders from inbox leads
  const ordersCreated = await prisma.order.count({
    where: {
      lead: { source: 'meta_inbox' },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
  });

  // Per-agent breakdown
  // Get all users who sent messages or replies in the period
  const outboundMessages = await prisma.inboxMessage.groupBy({
    by: ['sentByUserId'],
    where: { ...msgWhere, sentByUserId: { not: null } },
    _count: true,
  });

  const outboundComments = await prisma.inboxComment.groupBy({
    by: ['sentByUserId'],
    where: { ...commentWhere, sentByUserId: { not: null } },
    _count: true,
  });

  // Collect unique agent IDs
  const agentIds = new Set<string>();
  outboundMessages.forEach((m) => { if (m.sentByUserId) agentIds.add(m.sentByUserId); });
  outboundComments.forEach((c) => { if (c.sentByUserId) agentIds.add(c.sentByUserId); });

  // Also include agents with assigned conversations
  const assignedConvs = await prisma.inboxConversation.groupBy({
    by: ['assignedToId'],
    where: { ...convWhere, assignedToId: { not: null } },
    _count: true,
  });
  assignedConvs.forEach((a) => { if (a.assignedToId) agentIds.add(a.assignedToId); });

  // Fetch agent names
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(agentIds) } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // Build per-agent stats
  const agents: AgentStats[] = [];

  for (const agentId of agentIds) {
    const msgCount = outboundMessages.find((m) => m.sentByUserId === agentId)?._count || 0;
    const commentCount = outboundComments.find((c) => c.sentByUserId === agentId)?._count || 0;
    const convsHandled = assignedConvs.find((a) => a.assignedToId === agentId)?._count || 0;

    // Avg response time for this agent's conversations
    const agentAvg = await prisma.inboxConversation.aggregate({
      where: { ...convWhere, assignedToId: agentId, firstResponseTimeMs: { not: null } },
      _avg: { firstResponseTimeMs: true },
    });

    // Leads converted by this agent (conversations assigned to them that became leads)
    const agentLeads = await prisma.lead.count({
      where: {
        source: 'meta_inbox',
        inboxConversations: { some: { assignedToId: agentId } },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    // Orders from those leads
    const agentOrders = await prisma.order.count({
      where: {
        lead: {
          source: 'meta_inbox',
          inboxConversations: { some: { assignedToId: agentId } },
        },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    agents.push({
      userId: agentId,
      userName: userMap.get(agentId) || 'مجهول',
      conversationsHandled: convsHandled,
      messagesSent: msgCount,
      commentReplies: commentCount,
      avgResponseTimeMinutes: agentAvg._avg.firstResponseTimeMs
        ? Math.round(agentAvg._avg.firstResponseTimeMs / 60000)
        : null,
      leadsConverted: agentLeads,
      ordersConverted: agentOrders,
    });
  }

  // Sort by messages sent (most active first)
  agents.sort((a, b) => (b.messagesSent + b.commentReplies) - (a.messagesSent + a.commentReplies));

  return {
    overview: {
      totalConversations,
      totalMessagesSent,
      totalCommentReplies,
      avgResponseTime,
      leadsCreated,
      ordersCreated,
    },
    agents,
  };
}

/**
 * Get detailed stats for a single agent
 */
export async function getAgentDetail(userId: string, filters: StatsFilters) {
  const teamStats = await getTeamStats(filters);
  const agent = teamStats.agents.find((a) => a.userId === userId);

  if (!agent) {
    return { agent: null, dailyBreakdown: [] };
  }

  // Daily breakdown for charts
  const dateFilter = buildDateFilter(filters.from, filters.to);
  const channelWhere = buildChannelFilter(filters);

  const messages = await prisma.inboxMessage.findMany({
    where: {
      direction: 'outbound',
      sentByUserId: userId,
      conversation: channelWhere,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const comments = await prisma.inboxComment.findMany({
    where: {
      direction: 'outbound',
      sentByUserId: userId,
      thread: channelWhere,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const dailyMap = new Map<string, { messagesSent: number; commentReplies: number }>();

  for (const msg of messages) {
    const day = msg.createdAt.toISOString().split('T')[0];
    const entry = dailyMap.get(day) || { messagesSent: 0, commentReplies: 0 };
    entry.messagesSent++;
    dailyMap.set(day, entry);
  }

  for (const cmt of comments) {
    const day = cmt.createdAt.toISOString().split('T')[0];
    const entry = dailyMap.get(day) || { messagesSent: 0, commentReplies: 0 };
    entry.commentReplies++;
    dailyMap.set(day, entry);
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { agent, dailyBreakdown };
}
