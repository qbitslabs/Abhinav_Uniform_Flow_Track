/**
 * Abhinav Uniforms - Client Order & Measurement Tracker Logic
 * Client-facing logic handling live 10-stage Order production tracking
 * and 5-stage Custom Tailoring progress with measurement parchi breakdown.
 */

// 1. Determine Backend API URL
function getApiBaseUrl() {
  // 1. If explicitly configured in config.js (e.g. window.TRACK_CONFIG.apiUrl = "https://api.abhinavuniforms.com")
  if (window.TRACK_CONFIG && window.TRACK_CONFIG.apiUrl && window.TRACK_CONFIG.apiUrl.trim()) {
    const custom = window.TRACK_CONFIG.apiUrl.trim().replace(/\/+$/, '');
    return custom.endsWith('/api/track') ? custom : `${custom}/api/track`;
  }

  const currentHost = window.location.hostname || 'localhost';
  const currentPort = window.location.port;
  const protocol = window.location.protocol;

  // 2. If served directly by backend (port 5000) or proxy with /api/track route
  if (currentPort === '5000') {
    return '/api/track';
  }

  // 3. If running on a dedicated tracking subdomain in production
  // e.g. "track.abhinavuniforms.com" -> calls "https://api.abhinavuniforms.com/api/track"
  if (
    currentHost.includes('.') &&
    !currentHost.endsWith('localhost') &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(currentHost)
  ) {
    const parts = currentHost.split('.');
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join('.');
      return `${protocol}//api.${rootDomain}/api/track`;
    }
  }

  // 4. Localhost or file:// fallback
  const fallbackHost =
    currentHost === 'localhost' || currentHost.endsWith('localhost') || !currentHost
      ? 'localhost'
      : currentHost;
  return `http://${fallbackHost}:5000/api/track`;
}

const API_BASE = getApiBaseUrl();
let currentTrackingId = '';
let currentRecordType = '';

// 2. DOM Elements
const form = document.getElementById('track-form');
const input = document.getElementById('tracking-input');
const clearBtn = document.getElementById('clear-btn');
const trackBtn = document.getElementById('track-btn');

const stateWelcome = document.getElementById('state-welcome');
const stateLoading = document.getElementById('state-loading');
const stateError = document.getElementById('state-error');
const errorTitle = document.getElementById('error-title');
const errorMsg = document.getElementById('error-msg');

const viewOrder = document.getElementById('view-order');
const viewMeasurement = document.getElementById('view-measurement');
const toastEl = document.getElementById('toast');
const toastMsg = document.getElementById('toast-msg');

// 3. Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Toggle clear button on typing
  input.addEventListener('input', () => {
    clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
  });

  // Check URL parameters for direct client tracking link:
  // e.g. ?track=ORD-2026-001 or ?id=MT-000001 or ?q=...
  const urlParams = new URLSearchParams(window.location.search);
  const directQuery =
    urlParams.get('track') ||
    urlParams.get('id') ||
    urlParams.get('q') ||
    urlParams.get('order') ||
    urlParams.get('ticket');

  if (directQuery) {
    input.value = directQuery.trim();
    clearBtn.style.display = 'flex';
    performTracking(directQuery.trim(), false);
  }
});

// 4. Quick Sample Click Helper
function fillAndTrack(sampleId) {
  input.value = sampleId;
  clearBtn.style.display = 'flex';
  performTracking(sampleId, true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 5. Form Submit Handler
function handleSearch(e) {
  if (e) e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  performTracking(query, true);
}

function clearSearch() {
  input.value = '';
  clearBtn.style.display = 'none';
  showState('welcome');
  currentTrackingId = '';
  currentRecordType = '';

  // Clean URL parameter without reloading
  const url = new URL(window.location);
  url.searchParams.delete('track');
  url.searchParams.delete('id');
  url.searchParams.delete('q');
  window.history.replaceState({}, '', url.pathname);
  input.focus();
}

function focusInput() {
  input.focus();
  input.select();
}

// 6. Perform Tracking API Request
async function performTracking(query, updateUrl = true) {
  if (!query) return;

  showState('loading');
  trackBtn.disabled = true;

  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('track', query);
    window.history.pushState({ track: query }, '', url);
  }

  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.data) {
      const message =
        result.error ||
        `No uniform order or measurement ticket matching "${query}" was found in our workshop records.`;
      showError('Record Not Found', message);
      return;
    }

    // Success! Render based on returned type
    const record = result.data;
    if (record.type === 'order') {
      renderOrderView(record.data);
    } else if (record.type === 'measurement') {
      renderMeasurementView(record.data);
    } else {
      showError('Unknown Record Format', 'The record returned from the system could not be processed.');
    }
  } catch (err) {
    console.error('Tracking fetch failed:', err);
    showError(
      'Server Connection Notice',
      'Could not establish connection to the Abhinav Uniforms workshop server. Please verify your connection or contact customer support.'
    );
  } finally {
    trackBtn.disabled = false;
  }
}

