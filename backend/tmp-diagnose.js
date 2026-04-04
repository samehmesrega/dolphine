process.env.GOOGLE_SERVICE_ACCOUNT_KEY = require('fs').readFileSync('C:\\Users\\sameh\\Downloads\\dolphine-488921-c9bc1cccb0b5.json', 'utf8');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { normalizePhone } = require('./dist/shared/utils/phone');

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SID = '1ln6Wrec0AoMKzlKLjSuudSSUHIkHuVjv0B-aXnPeAi8';

async function getToken() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const crypto = require('crypto');
  const h = Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iss:creds.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:creds.token_uri,iat:now,exp:now+3600})).toString('base64url');
  const s = crypto.createSign('RSA-SHA256');
  s.update(h+'.'+p);
  const sig = s.sign(creds.private_key,'base64url');
  const r = await fetch(creds.token_uri,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion='+h+'.'+p+'.'+sig});
  return (await r.json()).access_token;
}

(async () => {
  const token = await getToken();

  for (const rowNum of [6967, 6971]) {
    const headRange = encodeURIComponent('EasyOrdersIntegration!1:1');
    const range = encodeURIComponent('EasyOrdersIntegration!' + rowNum + ':' + rowNum);

    const [headRes, rowRes] = await Promise.all([
      fetch(SHEETS_API+'/'+SID+'/values/'+headRange+'?access_token='+token),
      fetch(SHEETS_API+'/'+SID+'/values/'+range+'?access_token='+token),
    ]);
    const headers = (await headRes.json()).values?.[0] || [];
    const rowData = (await rowRes.json()).values?.[0] || [];

    const phoneIdx = headers.indexOf('Phone');
    const phone = (rowData[phoneIdx] || '').trim();
    const phoneNorm = normalizePhone(phone);

    console.log('\n=== Sheet Row ' + rowNum + ' ===');
    console.log('Phone:', phone, '| Normalized:', phoneNorm);
    console.log('Sheet T (col 19):', rowData[19] || 'EMPTY');
    console.log('Sheet U (col 20):', rowData[20] || 'EMPTY');
    console.log('Sheet V (col 21):', rowData[21] || 'EMPTY');
    console.log('Sheet X (col 23):', rowData[23] || 'EMPTY');

    const lead = await prisma.lead.findFirst({
      where: { phoneNormalized: phoneNorm, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        status: true,
        orders: { where: { deletedAt: null }, include: { orderItems: true }, take: 1 },
      },
    });
    if (!lead) { console.log('LEAD NOT FOUND in Dolphin'); continue; }

    console.log('\nDolphin Lead:', lead.name, '| ID:', lead.id);
    console.log('AssignedTo:', lead.assignedTo ? lead.assignedTo.id + ' (' + lead.assignedTo.name + ')' : '** NULL - NOT ASSIGNED **');
    console.log('Status slug:', lead.status?.slug, '| name:', lead.status?.name);
    console.log('Orders:', lead.orders.length);
    if (lead.orders.length > 0) {
      const o = lead.orders[0];
      const total = o.orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
      console.log('Order total:', total, '| discount:', Number(o.discount), '| items:', o.orderItems.length);
    } else {
      console.log('** NO ORDERS **');
    }
  }

  await prisma.$disconnect();
  process.exit(0);
})();
