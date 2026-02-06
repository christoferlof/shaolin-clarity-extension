const blockedUrlEl = document.getElementById("blockedUrl");
const headlineEl = document.getElementById("headline");
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

function applyDayPhase() {
  const hour = new Date().getHours();
  let phase = "day";
  if (hour >= 5 && hour < 11) phase = "morning";
  else if (hour >= 11 && hour < 17) phase = "day";
  else if (hour >= 17 && hour < 20) phase = "sunset";
  else phase = "night";

  document.body.classList.remove("phase-morning", "phase-day", "phase-sunset", "phase-night");
  document.body.classList.add(`phase-${phase}`);
}

function applyHeadline() {
  if (!headlineEl) return;
  const options = ["Pause.", "Shift.", "Stay.", "Choose.", "Breathe.", "Return."];
  const pick = options[Math.floor(Math.random() * options.length)];
  headlineEl.textContent = pick;
}

(async () => {
  applyDayPhase();
  applyHeadline();

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
