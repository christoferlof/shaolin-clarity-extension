const blockedUrlEl = document.getElementById("blockedUrl");
const continueBtn = document.getElementById("continue");
const closeBtn = document.getElementById("close");

async function getTabId() {
  const tab = await chrome.tabs.getCurrent();
  return tab?.id ?? null;
}

async function loadBlockedUrl() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("url");
  if (fromQuery) return fromQuery;

  const tabId = await getTabId();
  if (tabId === null) return null;
  const response = await chrome.runtime.sendMessage({ type: "get-last-blocked", tabId });
  return response?.url ?? null;
}

(async () => {
  const url = await loadBlockedUrl();
  if (url) blockedUrlEl.textContent = url;

  continueBtn.addEventListener("click", async () => {
    if (!url) return;
    await chrome.runtime.sendMessage({ type: "allow-temporary", url, minutes: 5 });
    const tabId = await getTabId();
    if (tabId !== null) chrome.tabs.update(tabId, { url });
  });

  closeBtn.addEventListener("click", async () => {
    const tabId = await getTabId();
    if (tabId !== null) chrome.tabs.remove(tabId);
  });
})();
