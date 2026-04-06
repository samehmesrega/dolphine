/**
 * Service Worker — handles API communication for the extension
 * Content script sends messages here to avoid CORS issues
 */

async function getConfig() {
  const { apiUrl, token } = await chrome.storage.local.get(['apiUrl', 'token']);
  return {
    apiUrl: apiUrl || 'https://dolphine.onrender.com/api',
    token: token || null,
  };
}

async function apiCall(method, path, body) {
  const { apiUrl, token } = await getConfig();
  if (!token) return { error: 'Not authenticated' };

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${apiUrl}${path}`, opts);
    return await res.json();
  } catch (err) {
    console.error('[Dolphin SW] API error:', err.message);
    return { error: err.message };
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      case 'checkLead': {
        const result = await apiCall('GET', `/whatsapp-monitor/check-lead?phone=${encodeURIComponent(msg.phone)}`);
        sendResponse(result);
        break;
      }

      case 'saveSession': {
        const result = await apiCall('POST', '/whatsapp-monitor/sessions', {
          leadId: msg.leadId,
          phoneNumber: msg.phoneNumber,
          messages: msg.messages,
          chatStartedAt: msg.chatStartedAt,
          chatEndedAt: msg.chatEndedAt,
        });
        sendResponse(result);
        break;
      }

      case 'login': {
        try {
          const { apiUrl } = await getConfig();
          const baseUrl = msg.apiUrl || apiUrl;
          const res = await fetch(`${baseUrl.replace(/\/api\/?$/, '')}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: msg.email, password: msg.password }),
          });
          const data = await res.json();
          if (data.token) {
            await chrome.storage.local.set({
              token: data.token,
              apiUrl: baseUrl,
              userName: data.user?.name || msg.email,
            });
            sendResponse({ success: true, userName: data.user?.name });
          } else {
            sendResponse({ success: false, error: data.error || 'Login failed' });
          }
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;
      }

      case 'logout': {
        await chrome.storage.local.remove(['token', 'userName']);
        sendResponse({ success: true });
        break;
      }

      case 'getStatus': {
        const { token, userName, paused } = await chrome.storage.local.get(['token', 'userName', 'paused']);
        sendResponse({ loggedIn: !!token, userName, paused: !!paused });
        break;
      }

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true; // Keep the message channel open for async response
});
