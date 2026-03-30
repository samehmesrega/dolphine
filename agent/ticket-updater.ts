/**
 * Ticket Updater — Update ticket status and add comments from the AI agent
 * Usage:
 *   npx tsx agent/ticket-updater.ts --id <ticket-id> --status reviewing
 *   npx tsx agent/ticket-updater.ts --id <ticket-id> --comment "Analysis: ..."
 *   npx tsx agent/ticket-updater.ts --id <ticket-id> --status resolved --comment "Fixed in commit abc123"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The AI agent user ID — will be created on first run
const AI_AGENT_NAME = 'Dolphin AI Agent';
const AI_AGENT_EMAIL = 'ai-agent@dolphin.local';

async function getOrCreateAgentUser(): Promise<string> {
  let agent = await prisma.user.findFirst({
    where: { email: AI_AGENT_EMAIL },
  });

  if (!agent) {
    // Find admin role for the agent
    const adminRole = await prisma.role.findFirst({
      where: { slug: 'admin' },
    });

    if (!adminRole) {
      throw new Error('Admin role not found — seed the database first');
    }

    agent = await prisma.user.create({
      data: {
        name: AI_AGENT_NAME,
        email: AI_AGENT_EMAIL,
        password: 'AI_AGENT_NO_LOGIN_' + Date.now(), // can't login
        roleId: adminRole.id,
        isActive: true,
        status: 'active',
      },
    });

    console.error(`Created AI Agent user: ${agent.id}`);
  }

  return agent.id;
}

interface UpdateArgs {
  id: string;
  status?: string;
  priority?: string;
  comment?: string;
}

function parseArgs(): UpdateArgs {
  const args = process.argv.slice(2);
  const parsed: UpdateArgs = { id: '' };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--id':
        parsed.id = args[++i];
        break;
      case '--status':
        parsed.status = args[++i];
        break;
      case '--priority':
        parsed.priority = args[++i];
        break;
      case '--comment':
        parsed.comment = args[++i];
        break;
    }
  }

  return parsed;
}

async function main() {
  const args = parseArgs();

  if (!args.id) {
    console.error('Usage: ticket-updater.ts --id <ticket-id> [--status ...] [--comment ...]');
    process.exit(1);
  }

  const agentUserId = await getOrCreateAgentUser();

  // Update status if provided
  if (args.status || args.priority) {
    const data: any = {};
    if (args.status) {
      data.status = args.status;
      if (args.status === 'resolved') {
        data.resolvedAt = new Date();
      }
    }
    if (args.priority) data.priority = args.priority;

    // Assign to agent if moving to reviewing/in_progress
    if (args.status === 'reviewing' || args.status === 'in_progress') {
      data.assignedTo = agentUserId;
    }

    await prisma.ticket.update({
      where: { id: args.id },
      data,
    });

    console.error(`Ticket ${args.id} updated: ${JSON.stringify(data)}`);
  }

  // Add comment if provided
  if (args.comment) {
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: args.id,
        userId: agentUserId,
        content: args.comment,
      },
    });

    console.error(`Comment added to ticket ${args.id}: ${comment.id}`);
  }

  console.log(JSON.stringify({ success: true, ticketId: args.id }));
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
