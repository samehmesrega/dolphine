import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn('[Email] SMTP not configured — emails will be logged only');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  return transporter;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.info(`[Email] (not sent — no SMTP) To: ${to}, Subject: ${subject}`);
    return false;
  }
  try {
    await t.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
    logger.info(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    logger.error(`[Email] Failed to send to ${to}: ${err}`);
    return false;
  }
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0ea5e9,#3b82f6);padding:28px 32px;text-align:center;">
    <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#fff;">D</div>
    <h1 style="color:#fff;margin:12px 0 0;font-size:22px;">دولفين بلاتفورم</h1>
  </div>
  <div style="padding:32px;">
    ${content}
  </div>
  <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">دولفين بلاتفورم — تم التطوير بواسطة Digitics</p>
  </div>
</div>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = `${config.appUrl}/api/v1/auth/verify-email/${token}`;
  const html = emailWrapper(`
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">مرحباً ${name} 👋</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">شكراً لتسجيلك في منصة دولفين. اضغط على الزرار أدناه لتأكيد إيميلك:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">تأكيد الإيميل</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">بعد التأكيد، سيتم مراجعة حسابك من الإدارة وتفعيله.</p>
    <p style="color:#cbd5e1;font-size:11px;margin:16px 0 0;">لو الزرار مش شغال، انسخ الرابط ده: <br/>${link}</p>
  `);
  return sendEmail(to, 'تأكيد الإيميل — دولفين بلاتفورم', html);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
  const link = `${config.appUrl}/reset-password?token=${token}`;
  const html = emailWrapper(`
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">مرحباً ${name}</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">تم طلب استعادة كلمة المرور لحسابك. اضغط على الزرار أدناه لإعادة تعيين كلمة المرور:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">إعادة تعيين كلمة المرور</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">الرابط صالح لمدة ساعة واحدة فقط.</p>
    <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">لو ما طلبتش استعادة كلمة المرور، تجاهل هذه الرسالة.</p>
    <p style="color:#cbd5e1;font-size:11px;margin:16px 0 0;">لو الزرار مش شغال، انسخ الرابط ده: <br/>${link}</p>
  `);
  return sendEmail(to, 'استعادة كلمة المرور — دولفين بلاتفورم', html);
}

export async function sendAccountApprovedEmail(to: string, name: string): Promise<boolean> {
  const link = `${config.appUrl}/login`;
  const html = emailWrapper(`
    <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">مرحباً ${name} 🎉</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 24px;">تم تفعيل حسابك بنجاح على منصة دولفين! يمكنك الآن تسجيل الدخول والبدء في العمل:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">تسجيل الدخول</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;">إذا واجهت أي مشكلة، تواصل مع الإدارة.</p>
  `);
  return sendEmail(to, 'تم تفعيل حسابك — دولفين بلاتفورم', html);
}
