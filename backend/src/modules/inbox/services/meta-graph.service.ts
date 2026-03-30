/**
 * Meta Graph API Service for Inbox Module
 * Handles conversations, messages, comments via Graph API
 * Reuses patterns from marketing/meta-ads.service.ts
 */

import { prisma } from '../../../db';
import { config } from '../../../shared/config';
import { encryptToken, decryptToken } from '../../../shared/utils/token-encryption';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── OAuth Flow (Page tokens with messaging scopes) ────────────────────────

const INBOX_SCOPES = [
  'pages_messaging',
  'instagram_manage_messages',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_engagement',
  'instagram_manage_comments',
  'pages_show_list',
].join(',');

export function getInboxOAuthUrl(state: string): string {
  if (!config.meta.appId || !config.meta.redirectUri) {
    throw new Error('META_APP_ID and META_REDIRECT_URI must be set');
  }

  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: config.meta.redirectUri,
    scope: INBOX_SCOPES,
    response_type: 'code',
    state,
  });

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    redirect_uri: config.meta.redirectUri,
    code,
  });

  const res = await fetchWithTimeout(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta OAuth error: ${data.error.message}`);
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getLongLivedToken(shortToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetchWithTimeout(`${GRAPH_BASE}/oauth/access_token?${params}`);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta token exchange error: ${data.error.message}`);
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

/**
 * Fetch pages the user manages — returns Page Access Tokens (permanent when derived from long-lived user token)
 */
export async function fetchUserPages(userAccessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    accessToken: string;
    instagramBusinessAccountId?: string;
  }>
> {
  const fields = 'id,name,access_token,instagram_business_account{id,name,username}';
  const res = await fetchWithTimeout(
    `${GRAPH_BASE}/me/accounts?fields=${fields}&access_token=${userAccessToken}&limit=100`
  );
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return (data.data || []).map((page: any) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id,
  }));
}

// ─── Helper: Get decrypted token for a channel ────────────────────────────

export async function getChannelToken(channelId: string): Promise<{
  token: string;
  pageId: string;
  platform: string;
}> {
  const channel = await prisma.inboxChannel.findUnique({
    where: { id: channelId },
    include: { socialPage: true },
  });

  if (!channel || !channel.socialPage) {
    throw new Error('Channel not found');
  }

  return {
    token: decryptToken(channel.socialPage.accessToken),
    pageId: channel.socialPage.pageId,
    platform: channel.platform,
  };
}

// ─── Conversations API (Messenger + Instagram DMs) ────────────────────────

export async function getConversations(
  pageId: string,
  token: string,
  after?: string
): Promise<{ data: any[]; paging?: any }> {
  const fields = 'id,participants,updated_time,messages.limit(1){message,from,created_time}';
  let url = `${GRAPH_BASE}/${pageId}/conversations?fields=${fields}&access_token=${token}&limit=50`;
  if (after) url += `&after=${after}`;

  const res = await fetchWithTimeout(url);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return { data: data.data || [], paging: data.paging };
}

export async function getConversationMessages(
  conversationId: string,
  token: string,
  after?: string
): Promise<{ data: any[]; paging?: any }> {
  const fields = 'id,message,from,to,created_time,attachments{mime_type,name,size,image_data,video_data,file_url}';
  let url = `${GRAPH_BASE}/${conversationId}/messages?fields=${fields}&access_token=${token}&limit=50`;
  if (after) url += `&after=${after}`;

  const res = await fetchWithTimeout(url);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return { data: data.data || [], paging: data.paging };
}

// ─── Send Messages ────────────────────────────────────────────────────────

export async function sendMessengerMessage(
  pageId: string,
  recipientId: string,
  text: string,
  token: string
): Promise<any> {
  const res = await fetchWithTimeout(`${GRAPH_BASE}/${pageId}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    }),
  });
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta send error: ${data.error.message}`);
  }

  return data;
}

export async function sendInstagramMessage(
  igPageId: string,
  recipientId: string,
  text: string,
  token: string
): Promise<any> {
  const res = await fetchWithTimeout(`${GRAPH_BASE}/${igPageId}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta IG send error: ${data.error.message}`);
  }

  return data;
}

// ─── Comments API ─────────────────────────────────────────────────────────

export async function getPostComments(
  postId: string,
  token: string,
  after?: string
): Promise<{ data: any[]; paging?: any }> {
  const fields = 'id,message,from{id,name},created_time,attachment,parent{id},is_hidden';
  let url = `${GRAPH_BASE}/${postId}/comments?fields=${fields}&access_token=${token}&limit=100`;
  if (after) url += `&after=${after}`;

  const res = await fetchWithTimeout(url);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return { data: data.data || [], paging: data.paging };
}

