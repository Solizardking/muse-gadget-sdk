import './style.css';
import './pair.css';
import { installTheme } from './theme.js';

installTheme();

const tabs = [...document.querySelectorAll('#pair-tabs [role="tab"]')];
function selectTab(tab) {
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.setAttribute('aria-pressed', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs.at(-1);
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    next.focus();
  });
}

const copyNotice = document.querySelector('#copy-notice');
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = document.getElementById(button.dataset.copy);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied';
      copyNotice.textContent = 'Command copied. Run it on your Linux device from the Pocket Wallet checkout.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      button.textContent = 'Select command to copy';
      copyNotice.textContent = 'Clipboard unavailable. Select the command and copy it with your keyboard, or press and hold on your phone.';
    }
  });
}

const status = document.querySelector('#pair-status');
const backendStatus = document.querySelector('#backend-status');
const sdkStatus = document.querySelector('#sdk-status');
const retry = document.querySelector('#status-retry');
let request;

async function checkStatus() {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  status.setAttribute('aria-busy', 'true');
  status.dataset.state = 'checking';
  retry.disabled = true;
  backendStatus.textContent = 'Checking wallet services…';
  sdkStatus.textContent = 'Checking configuration…';
  try {
    const response = await fetch('/api/gadget/status', { signal: controller.signal, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || data.ok !== true || data.backend !== 'pocket-wallet') throw new Error('Invalid backend status');
    status.dataset.state = 'available';
    backendStatus.textContent = 'Wallet services available · Solana mainnet';
    sdkStatus.textContent = data.gadget_sdk?.configured === true ? 'SDK credential configured on backend' : 'SDK credential not configured on backend';
  } catch {
    if (request !== controller) return;
    status.dataset.state = 'unavailable';
    backendStatus.textContent = 'Wallet services unavailable. Try checking again.';
    sdkStatus.textContent = 'SDK configuration could not be checked';
  } finally {
    clearTimeout(timeout);
    if (request === controller) {
      status.setAttribute('aria-busy', 'false');
      retry.disabled = false;
    }
  }
}

retry.addEventListener('click', checkStatus);
checkStatus();
window.addEventListener('pagehide', () => request?.abort(), { once: true });
