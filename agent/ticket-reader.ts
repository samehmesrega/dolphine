/**
 * Ticket Reader — Standalone script to query unprocessed tickets from DB
 * Usage: npx tsx agent/ticket-reader.ts [--status new] [--type bug] [--limit 5] [--id <ticket-id>]
 *
 * Outputs JSON to stdout for consumption by the agent runner
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TicketQuery {
  status?: string;
  type?: string;
  limit?: number;
  id?: string;
}

function parseArgs(): TicketQuery {
  const args = process.argv.slice(2);
  const query: TicketQuery = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--status':
        query.status = args[++i];
        break;
      case '--type':
        query.type = args[++i];
        break;
      case '--limit':
        query.limit = parseInt(args[++i], 10);
        break;
      case '--id':
        query.id = args[++i];
        break;
    }
  }

  return query;
}

async function main() {
  const query = parseArgs();

  // If specific ticket ID requested
  if (query.id) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: query.id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      console.error(`Ticket ${query.id} not found`);
      process.exit(1);
    }

    console.log(JSON.stringify(ticket, null, 2));
    return;
  }

  // Query tickets
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  // Default: new bugs only
  if (!query.status && !query.type) {
    where.status = 'new';
    where.type = 'bug';
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [
      { priority: 'asc' }, // critical first
      { createdAt: 'asc' }, // oldest first
    ],
    take: query.limit || 5,
  });

  console.log(JSON.stringify(tickets, null, 2));
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
