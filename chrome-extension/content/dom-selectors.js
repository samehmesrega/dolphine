/**
 * DOM Selectors — WhatsApp Web
 * كل الـ selectors في ملف واحد عشان لو واتساب غيّر الـ DOM نحدّث مكان واحد بس
 */
// eslint-disable-next-line no-unused-vars
const SELECTORS = {
  VERSION: '2026-04-06',

  // Message list container
  MESSAGE_LIST: 'div[data-testid="conversation-panel-messages"], div[role="application"]',

  // Individual message containers
  MESSAGE_CONTAINER: 'div[data-testid="msg-container"]',

  // Message text
  MESSAGE_TEXT: 'span.selectable-text',

  // Message timestamp
  MESSAGE_META: 'span[data-testid="msg-meta"], div[data-pre-plain-text]',

  // Incoming vs outgoing
  MESSAGE_IN: '.message-in, div[data-testid="msg-container"][class*="message-in"]',
  MESSAGE_OUT: '.message-out, div[data-testid="msg-container"][class*="message-out"]',

  // Chat header — contact name/phone
  CHAT_HEADER_TITLE: 'span[data-testid="conversation-info-header-chat-title"], header span[title]',

  // Contact info panel — phone number (when panel is open)
  CONTACT_INFO_PHONE: 'div[data-testid="contact-info-drawer"] span[dir="ltr"]',

  // WhatsApp app wrapper (to detect page load)
  APP_WRAPPER: '#app div[data-testid="chat-list"]',
};
