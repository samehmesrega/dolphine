/**
 * Temporary script — test backfill 10 rows starting from row 6967
 * Usage: node tmp-backfill-test.js
 */

process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: 'service_account',
  project_id: 'dolphine-488921',
  private_key_id: 'c9bc1cccb0b5b80aa7fcf502971770cff728aa57',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDGcDN6+a+DJXdl
VhdDRafKIUGFTyQ6vVmi6a4yLiiVE5vW5IPJmqVRuHOuv3+W9b0UoAcdLEdOolcE
/tR/MAjDOaXmdODIFKaicnZ02Cho9FUn2iZYvy74GZY+kB2e4SU3u0EDBczpszIS
rgj8Kdg3VLtSimSorlrTBPiBZkOO0w1n0XbrcpWsqSfCBBAp+/b3T0w5MlHr7IGk
sPF/+jf8adxMkyfKlwTu0u0Unj5PYpMKh7lhAZEKeEDOqayxc4po9MedIy2P8s6A
YdfUcOAiSE9W+cb8noRBxQw1kMR6KbapI+VPSwPqIcrvM/Fv961Xktd7EOWfImpR
xAguW9YXAgMBAAECggEAAlQvK9Fuvns1e9csetnVjpxT1nVHpm9+2mkSu2tdQrIY
jPqcpMz+jfY8RuysjUKHk7/KG/vfP26JPXDm2BAU/GDBBXsrIxrKZ/vrxwoSqGcR
8ZLsLK/s6NtJ4k9IJGC7p69Rxc3GfWdgxrqt4T+6EfII0yl+5ZfkpJTzFe8E2BZO
sO49w74uHCnB5HsCBb9N1VFJIwg2VbW6MgnA+sKfEquI4VQi6b1A5ky3jmZrWB+C
bxhzWEtnW7fYbmHxXigKYis753irpRZvPZ8AfN1PltAI0xoQSz2eXWSGTKi+GDBu
X9KMzJzlzEeXa9bLPYLyaE/A6hPucx3GoM3bg1IAGQKBgQD3UVsKtAhPxxdFBZ0+
DchtUSvWOCLDzVOWNPy8z/+VijOG5RJ9iL3ckwjVGOljkUB3XshZtcNM0BSU9Y22
wg+Zd/j9QAgTq79FuhmgJsG8MthoINnnOp22BWismMi1ORNL2RJNzxe5p9wYPiH4
6fHkdfTVny20FACDci25Q48cywKBgQDNZ5DAirA9tJ6gSbzFTLAG8h69GrqO7A0c
89vw+LdBml9mlH9R36Bn/coNiZJpqYBWwoIM/KxrcNGjEuvkgWqj5XYecu0yYV4v
IfoeYe4B7A5070Qtbj6rBG+PFMSoaBO45uHr7AJKxtue9H+86OGIKEgPDRxVV2Z2
sKZsWQsuZQKBgQCJbloLDpP30QhrQH1qeDpCFPMpLTSUXcrvEy7GtUavkIallTG7
NHtc0Q/9asR2ocaTDsaCo3CNhKuLQxCm2BvXCkYAZM6YL74wPwPybNcHf7Gl22t7
BKWS+lp6XsRZgAfrBAsZ1dS3REIX7p7uNQJIFAwjkTrScLMAWDh0VMh4FQKBgQC+
t8G0tVFtCe8bXzvyagErgdY+ubmtCMooLtjyBs2JEUAxbAJHz/8Nb50TMsCKcULj
y9ibHGUvoWJVKzVyRyPwKBejsAxDchrUYpTtbvpiOH833g2MrUds3UKENMFgqLpf
PalZuBpsufWjwtt0WTtHhDdcGk1LhEp0PBNamNcD7QKBgC8UlrMdhqZAaxW1uYZn
z1Piq1zo7gjUYt6rg2DHST0rsmUv9qjFR2vpxzrLePa5f71NYQ+GxafxxopOYpxv
+a3gyZpbeoxNmDiTgMl3cVQFC/4aVgKMAroIzRqHrR+8C5gKGcUntKNyqSMlnCFA
pDvtHL8TfveoqIOaVmQwC6pP
-----END PRIVATE KEY-----
`,
  client_email: 'dolphine@dolphine-488921.iam.gserviceaccount.com',
  client_id: '104399177296218068523',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
});

const { PrismaClient } = require('@prisma/client');

// Patch prisma import for compiled code
const prisma = new PrismaClient();
require('./dist/db').prisma = prisma;

const { backfillDolphinDataToSheet } = require('./dist/modules/leads/services/googleSheetsWrite');

const SPREADSHEET_ID = '1ln6Wrec0AoMKzlKLjSuudSSUHIkHuVjv0B-aXnPeAi8';
const SHEET_NAME = 'EasyOrdersIntegration';
const PHONE_COLUMN = 'Phone';
const START_ROW = 6987;
const MAX_ROWS = undefined; // كل الصفوف المتبقية

// Field mapping from the sheet connection (userMapping + statusMapping)
const FIELD_MAPPING = {
  phone: 'Phone',
  userMapping: {
    'M6-Toqa': '08ea96f6-99e5-4cdb-907b-ec426ada44fa',
    'M11 - Malk': 'ac75e837-46f4-4c83-a2d3-b48bd372b5e7',
    'M10 - Ahmed': '12847077-84d6-435e-bd5e-2e30c6599bac',
    'M12 - Roqia': '979123d6-b15b-48eb-9cce-230f9a091f30',
    'Moderator 5 - Doaa': 'dceca874-55fa-4988-9c7f-73365e75dd65',
    'Moderator 2 - Hager': '7b278646-a0b6-40cc-98d0-f03e98d35273',
    'Moderator 7 - salma': 'f299d910-ac6e-4c28-bb05-237187508fe8',
    'Moderator 9 - Mazen': '1461b8d3-358d-456b-94a7-d20d98587bec',
    'Moderator 1 - Mariam': '26d502ad-1f2c-4b41-9730-a4702ecef246',
    'Moderator 3 - Habiba': 'd37108d4-7b82-4e97-925a-6253ab70a3bd',
    'Moderator 8 - Doaa Hamed': '65073043-a57a-452a-a6e4-508c2eb77ff8',
  },
  statusMapping: {
    'Canceled': 'canceled',
    'Intiated': 'new',
    'Confirmed': 'confirmed',
    'Duplicate': 'duplicate',
    'Follow Up': 'follow_up',
    'No Answer': 'no_answer',
    'Fake order': 'fake',
    'interested': 'interested',
    'Follow Up 1': 'follow_up',
    'Follow Up 2': 'follow_up',
    'Follow Up 3': 'follow_up',
    'Not interested': 'not_interested',
    'Confirmed then canceled': 'canceled',
  },
};

(async () => {
  try {
    console.log(`Starting test backfill: rows ${START_ROW} to ${START_ROW + MAX_ROWS - 1}...`);

    const result = await backfillDolphinDataToSheet(
      SPREADSHEET_ID,
      SHEET_NAME,
      PHONE_COLUMN,
      START_ROW,
      MAX_ROWS,
      FIELD_MAPPING,
    );

    console.log('\n=== Result ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
