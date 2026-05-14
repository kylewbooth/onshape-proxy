// ===================== SERVICE FACTOR SELECTOR =====================
// Shared logic used by both Blueflex (prefix '') and GoFlex (prefix 'gf-')

function sfInit(prefix, couplingType) {
  const appSel  = document.getElementById(`${prefix}sf-app-select`);
  const sub1Sel = document.getElementById(`${prefix}sf-sub1-select`);
  const sub2Sel = document.getElementById(`${prefix}sf-sub2-select`);
  // Blueflex uses 'sf-hidden'; GoFlex uses 'gf-sf'; Gear uses 'gc-sf-hidden'
  const sfHiddenId = prefix === '' ? 'sf-hidden' : prefix === 'gf-' ? 'gf-sf' : `${prefix}sf-hidden`;
  const sfInput = document.getElementById(sfHiddenId);
  const sfDisplay  = document.getElementById(`${prefix}sf-display`);
  const sub1Group  = document.getElementById(`${prefix}sf-sub1-group`);
  const sub2Group  = document.getElementById(`${prefix}sf-sub2-group`);
  const msgEl      = document.getElementById(`${prefix}sf-msg`);

  // Populate application dropdown
  appSel.innerHTML = '<option value="">— select application —</option>';
  Object.keys(sfData).forEach(app => {
    const o = document.createElement('option');
    o.value = app; o.textContent = app;
    appSel.appendChild(o);
  });

  function updateSF() {
    const app  = appSel.value;
    const sub1 = sub1Sel.value;
    const sub2 = sub2Sel.value;

    if (!app) {
      sub1Group.style.display = 'none';
      sub2Group.style.display = 'none';
      sfDisplay.textContent = '';
      if (msgEl) msgEl.textContent = '';
      return;
    }

    const appData = sfData[app];
    const keys = Object.keys(appData).filter(k => k !== '_self');

    // Show/hide sub1
    if (keys.length > 0) {
      sub1Sel.innerHTML = '<option value="">— select subcategory —</option>';
      keys.forEach(k => {
        const o = document.createElement('option');
        o.value = k; o.textContent = k;
        if (k === sub1) o.selected = true;
        sub1Sel.appendChild(o);
      });
      sub1Group.style.display = '';
    } else {
      sub1Group.style.display = 'none';
      sub1Sel.value = '';
    }

    // Determine which entry to read SF from
    let entry = null;
    if (!sub1 || !appData[sub1]) {
      entry = appData['_self'] || null;
    } else {
      const sub1Data = appData[sub1];
      const sub2Keys = Object.keys(sub1Data).filter(k => k !== '_self');

      if (sub2Keys.length > 0) {
        sub2Sel.innerHTML = '<option value="">— select subcategory —</option>';
        sub2Keys.forEach(k => {
          const o = document.createElement('option');
          o.value = k; o.textContent = k;
          if (k === sub2) o.selected = true;
          sub2Sel.appendChild(o);
        });
        sub2Group.style.display = '';
        entry = sub2 ? sub1Data[sub2] : (sub1Data['_self'] || null);
      } else {
        sub2Group.style.display = 'none';
        sub2Sel.value = '';
        entry = sub1Data['_self'] || null;
      }
    }

    // Apply SF
    if (entry) {
      const sf  = couplingType === 'goflex' ? entry.gf : couplingType === 'gear' ? entry.gc : entry.bf;
      const err = entry.err || '';
      const sfNum = parseFloat(sf);

      if (msgEl) msgEl.textContent = err || '';
      msgEl && (msgEl.className = err ? 'sf-msg sf-msg-warn' : 'sf-msg');

      if (sfNum > 0 && !err.includes('factory') && !err.includes('approved')) {
        sfInput.value = sfNum;
        sfDisplay.textContent = sfNum;
        sfDisplay.className = 'sf-value-display ok';
      } else if (err === 'Incomplete selection') {
        sfInput.value = '';
        sfDisplay.textContent = '—';
        sfDisplay.className = 'sf-value-display dim';
      } else {
        sfInput.value = '';
        sfDisplay.textContent = err || '—';
        sfDisplay.className = 'sf-value-display warn';
      }
    } else {
      sfDisplay.textContent = '—';
      sfDisplay.className = 'sf-value-display dim';
      sfInput.value = '';
    }

    // Trigger recompute
    sfInput.dispatchEvent(new Event('input'));
  }

  appSel.addEventListener('change', () => {
    sub1Sel.value = '';
    sub2Sel.value = '';
    updateSF();
  });
  sub1Sel.addEventListener('change', () => {
    sub2Sel.value = '';
    updateSF();
  });
  sub2Sel.addEventListener('change', updateSF);
}

function sfToggleMode(prefix, mode) {
  const manualGroup = document.getElementById(`${prefix}sf-manual-group`);
  const appGroup    = document.getElementById(`${prefix}sf-app-group`);
  const btnManual   = document.getElementById(`${prefix}sf-btn-manual`);
  const btnApp      = document.getElementById(`${prefix}sf-btn-app`);

  if (mode === 'manual') {
    manualGroup.style.display = '';
    appGroup.style.display    = 'none';
    btnManual.classList.add('active');
    btnApp.classList.remove('active');
  } else {
    manualGroup.style.display = 'none';
    appGroup.style.display    = '';
    btnManual.classList.remove('active');
    btnApp.classList.add('active');
  }
}
