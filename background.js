const lastBlockedByTab = new Map();
const ALLOW_RULE_BASE = 10000;
const allowUntilByHost = new Map();
let blockedDomains = [];
let fallbackEnabled = false;

function normalizeHost(host) {
  return host.replace(/^www\./, "").toLowerCase();
}

function hostFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return normalizeHost(host);
  } catch {
    return null;
  }
}

function isHostMatch(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isAllowed(host) {
  const now = Date.now();
  for (const [domain, until] of allowUntilByHost.entries()) {
    if (until <= now) {
      allowUntilByHost.delete(domain);
      continue;
    }
    if (isHostMatch(host, domain)) return true;
  }
  return false;
}

async function loadState() {
  const stored = await chrome.storage.local.get([
    "blockedDomains",
    "fallbackEnabled",
    "allowUntilByHost"
  ]);
  blockedDomains = (stored.blockedDomains || []).map(normalizeHost);
  fallbackEnabled = !!stored.fallbackEnabled;
  allowUntilByHost.clear();
  const allowStored = stored.allowUntilByHost || {};
  for (const [domain, until] of Object.entries(allowStored)) {
    if (typeof until === "number") allowUntilByHost.set(domain, until);
  }
}

loadState();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.blockedDomains) {
    blockedDomains = (changes.blockedDomains.newValue || []).map(normalizeHost);
  }
  if (changes.fallbackEnabled) {
    fallbackEnabled = !!changes.fallbackEnabled.newValue;
  }
  if (changes.allowUntilByHost) {
    allowUntilByHost.clear();
    const allowStored = changes.allowUntilByHost.newValue || {};
    for (const [domain, until] of Object.entries(allowStored)) {
      if (typeof until === "number") allowUntilByHost.set(domain, until);
    }
  }
});

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  if (info && info.request && info.request.tabId >= 0) {
    lastBlockedByTab.set(info.request.tabId, info.request.url);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!fallbackEnabled) return;
  if (details.frameId !== 0) return;
  if (!details.url || !(details.url.startsWith("http://") || details.url.startsWith("https://"))) return;
  if (details.url.startsWith(chrome.runtime.getURL("blocked.html"))) return;

  const host = hostFromUrl(details.url);
  if (!host) return;
  if (isAllowed(host)) return;

  for (const domain of blockedDomains) {
    if (isHostMatch(host, domain)) {
      const redirectUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(details.url)}`);
      chrome.tabs.update(details.tabId, { url: redirectUrl });
      return;
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "get-last-blocked") {
    const url = lastBlockedByTab.get(msg.tabId) || null;
    sendResponse({ url });
    return true;
  }

  if (msg?.type === "allow-temporary") {
    const { url, minutes = 5 } = msg;
    if (!url) {
      sendResponse({ ok: false });
      return true;
    }

    const host = hostFromUrl(url);
    if (host) {
      const until = Date.now() + minutes * 60 * 1000;
      allowUntilByHost.set(host, until);
      chrome.storage.local.get("allowUntilByHost", (data) => {
        const allowStored = data.allowUntilByHost || {};
        allowStored[host] = until;
        chrome.storage.local.set({ allowUntilByHost: allowStored });
      });
      chrome.alarms.create(`allowhost:${host}`, { delayInMinutes: minutes });
    }

    const ruleId = ALLOW_RULE_BASE + Date.now() % 1000000;
    const rule = {
      id: ruleId,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: url,
        resourceTypes: ["main_frame"]
      }
    };

    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [rule],
      removeRuleIds: []
    }, () => {
      chrome.alarms.create(`allow:${ruleId}`, { delayInMinutes: minutes });
      sendResponse({ ok: true, ruleId });
    });

    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm?.name) return;
  if (alarm.name.startsWith("allowhost:")) {
    const host = alarm.name.split(":")[1];
    if (!host) return;
    allowUntilByHost.delete(host);
    chrome.storage.local.get("allowUntilByHost", (data) => {
      const allowStored = data.allowUntilByHost || {};
      delete allowStored[host];
      chrome.storage.local.set({ allowUntilByHost: allowStored });
    });
    return;
  }

  if (!alarm.name.startsWith("allow:")) return;

  const ruleId = Number(alarm.name.split(":")[1]);
  if (!Number.isFinite(ruleId)) return;

  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: [ruleId]
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
