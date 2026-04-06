/**
 * WhatsApp Monitor — Content Script
 * يراقب الرسائل في واتساب ويب ويبعتها للـ backend
 */

(function () {
  'use strict';

  let currentChatPhone = null;
  let currentLeadId = null;
  let messageBuffer = [];
  let idleTimer = null;
  let paused = false;
  const leadCache = {}; // phone -> { matched, leadId, leadName } | { matched: false }

  const IDLE_TIMEOUT = 60000; // 60 seconds
  const BUFFER_LIMIT = 50;

  // ──────── Communication with Service Worker ────────

  function sendToBackground(action, data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        resolve(response || {});
      });
    });
  }

  async function checkLead(phone) {
    if (leadCache[phone] !== undefined) return leadCache[phone];
    const result = await sendToBackground('checkLead', { phone });
    leadCache[phone] = result;
    return result;
  }

  async function flushBuffer() {
    if (messageBuffer.length === 0 || !currentLeadId) return;

    const messages = [...messageBuffer];
    const leadId = currentLeadId;
    const phone = currentChatPhone;
    messageBuffer = [];

    const chatStartedAt = messages[0].timestamp;
    const chatEndedAt = messages[messages.length - 1].timestamp;

    await sendToBackground('saveSession', {
      leadId,
      phoneNumber: phone,
      messages,
      chatStartedAt,
      chatEndedAt,
    });
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => flushBuffer(), IDLE_TIMEOUT);
  }

  // ──────── Message Extraction ────────

  function extractMessage(msgNode) {
    const textEl = msgNode.querySelector(SELECTORS.MESSAGE_TEXT);
    if (!textEl) return null;

    const text = textEl.textContent || '';
    if (!text.trim()) return null;

    // Direction
    const isOut = !!msgNode.closest('.message-out') || msgNode.classList.contains('message-out');
    const direction = isOut ? 'out' : 'in';

    // Timestamp
    let timestamp = new Date().toISOString();
    const metaEl = msgNode.querySelector(SELECTORS.MESSAGE_META);
    if (metaEl) {
      const prePlain = metaEl.closest('[data-pre-plain-text]');
      if (prePlain) {
        const raw = prePlain.getAttribute('data-pre-plain-text') || '';
        // Format: "[12:30, 4/5/2026] Name: "
        const match = raw.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
        if (match) {
          const [, time, date] = match;
          const [day, month, year] = date.split('/');
          timestamp = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00`).toISOString();
        }
      }
    }

    return { text: text.trim(), timestamp, direction };
  }

  // ──────── Chat Switch Detection ────────

  async function onChatSwitch() {
    // Flush previous chat
    await flushBuffer();

    const phone = extractPhoneFromChat();
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
    } else {
      currentLeadId = null; // Not a lead — don't monitor
    }
  }

  // ──────── MutationObserver Setup ────────

  function observeMessages(container) {
    const observer = new MutationObserver((mutations) => {
      if (paused || !currentLeadId) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const msgContainers = node.querySelectorAll
            ? [
                ...(node.matches && node.matches(SELECTORS.MESSAGE_CONTAINER) ? [node] : []),
                ...node.querySelectorAll(SELECTORS.MESSAGE_CONTAINER),
              ]
            : [];

          for (const mc of msgContainers) {
            const msg = extractMessage(mc);
            if (msg) {
              messageBuffer.push(msg);
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
    return observer;
  }

  function observeChatHeader() {
    const headerObserver = new MutationObserver(() => {
      onChatSwitch();
    });

    // Observe the main app for header changes
    const app = document.querySelector('#app');
    if (app) {
      headerObserver.observe(app, { childList: true, subtree: true, characterData: true });
    }

    // Debounce: only trigger onChatSwitch when header text actually changes
    let lastHeader = '';
    const checkHeader = () => {
      const el = document.querySelector(SELECTORS.CHAT_HEADER_TITLE);
      const current = el ? (el.getAttribute('title') || el.textContent || '') : '';
      if (current && current !== lastHeader) {
        lastHeader = current;
        onChatSwitch();
      }
    };

    // Poll for header changes (more reliable than MutationObserver for deep changes)
    setInterval(checkHeader, 2000);
  }

  // ──────── Initialization ────────

  function waitForElement(selector, timeout = 30000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  async function init() {
    // Check if monitoring is paused
    const storage = await chrome.storage.local.get(['paused', 'token']);
    if (!storage.token) {
      console.log('[Dolphin] Not logged in — monitoring disabled');
      return;
    }
    paused = storage.paused || false;

    // Wait for WhatsApp Web to fully load
    const appEl = await waitForElement(SELECTORS.APP_WRAPPER);
    if (!appEl) {
      console.log('[Dolphin] WhatsApp Web did not load in time');
      return;
    }

    console.log('[Dolphin] WhatsApp Monitor active');

    // Start observing messages
    const msgList = document.querySelector(SELECTORS.MESSAGE_LIST);
    if (msgList) {
      observeMessages(msgList);
    }

    // Also observe for when message list appears/changes (chat switch creates new container)
    const mainObserver = new MutationObserver(() => {
      const list = document.querySelector(SELECTORS.MESSAGE_LIST);
      if (list) observeMessages(list);
    });
    mainObserver.observe(document.body, { childList: true, subtree: true });

    // Watch for chat switches
    observeChatHeader();

    // Listen for pause/resume from popup
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.paused) {
        paused = changes.paused.newValue;
        console.log('[Dolphin] Monitoring', paused ? 'paused' : 'resumed');
      }
    });
  }

  init();
})();