// 7. Render Bulk Order Tracking View (10-Stage Timeline)
function renderOrderView(order) {
  currentTrackingId = order.trackingId || order.orderNumber;
  currentRecordType = 'order';

  document.getElementById('ord-number').textContent = order.orderNumber;
  document.getElementById('ord-client').textContent = order.clientName || 'Institutional Client';
  document.getElementById('ord-sector').textContent = order.sectorName || 'Uniform Department';
  document.getElementById('ord-pieces').textContent = `${(order.totalPieces || 0).toLocaleString('en-IN')} pcs`;
  document.getElementById('ord-due').textContent = order.deliveryDueDate
    ? formatReadableDate(order.deliveryDueDate)
    : 'In Production Schedule';

  // Spotlight Stage
  document.getElementById('ord-stage-name').textContent = order.productionStage || 'In Progress';
  document.getElementById('ord-step-counter').textContent = `Stage ${order.currentStageIndex} of ${order.totalStages}`;

  // Build 10-Stage Manufacturing Workflow Stepper
  const stepperList = document.getElementById('order-stepper-list');
  stepperList.innerHTML = '';

  (order.stages || []).forEach((stg, index) => {
    const li = document.createElement('li');
    li.className = `step-node ${stg.status}`;

    let badgeContent = `${index + 1}`;
    if (stg.status === 'completed') {
      badgeContent = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    }

    const timeString = stg.timestamp ? formatShortDate(stg.timestamp) : '';

    li.innerHTML = `
      <div class="step-badge">${badgeContent}</div>
      <div class="step-info">
        <span class="step-label">${escapeHtml(stg.label)}</span>
        ${timeString ? `<span class="step-time">${timeString}</span>` : ''}
      </div>
    `;

    stepperList.appendChild(li);
  });

  // Build Items Breakdown Table
  const itemsTbody = document.getElementById('ord-items-tbody');
  itemsTbody.innerHTML = '';

  const items = order.items || [];
  document.getElementById('ord-total-items-badge').textContent = `${items.length} Uniform Article${items.length === 1 ? '' : 's'}`;

  if (items.length === 0) {
    itemsTbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          Garment specifications are being prepared for workshop floor.
        </td>
      </tr>
    `;
  } else {
    items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="item-name-cell">${escapeHtml(item.name || 'Uniform Item')}</td>
        <td>
          <span class="size-pill">${item.size ? escapeHtml(item.size) : 'Standard / Free'}</span>
        </td>
        <td class="text-right">
          <span class="quantity-badge">${(item.quantity || 0).toLocaleString('en-IN')} pcs</span>
        </td>
      `;
      itemsTbody.appendChild(tr);
    });
  }

  showState('order');
}

