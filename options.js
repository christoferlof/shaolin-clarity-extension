const sitesEl = document.getElementById("sites");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function normalizeInput(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function loadOptions() {
  const { blockedDomains = [] } = await chrome.storage.local.get("blockedDomains");
  sitesEl.value = blockedDomains.join("\n");
}

async function saveOptions() {
  if (!chrome.declarativeNetRequest) {
    statusEl.textContent = "Error: declarativeNetRequest API is unavailable.";
    return;
  }

  const lines = sitesEl.value.split("\n");
  const domains = [];
  for (const line of lines) {
    const domain = normalizeInput(line);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }

  await chrome.storage.local.set({ blockedDomains: domains });

  const rules = domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "blocked.html" } },
    condition: {
      urlFilter: domain,
      resourceTypes: ["main_frame"]
    }
  }));

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((rule) => rule.id);

  await new Promise((resolve) => {
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
      removeRuleIds: existingIds
    }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        statusEl.textContent = `Error: ${err.message}`;
        resolve();
        return;
      }
      resolve();
    });
  });

  const updated = await chrome.declarativeNetRequest.getDynamicRules();
  const fallback = domains.length > 0 && updated.length === 0;
  await chrome.storage.local.set({ fallbackEnabled: fallback });
  statusEl.textContent = `Saved ${domains.length} site${domains.length === 1 ? "" : "s"} (rules: ${updated.length}).`;
  if (domains.length > 0 && updated.length === 0) {
    statusEl.textContent += " DNR rules not applied; using fallback redirect.";
  }
  setTimeout(() => { statusEl.textContent = ""; }, 2000);
}

saveBtn.addEventListener("click", () => { saveOptions(); });

loadOptions();
