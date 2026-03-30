# Dolphin AI Agent — Local Ticket Processor

## How It Works

1. User runs: `cd backend && npx tsx ../agent/sync-tickets.ts`
2. Script pulls pending tickets from DB → saves as markdown in `agent/pending/`
3. User opens Claude Code and says: **"شوف التذاكر"**
4. Claude reads `agent/pending/_summary.md` to see all tickets
5. Claude reads individual ticket files for details
6. Claude creates a **plan** for each ticket
7. **User approves, rejects, or partially approves** the plan
8. Claude executes only approved parts

## Commands

| الأمر | الوظيفة |
|---|---|
| "شوف التذاكر" | عرض ملخص كل التذاكر المعلقة |
| "حلل تذكرة XXXXX" | تحليل تذكرة معينة + عمل خطة تنفيذ |
| "نفذ خطة تذكرة XXXXX" | تنفيذ الخطة بعد الموافقة |
| "حدّث حالة تذكرة XXXXX" | تحديث حالة التذكرة في DB |

## Workflow for Each Ticket Type

### Bug (مشكلة)
1. Read the ticket description and pageUrl
2. Find the relevant code files
3. Identify the root cause
4. **Present a plan** with:
   - Root cause analysis
   - Proposed fix (show the code changes)
   - Files affected
   - Risk assessment
5. **Wait for user approval**
6. If approved → implement fix, commit, update ticket status

### Improvement (تحسين)
1. Read the ticket description
2. Analyze current code state
3. **Present a plan** with:
   - Current behavior vs requested behavior
   - Implementation approach
   - Files to modify
   - Estimated complexity
5. **Wait for user approval**
6. If approved → implement, commit, update ticket status

### Suggestion (اقتراح)
1. Read the suggestion
2. Evaluate feasibility by reading relevant code
3. **Present analysis** with:
   - Is it feasible?
   - What would need to change?
   - Pros and cons
4. **Wait for user decision** on whether to proceed

## Updating Ticket Status

After processing a ticket, update its status:
```bash
cd backend && npx tsx ../agent/ticket-updater.ts --id <TICKET_ID> --status <STATUS> --comment "..."
```

Statuses: `new` → `reviewing` → `in_progress` → `resolved` → `closed`

## Project Structure Reference

```
backend/src/modules/
├── leads/         → CRM (leads, orders, shifts)
├── marketing/     → Marketing (creatives, campaigns, Meta Ads)
├── tickets/       → Tickets system
├── settings/      → Platform settings
└── notifications/ → Notifications

frontend/src/modules/
├── leads/         → Leads UI
├── marketing/     → Marketing UI
├── settings/      → Settings UI (tickets admin page here)
├── auth/          → Authentication
└── knowledge-base/ → Product KB
```

## Page URL → Code Mapping

| URL | Frontend | Backend |
|---|---|---|
| `/leads/leads/*` | `modules/leads/pages/leads/` | `modules/leads/routes/index.ts` |
| `/leads/orders/*` | `modules/leads/pages/orders/` | `modules/leads/routes/orders.ts` |
| `/marketing/*` | `modules/marketing/pages/` | `modules/marketing/routes/` |
| `/settings/*` | `modules/settings/pages/` | `modules/settings/routes/` |
| `/knowledge-base/*` | `modules/knowledge-base/` | `modules/knowledge-base/routes/` |