// 8. Render Tailoring Measurement Parchi View (5-Stage Tailoring Lifecycle)
function renderMeasurementView(meas) {
  currentTrackingId = meas.trackingId || meas.ticketNumber;
  currentRecordType = 'measurement';

  document.getElementById('meas-ticket').textContent = meas.ticketNumber;
  document.getElementById('meas-name').textContent = meas.personName || 'Custom Fit';
  document.getElementById('meas-code').textContent = meas.personCode || '—';
  document.getElementById('meas-garment').textContent = meas.garmentItemName || 'Custom Uniform';
  document.getElementById('meas-size').textContent = meas.size || 'Tailored Fit';

  // Status Spotlight
  document.getElementById('meas-status').textContent = meas.status || 'Open Work';
  document.getElementById('meas-step-counter').textContent = `Stage ${meas.currentStageIndex} of ${meas.totalStages}`;

  const parentOrderEl = document.getElementById('meas-parent-order');
  if (meas.orderNumber) {
    parentOrderEl.textContent = `Order: ${meas.orderNumber}`;
    parentOrderEl.style.display = 'inline-block';
  } else if (meas.orderName) {
    parentOrderEl.textContent = meas.orderName;
    parentOrderEl.style.display = 'inline-block';
  } else {
    parentOrderEl.textContent = 'Individual Tailoring';
  }

  // Build 5-Stage Dedicated Tailoring Stepper
  const measStepperList = document.getElementById('meas-stepper-list');
  measStepperList.innerHTML = '';

  (meas.stages || []).forEach((stg, index) => {
    const li = document.createElement('li');
    li.className = `step-node ${stg.status}`;

    let badgeContent = `${index + 1}`;
    if (stg.status === 'completed') {
      badgeContent = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    }

    const timeString = stg.timestamp ? formatShortDate(stg.timestamp) : '';
    li.innerHTML = `
      <div class="step-badge">${badgeContent}</div>
      <div class="step-info">
        <span class="step-label">${escapeHtml(stg.label)}</span>
        ${timeString ? `<span class="step-time">${timeString}</span>` : ''}
      </div>
    `;

    measStepperList.appendChild(li);
  });

  // Populate Body Measurement Spec Cards
  const grid = document.getElementById('meas-grid');
  grid.innerHTML = '';

  const specs = Object.entries(meas.measurements || {});
  if (specs.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">
        Standard fit tailored according to institutional uniform pattern.
      </div>
    `;
  } else {
    specs.forEach(([param, value]) => {
      const box = document.createElement('div');
      box.className = 'dimension-box';
      box.innerHTML = `
        <span class="dim-label">${escapeHtml(param)}</span>
        <div class="dim-val">${value}<span class="dim-unit">"</span></div>
      `;
      grid.appendChild(box);
    });
  }

  // Notes Box
  const notesBox = document.getElementById('meas-notes-box');
  const notesText = document.getElementById('meas-notes-text');
  if (meas.notes && meas.notes.trim()) {
    notesText.textContent = meas.notes.trim();
    notesBox.classList.remove('hidden');
  } else {
    notesBox.classList.add('hidden');
  }

  showState('measurement');
}

// 9. State View Switcher
function showState(state) {
  stateWelcome.classList.add('hidden');
  stateLoading.classList.add('hidden');
  stateError.classList.add('hidden');
  viewOrder.classList.add('hidden');
  viewMeasurement.classList.add('hidden');

  if (state === 'welcome') {
    stateWelcome.classList.remove('hidden');
  } else if (state === 'loading') {
    stateLoading.classList.remove('hidden');
  } else if (state === 'error') {
    stateError.classList.remove('hidden');
  } else if (state === 'order') {
    viewOrder.classList.remove('hidden');
  } else if (state === 'measurement') {
    viewMeasurement.classList.remove('hidden');
  }
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMsg.textContent = message;
  showState('error');
}

// 10. Interactive Action Helpers (Copy & Share)
function copyCurrentTrackingId() {
  if (!currentTrackingId) return;
  copyToClipboard(currentTrackingId, `Tracking ID "${currentTrackingId}" copied to clipboard!`);
}

function shareTrackingLink() {
  if (!currentTrackingId) return;

  const url = new URL(window.location.href);
  url.searchParams.set('track', currentTrackingId);
  const shareableUrl = url.toString();

  copyToClipboard(shareableUrl, 'Direct client tracking link copied to clipboard!');
}

function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast(successMsg);
      })
      .catch(() => {
        fallbackCopy(text, successMsg);
      });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
}

let toastTimer = null;
function showToast(message) {
  toastMsg.textContent = message;
  toastEl.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2800);
}

// 11. Date Formatters
function formatReadableDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
