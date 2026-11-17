const PORT = 'http://127.0.0.1:47832/focus';
const RULE_START = 1000;

async function syncRules() {
  let domains = [];
  try {
    const response = await fetch(PORT, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const state = await response.json();
      if (state.active && Array.isArray(state.domains)) domains = state.domains;
    }
  } catch { /* LyraFlow closed: remove its blocking rules. */ }

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const owned = existing.filter(rule => rule.id >= RULE_START && rule.id < RULE_START + 100);
  const next = domains.slice(0, 100).filter(domain => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain)).map((domain, index) => ({
    id: RULE_START + index,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ['main_frame', 'sub_frame'] },
  }));
  if (JSON.stringify(owned) === JSON.stringify(next)) return;
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: owned.map(rule => rule.id), addRules: next });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('lyraflow-focus', { periodInMinutes: 0.5 });
  syncRules();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('lyraflow-focus', { periodInMinutes: 0.5 });
  syncRules();
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'lyraflow-focus') syncRules(); });