export async function getPagePosts(
  pageId: string,
  token: string,
  after?: string
): Promise<{ data: any[]; paging?: any }> {
  const fields = 'id,message,permalink_url,created_time,full_picture';
  let url = `${GRAPH_BASE}/${pageId}/posts?fields=${fields}&access_token=${token}&limit=25`;
  if (after) url += `&after=${after}`;

  const res = await fetchWithTimeout(url);
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }

  return { data: data.data || [], paging: data.paging };
}

export async function replyToComment(
  commentId: string,
  text: string,
  token: string
): Promise<any> {
  const res = await fetchWithTimeout(`${GRAPH_BASE}/${commentId}/comments?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta reply error: ${data.error.message}`);
  }

  return data;
}

export async function sendPrivateReply(
  commentId: string,
  text: string,
  token: string
): Promise<any> {
  const res = await fetchWithTimeout(
    `${GRAPH_BASE}/${commentId}/private_replies?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    }
  );
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta private reply error: ${data.error.message}`);
  }

  return data;
}

export async function hideComment(
  commentId: string,
  isHidden: boolean,
  token: string
): Promise<any> {
  const res = await fetchWithTimeout(`${GRAPH_BASE}/${commentId}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_hidden: isHidden }),
  });
  const data = (await res.json()) as any;

  if (data.error) {
    throw new Error(`Meta hide error: ${data.error.message}`);
  }

  return data;
}

// ─── Connect Page to Inbox ────────────────────────────────────────────────

export async function connectPageToInbox(pageData: {
  pageId: string;
  pageName: string;
  accessToken: string;
  brandId: string;
  instagramBusinessAccountId?: string;
}): Promise<{ channels: any[] }> {
  const encryptedToken = encryptToken(pageData.accessToken);
  const channels: any[] = [];

  // Upsert Facebook Page in SocialPage
  const fbPage = await prisma.socialPage.upsert({
    where: { platform_pageId: { platform: 'facebook', pageId: pageData.pageId } },
    update: {
      pageName: pageData.pageName,
      accessToken: encryptedToken,
      brandId: pageData.brandId,
      isActive: true,
    },
    create: {
      platform: 'facebook',
      pageId: pageData.pageId,
      pageName: pageData.pageName,
      accessToken: encryptedToken,
      brandId: pageData.brandId,
    },
  });

  // Create Messenger channel
  const messengerChannel = await prisma.inboxChannel.upsert({
    where: { socialPageId_platform: { socialPageId: fbPage.id, platform: 'messenger' } },
    update: { isActive: true },
    create: { socialPageId: fbPage.id, platform: 'messenger' },
  });
  channels.push(messengerChannel);

  // Create Facebook Comments channel
  const fbCommentsChannel = await prisma.inboxChannel.upsert({
    where: { socialPageId_platform: { socialPageId: fbPage.id, platform: 'facebook_comments' } },
    update: { isActive: true },
    create: { socialPageId: fbPage.id, platform: 'facebook_comments' },
  });
  channels.push(fbCommentsChannel);

  // If Instagram Business Account connected, create IG channels
  if (pageData.instagramBusinessAccountId) {
    const igPage = await prisma.socialPage.upsert({
      where: { platform_pageId: { platform: 'instagram', pageId: pageData.instagramBusinessAccountId } },
      update: {
        pageName: `${pageData.pageName} (Instagram)`,
        accessToken: encryptedToken, // same page token works for IG
        brandId: pageData.brandId,
        isActive: true,
      },
      create: {
        platform: 'instagram',
        pageId: pageData.instagramBusinessAccountId,
        pageName: `${pageData.pageName} (Instagram)`,
        accessToken: encryptedToken,
        brandId: pageData.brandId,
      },
    });

    const igDmChannel = await prisma.inboxChannel.upsert({
      where: { socialPageId_platform: { socialPageId: igPage.id, platform: 'instagram_dm' } },
      update: { isActive: true },
      create: { socialPageId: igPage.id, platform: 'instagram_dm' },
    });
    channels.push(igDmChannel);

    const igCommentsChannel = await prisma.inboxChannel.upsert({
      where: { socialPageId_platform: { socialPageId: igPage.id, platform: 'instagram_comments' } },
      update: { isActive: true },
      create: { socialPageId: igPage.id, platform: 'instagram_comments' },
    });
    channels.push(igCommentsChannel);
  }

  return { channels };
}
