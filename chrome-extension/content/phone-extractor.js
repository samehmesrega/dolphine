/**
 * Phone Extractor — استخراج رقم الموبايل من الشات الحالي
 */

// eslint-disable-next-line no-unused-vars
function extractPhoneFromChat() {
  // Method 1: Chat header title (works for unsaved contacts)
  const header = document.querySelector(SELECTORS.CHAT_HEADER_TITLE);
  if (header) {
    const title = header.getAttribute('title') || header.textContent || '';
    const cleaned = title.replace(/[\s\-\(\)]/g, '');
    // Check if it looks like a phone number (starts with + or digits, 8+ chars)
    if (/^\+?\d{8,}$/.test(cleaned)) {
      return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
    }
  }

  // Method 2: Contact info panel (if open)
  const contactPhone = document.querySelector(SELECTORS.CONTACT_INFO_PHONE);
  if (contactPhone) {
    const text = (contactPhone.textContent || '').replace(/[\s\-\(\)]/g, '');
    if (/^\+?\d{8,}$/.test(text)) {
      return text.startsWith('+') ? text : '+' + text;
    }
  }

  // Method 3: URL hash (sometimes contains phone)
  const hash = window.location.hash || '';
  const match = hash.match(/(\d{10,15})/);
  if (match) {
    return '+' + match[1];
  }

  return null;
}
