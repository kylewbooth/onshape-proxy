// ===================== ONSHAPE INTEGRATION =====================
// Update this URL after you deploy to Vercel
const ONSHAPE_PROXY_URL = 'https://YOUR-PROJECT-NAME.vercel.app/api/onshape';

// Configuration options matching your OnShape list
const ONSHAPE_CONFIGS = [
  { id: 'Default', label: 'Default' },
  { id: 'First',   label: 'First'   },
  { id: 'Second',  label: 'Second'  },
  { id: 'Last',    label: 'Last'    },
];

function osInit() {
  const sel = document.getElementById('os-config-select');
  sel.innerHTML = '<option value="">-- select configuration --</option>';
  ONSHAPE_CONFIGS.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.label;
    sel.appendChild(o);
  });
}

async function osSendToOnShape() {
  const configId = document.getElementById('os-config-select').value;
  const btn      = document.getElementById('os-send-btn');
  const status   = document.getElementById('os-status');

  if (!configId) {
    osSetStatus('error', '⚠ Please select a configuration first.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';
  osSetStatus('dim', 'Connecting to OnShape…');

  try {
    const response = await fetch(`${ONSHAPE_PROXY_URL}?action=setConfiguration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configurationId: configId }),
    });

    const data = await response.json();

    if (response.ok) {
      osSetStatus('ok', `✔ Configuration set to "${configId}" successfully.`);
    } else {
      osSetStatus('error', `⚠ Error: ${data.error || 'Unknown error from OnShape.'}`);
    }
  } catch (err) {
    osSetStatus('error', `⚠ Could not reach the proxy server. Is it deployed?`);
    console.error('OnShape error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send to OnShape';
  }
}

function osSetStatus(type, msg) {
  const el = document.getElementById('os-status');
  el.textContent = msg;
  el.className = `os-status os-status-${type}`;
}

// Auto-init when script loads (DOM is already ready since script is at bottom of body)
osInit();
