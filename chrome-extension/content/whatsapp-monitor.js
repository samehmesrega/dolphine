/**
 * WhatsApp Monitor — Content Script
 * يراقب الرسائل في واتساب ويب ويبعتها للـ backend
 */

(function () {
  'use strict';

  const LOG = (...args) => console.log('[Dolphin]', ...args);
  const WARN = (...args) => console.warn('[Dolphin]', ...args);

  let currentChatPhone = null;
  let currentLeadId = null;
  let messageBuffer = [];
  let idleTimer = null;
  let paused = false;
  let observedContainers = new WeakSet();
  const leadCache = {};

  const IDLE_TIMEOUT = 60000;
  const BUFFER_LIMIT = 50;

  // ──────── Communication with Service Worker ────────

  function sendToBackground(action, data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          WARN('sendMessage error:', chrome.runtime.lastError.message);
          resolve({});
          return;
        }
        resolve(response || {});
      });
    });
  }

  async function checkLead(phone) {
    if (leadCache[phone] !== undefined) return leadCache[phone];
    LOG('Checking lead for phone:', phone);
    const result = await sendToBackground('checkLead', { phone });
    LOG('Check result:', JSON.stringify(result));
    leadCache[phone] = result;
    return result;
  }

  async function flushBuffer() {
    if (messageBuffer.length === 0 || !currentLeadId) return;

    const messages = [...messageBuffer];
    const leadId = currentLeadId;
    const phone = currentChatPhone;
    messageBuffer = [];

    LOG(`Flushing ${messages.length} messages for lead ${leadId} (${phone})`);

    const chatStartedAt = messages[0].timestamp;
    const chatEndedAt = messages[messages.length - 1].timestamp;

    const result = await sendToBackground('saveSession', {
      leadId,
      phoneNumber: phone,
      messages,
      chatStartedAt,
      chatEndedAt,
    });
    LOG('Save result:', JSON.stringify(result));
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => flushBuffer(), IDLE_TIMEOUT);
  }

  // ──────── Phone Extraction ────────

  function extractPhoneNumber() {
    // Method 1: Header title — works for unsaved contacts
    const headerEl = document.querySelector('header span[title]');
    if (headerEl) {
      const title = headerEl.getAttribute('title') || '';
      const cleaned = title.replace(/[\s\-\(\)\u200e\u200f]/g, '');
      if (/^\+?\d{8,}$/.test(cleaned)) {
        const phone = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
        LOG('Phone from header title:', phone);
        return phone;
      }
    }

    // Method 2: data-testid conversation header
    const testIdHeader = document.querySelector('span[data-testid="conversation-info-header-chat-title"]');
    if (testIdHeader) {
      const text = (testIdHeader.textContent || '').replace(/[\s\-\(\)\u200e\u200f]/g, '');
      if (/^\+?\d{8,}$/.test(text)) {
        const phone = text.startsWith('+') ? text : '+' + text;
        LOG('Phone from testid header:', phone);
        return phone;
      }
    }

    // Method 3: Contact info drawer (if open)
    const drawerPhones = document.querySelectorAll('section span[dir="ltr"]');
    for (const el of drawerPhones) {
      const text = (el.textContent || '').replace(/[\s\-\(\)\u200e\u200f]/g, '');
      if (/^\+?\d{8,}$/.test(text)) {
        const phone = text.startsWith('+') ? text : '+' + text;
        LOG('Phone from contact drawer:', phone);
        return phone;
      }
    }

    // Method 4: Try to click the header to open contact info and read phone
    // Only attempt this if we haven't tried recently
    const headerClickable = document.querySelector('header img[data-testid="default-user"], header img[data-testid="contact-photo"]');
    if (headerClickable && !headerClickable.dataset.dolphinClicked) {
      headerClickable.dataset.dolphinClicked = 'true';
      LOG('Clicking header to open contact info...');
      headerClickable.click();
      // We'll pick it up on the next poll cycle
      setTimeout(() => {
        // Close the drawer if we opened it
        const closeBtn = document.querySelector('header span[data-testid="x-viewer"]');
        if (closeBtn) closeBtn.click();
        delete headerClickable.dataset.dolphinClicked;
      }, 2000);
    }

    // Method 5: URL hash
    const hash = window.location.hash || '';
    const hashMatch = hash.match(/(\d{10,15})/);
    if (hashMatch) {
      const phone = '+' + hashMatch[1];
      LOG('Phone from URL hash:', phone);
      return phone;
    }

    LOG('Could not extract phone number from current chat');
    return null;
  }

  // ──────── Message Extraction ────────

  function extractMessage(msgNode) {
    // Get text content
    const textEl = msgNode.querySelector('span.selectable-text');
    if (!textEl) return null;

    const text = textEl.textContent || '';
    if (!text.trim()) return null;

    // Direction — check parent classes
    let direction = 'in';
    let node = msgNode;
    while (node) {
      if (node.classList) {
        if (node.classList.contains('message-out')) { direction = 'out'; break; }
        if (node.classList.contains('message-in')) { direction = 'in'; break; }
        // Also check for data-testid patterns
        const classes = node.className || '';
        if (classes.includes('message-out')) { direction = 'out'; break; }
        if (classes.includes('message-in')) { direction = 'in'; break; }
      }
      node = node.parentElement;
    }

    // Timestamp
    let timestamp = new Date().toISOString();
    const prePlain = msgNode.querySelector('[data-pre-plain-text]');
    if (prePlain) {
      const raw = prePlain.getAttribute('data-pre-plain-text') || '';
      const match = raw.match(/\[(\d{1,2}:\d{2})/);
      if (match) {
        const today = new Date().toISOString().slice(0, 10);
        timestamp = new Date(`${today}T${match[1]}:00`).toISOString();
      }
    }

    return { text: text.trim(), timestamp, direction };
  }

  // Capture all existing visible messages in the current chat
  function captureExistingMessages() {
    const containers = document.querySelectorAll('div[data-testid="msg-container"], div[class*="message-"]');
    let count = 0;
    for (const mc of containers) {
      const msg = extractMessage(mc);
      if (msg) {
        messageBuffer.push(msg);
        count++;
      }
    }
    if (count > 0) {
      LOG(`Captured ${count} existing messages`);
      resetIdleTimer();
    }
  }

  // ──────── Chat Switch Detection ────────

  let lastHeaderText = '';

  async function onChatSwitch(headerText) {
    LOG('Chat switch detected:', headerText);

    // Flush previous chat
    await flushBuffer();

    const phone = extractPhoneNumber();
    if (!phone) {
      currentChatPhone = null;
      currentLeadId = null;
      return;
    }

    currentChatPhone = phone;

    // Check if this phone matches a lead
    const result = await checkLead(phone);
    if (result && result.matched) {
      currentLeadId = result.leadId;
      LOG(`Matched lead: ${result.leadName} (${result.leadId})`);
      // Capture existing messages in this chat
      captureExistingMessages();
    } else {
      currentLeadId = null;
      LOG('No lead match — skipping this chat');
    }
  }

  // ──────── MutationObserver Setup ────────

  function observeMessages(container) {
    if (observedContainers.has(container)) return;
    observedContainers.add(container);

    const observer = new MutationObserver((mutations) => {
      if (paused || !currentLeadId) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = /** @type {Element} */ (node);

          // Find message containers in the added node
          const containers = [];
          if (el.matches && el.matches('div[data-testid="msg-container"]')) containers.push(el);
          if (el.querySelectorAll) {
            el.querySelectorAll('div[data-testid="msg-container"]').forEach(c => containers.push(c));
          }
          // Fallback: look for message-in/message-out classes
          if (containers.length === 0 && el.querySelectorAll) {
            el.querySelectorAll('[class*="message-in"], [class*="message-out"]').forEach(c => containers.push(c));
          }

          for (const mc of containers) {
            const msg = extractMessage(mc);
            if (msg) {
              messageBuffer.push(msg);
              LOG(`New message [${msg.direction}]: ${msg.text.slice(0, 50)}...`);
              resetIdleTimer();

              if (messageBuffer.length >= BUFFER_LIMIT) {
                flushBuffer();
              }
            }
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    LOG('Observing message container');
  }

  // ──────── Main Poll Loop ────────

  function startPolling() {
    setInterval(() => {
      // Check for header changes (chat switch)
      const headerEl = document.querySelector('header span[title]') ||
                       document.querySelector('span[data-testid="conversation-info-header-chat-title"]');
      const current = headerEl ? (headerEl.getAttribute('title') || headerEl.textContent || '') : '';

      if (current && current !== lastHeaderText) {
        lastHeaderText = current;
        onChatSwitch(current);
      }

      // Make sure we're observing the message list
      const msgList = document.querySelector('div[data-testid="conversation-panel-messages"]') ||
                      document.querySelector('div[role="application"]');
      if (msgList) observeMessages(msgList);
    }, 2000);
  }

  // ──────── Initialization ────────

  let started = false;

  async function startMonitoring() {
    if (started) return;
    started = true;

    LOG('Initializing...');

    // Wait for WhatsApp Web to load
    const maxWait = 30000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const chatList = document.querySelector('#app div[data-testid="chat-list"]') ||
                       document.querySelector('#app [data-testid="default-user"]') ||
                       document.querySelector('#side');
      if (chatList) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    LOG('WhatsApp Monitor ACTIVE');
    startPolling();
  }

  async function init() {
    const storage = await chrome.storage.local.get(['paused', 'token']);
    paused = storage.paused || false;

    if (storage.token) {
      startMonitoring();
    } else {
      LOG('Not logged in — waiting for login...');
    }

    // Listen for storage changes (login, pause/resume)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.token && changes.token.newValue && !started) {
        LOG('Token detected — starting monitoring');
        startMonitoring();
      }
      if (changes.paused) {
        paused = changes.paused.newValue;
        LOG('Monitoring', paused ? 'PAUSED' : 'RESUMED');
      }
    });
  }

  init();
})();
