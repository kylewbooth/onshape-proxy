// ===================== GO-FLEX STATE =====================
let gfState = {
  style: 'Close-Coupled',
  skipPerf: false,
  dbseMode: 'stock',
};

// ===================== CL CALCULATIONS =====================
function gfGetGap(size, coverStyle) {
  return (gfGapData[size] && gfGapData[size][coverStyle]) || 0;
}

function gfGetHubStyle(matingHub) {
  // Determine hub type from hub size string
  if (!matingHub) return null;
  if (matingHub.endsWith('T-SH') || matingHub === 'GF20CS-PBS') return 'shafthub';
  if (matingHub.includes('G52') || matingHub.includes('G51') ||
      matingHub.includes('G5282') || matingHub.includes('G81')) return 'rigidhub';
  return 'shafthub';
}

function gfCalcCL(size, spacerStyle, coverStyle, matingHub, dbse) {
  const tooth   = gfToothLength[size];
  const gap     = gfGetGap(size, coverStyle);
  const cbore   = gfHubCBore[size];
  const flangeD = gfFlangeDepth[size] || 0;
  const malePilot = gfShafthubMalePilot[size] || 0.05;
  const hubStyle  = gfGetHubStyle(matingHub);
  const rigidDims = gfRigidHubDims[matingHub] || null;

  if (tooth == null || !gap) return {cl: null, oal: null};

  let cl = null, oal = null;

  if (spacerStyle === 'Double Ended T31 Full Spacer' ||
      spacerStyle === 'Drop-In Style With Double Ended Spacer') {
    // T31 DE CL: same formula regardless of hub type
    // CL = DBSE - 2*(ToothLength + EffectiveGap + StdHubCBore)
    cl  = dbse - 2 * (tooth + gap + cbore);
    oal = cl; // OAL = CL for DE spacer

  } else if (spacerStyle === 'Single Ended T35 Full Spacer') {
    if (hubStyle === 'shafthub') {
      // CL = (DBSE - EffectiveGap - 2*(FlangeDepth - ShafthubMalePilot)) / 2
      cl  = (dbse - gap - 2 * (flangeD - malePilot)) / 2;
      oal = cl + flangeD;
    } else if (hubStyle === 'rigidhub' && rigidDims) {
      // CL = (DBSE - 2*RigidHubFemaleCBore - EffectiveGap) / 2
      cl  = (dbse - 2 * rigidDims.femaleCBore - gap) / 2;
      oal = cl + rigidDims.malePilot;
    }

  } else if (spacerStyle === 'Single Ended T35 Half Spacer') {
    if (hubStyle === 'shafthub') {
      // CL = DBSE - ToothLength - StdHubCBore - EffectiveGap - (FlangeDepth - ShafthubMalePilot)
      cl  = dbse - tooth - cbore - gap - (flangeD - malePilot);
      oal = cl + flangeD;
    } else if (hubStyle === 'rigidhub' && rigidDims) {
      // CL = DBSE - ToothLength - StdHubCBore - EffectiveGap - RigidHubFemaleCBore
      cl  = dbse - tooth - cbore - gap - rigidDims.femaleCBore;
      oal = cl + rigidDims.malePilot;
    }
  }

  if (cl === null) return {cl: null, oal: null};
  return {
    cl:  Math.round(cl  * 10000) / 10000,
    oal: oal !== null ? Math.round(oal * 10000) / 10000 : null
  };
}

function gfFmtNum(n) {
  if (n == null) return 'N/A';
  return parseFloat(n.toFixed(4)).toString();
}

// ===================== ASSEMBLY NAME HELPERS =====================
function gfSpacerAsmName(size, spacerStyle, dbse) {
  const num = (spacerStyle === 'Double Ended T31 Full Spacer' ||
               spacerStyle === 'Drop-In Style With Double Ended Spacer') ? '31' : '35';
  return `${size}-${num}-BE${dbse}`;
}

// ===================== PART ID BUILDERS =====================
function gfCoverID(size, coverStyle) {
  const short = gfCoverShorthand[coverStyle] || coverStyle.replace(' Cover','');
  return `${size}${short}-CVR`;
}

function gfInsertID(size, insertStyle) {
  const short = gfInsertShorthand[insertStyle] || insertStyle.slice(0,2).toUpperCase();
  return `${size}${short}-INS`;
}

function gfStdHubID(size, bore) {
  return bore ? `${size}CS ${bore}` : `${size}CS`;
}

function gfShaftHubID(hubSize, bore) {
  return bore ? `${hubSize} ${bore}` : hubSize;
}

function gfDESpacerID(size, cl) {
  return `${size}-31-CL${gfFmtNum(cl)}`;
}

function gfSESpacerID(size, cl) {
  return `${size}-35-CL${gfFmtNum(cl)}`;
}

function gfCalcTorque() {
  const hp    = parseFloat(document.getElementById('gf-hp').value) || 0;
  const speed = parseFloat(document.getElementById('gf-speed').value) || 0;
  const display     = document.getElementById('gf-torque-display');
  const torqueInput = document.getElementById('gf-torque');
  if (hp > 0 && speed > 0) {
    const t = Math.round((hp * 63025) / speed);
    torqueInput.value = t;
    display.textContent = t.toLocaleString();
    display.className = 'sf-value-display ok';
  } else {
    torqueInput.value = 0;
    display.textContent = '—';
    display.className = 'sf-value-display dim';
  }
  gfUpdateSizes();
  gfCompute();
}

// ===================== INIT =====================
function gfInit() {
  gfSetupEventListeners();
  gfUpdateSizes();
  gfCompute();
}

let gfInitialized = false;
function gfSetupEventListeners() {
  if (gfInitialized) return;
  gfInitialized = true;

  sfInit('gf-', 'goflex');

  document.getElementById('gf-btn-cc').addEventListener('click', () => gfSetStyle('Close-Coupled'));
  document.getElementById('gf-btn-sp').addEventListener('click', () => gfSetStyle('Spacer'));

  ['gf-shaft1','gf-shaft2','gf-torque','gf-sf','gf-speed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { gfUpdateSizes(); gfCompute(); });
  });

  document.getElementById('gf-hp').addEventListener('input', gfCalcTorque);
  document.getElementById('gf-speed').addEventListener('input', gfCalcTorque);

  ['gf-size-select','gf-cover-select','gf-insert-select',
   'gf-spacer-style-select','gf-mating-hub-select',
   'gf-cover-select-sp','gf-insert-select-sp','gf-dbse',
   'gf-stock-dbse-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { gfUpdateDependents(); gfCompute(); });
  });
}

function gfSetStyle(s) {
  gfState.style = s;
  document.getElementById('gf-btn-cc').classList.toggle('active', s === 'Close-Coupled');
  document.getElementById('gf-btn-sp').classList.toggle('active', s === 'Spacer');
  document.getElementById('gf-cc-fields').style.display = s === 'Close-Coupled' ? '' : 'none';
  document.getElementById('gf-sp-fields').style.display = s === 'Spacer' ? '' : 'none';
  gfUpdateSizes();
  gfCompute();
}

function gfToggleSkipPerf() {
  gfState.skipPerf = !gfState.skipPerf;
  const btn = document.getElementById('gf-btn-skip-perf');
  const perfGroup = document.getElementById('gf-perf-inputs-group');
  btn.classList.toggle('active', gfState.skipPerf);
  btn.textContent = gfState.skipPerf ? 'Performance Inputs Skipped' : 'Skip Performance Inputs';
  perfGroup.style.display = gfState.skipPerf ? 'none' : '';
  if (gfState.skipPerf) {
    document.getElementById('gf-hp').value = '';
    document.getElementById('gf-torque').value = '';
    document.getElementById('gf-torque-display').textContent = '—';
    document.getElementById('gf-torque-display').className = 'sf-value-display dim';
    document.getElementById('gf-sf').value = '1.0';
    document.getElementById('gf-speed').value = '';
  }
  gfUpdateSizes();
  gfCompute();
}

// ===================== DBSE MODE =====================
function gfSetDbseMode(m) {
  gfState.dbseMode = m;
  document.getElementById('gf-btn-dbse-stock').classList.toggle('active', m === 'stock');
  document.getElementById('gf-btn-dbse-custom').classList.toggle('active', m === 'custom');
  document.getElementById('gf-stock-dbse-group').style.display = m === 'stock' ? '' : 'none';
  document.getElementById('gf-custom-dbse-group').style.display = m === 'custom' ? '' : 'none';
  if (m === 'stock') gfUpdateStockDBSE();
  gfCompute();
}

function gfUpdateStockDBSE() {
  const size = document.getElementById('gf-size-select').value;
  const spacerStyle = document.getElementById('gf-spacer-style-select').value;
  const sel = document.getElementById('gf-stock-dbse-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— select DBSE —</option>';
  if (!size || !spacerStyle) return;
  const key = `${size}-${spacerStyle}`;
  const entries = gfStockSpacers[key] || [];
  entries.forEach(e => {
    const o = document.createElement('option');
    o.value = e.dbse;
    o.textContent = `${e.dbse}"`;
    o.dataset.spacer1 = e.spacer1 || '';
    o.dataset.spacer2 = e.spacer2 || '';
    if (String(e.dbse) === cur) o.selected = true;
    sel.appendChild(o);
  });
  if (entries.length === 0) {
    sel.innerHTML = '<option value="">— no stock sizes available —</option>';
  }
}

// ===================== SIZE FILTERING =====================
function gfUpdateSizes() {
  const sel = document.getElementById('gf-size-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— select size —</option>';

  const s1 = parseFloat(document.getElementById('gf-shaft1').value) || 0;
  const s2 = parseFloat(document.getElementById('gf-shaft2').value) || 0;
  const torque = parseFloat(document.getElementById('gf-torque').value) || 0;
  const sf = parseFloat(document.getElementById('gf-sf').value) || 1;
  const speed = parseFloat(document.getElementById('gf-speed').value) || 0;
  const designTorque = torque * sf;
  const filterActive = !gfState.skipPerf && (s1 > 0 || s2 > 0 || torque > 0 || speed > 0);

  let compatible = [];

  if (gfState.style === 'Close-Coupled') {
    compatible = gfCCData.filter(row => {
      if (!filterActive) return true;
      const lg = Math.max(s1, s2);
      if (lg > 0 && row.maxBore < lg) return false;
      if (!gfState.skipPerf && torque > 0 && row.maxTorque < designTorque) return false;
      if (!gfState.skipPerf && speed > 0 && row.maxRPM < speed) return false;
      return true;
    }).map(r => r.size);
  } else {
    compatible = gfSpacerData.filter(row => {
      if (!filterActive) return true;
      if (!gfState.skipPerf && torque > 0 && row.maxTorque < designTorque) return false;
      if (!gfState.skipPerf && speed > 0 && row.maxRPM < speed) return false;
      if (s1 > 0 || s2 > 0) {
        const fit  = (!s1 || (s1 >= row.minBore1 && s1 <= row.maxBore1)) &&
                     (!s2 || (s2 >= row.minBore2 && s2 <= row.maxBore2));
        const fitS = (!s2 || (s2 >= row.minBore1 && s2 <= row.maxBore1)) &&
                     (!s1 || (s1 >= row.minBore2 && s1 <= row.maxBore2));
        if (!fit && !fitS) return false;
      }
      return true;
    }).map(r => r.size);
  }

  compatible = [...new Set(compatible)].sort((a,b) =>
    parseInt(a.replace('GF','')) - parseInt(b.replace('GF','')));

  compatible.forEach(sz => {
    const o = document.createElement('option');
    o.value = sz; o.textContent = sz;
    if (sz === cur) o.selected = true;
    sel.appendChild(o);
  });

  if (cur && !compatible.includes(cur)) sel.value = '';
  gfUpdateDependents();
}

// ===================== CASCADING DROPDOWNS =====================
function gfPopulateSelect(selId, values, curVal, labelFn) {
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="">— select —</option>';
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = labelFn ? labelFn(v) : v;
    if (v === curVal) o.selected = true;
    sel.appendChild(o);
  });
}

function gfUpdateDependents() {
  const size = document.getElementById('gf-size-select').value;
  if (gfState.style === 'Close-Coupled') {
    gfUpdateCCDeps(size);
  } else {
    gfUpdateSpacerDeps(size);
  }
}

function gfUpdateCCDeps(size) {
  const curCover  = document.getElementById('gf-cover-select').value;
  const curInsert = document.getElementById('gf-insert-select').value;

  if (!size) {
    gfPopulateSelect('gf-cover-select', [], '', null);
    gfPopulateSelect('gf-insert-select', [], '', null);
    return;
  }

  const covers = [...new Set(gfCCData.filter(r => r.size === size).map(r => r.coverStyle))];
  gfPopulateSelect('gf-cover-select', covers, curCover, v => gfCoverNames[v] || v);

  const selCover = document.getElementById('gf-cover-select').value;
  const inserts  = selCover
    ? [...new Set(gfCCData.filter(r => r.size === size && r.coverStyle === selCover).map(r => r.insertStyle))]
    : [];
  gfPopulateSelect('gf-insert-select', inserts, curInsert, v => gfInsertNames[v] || v);
}

function gfUpdateSpacerDeps(size) {
  const curStyle  = document.getElementById('gf-spacer-style-select').value;
  const curHub    = document.getElementById('gf-mating-hub-select').value;
  const curCover  = document.getElementById('gf-cover-select-sp').value;
  const curInsert = document.getElementById('gf-insert-select-sp').value;

  if (!size) {
    ['gf-spacer-style-select','gf-mating-hub-select','gf-cover-select-sp','gf-insert-select-sp']
      .forEach(id => gfPopulateSelect(id, [], '', null));
    return;
  }

  // Spacer styles available for this size
  const styles = [...new Set(gfSpacerData.filter(r => r.size === size).map(r => r.spacerStyle))];
  gfPopulateSelect('gf-spacer-style-select', styles, curStyle, v => gfSpacerStyleNames[v] || v);
  const selStyle = document.getElementById('gf-spacer-style-select').value;

  // Mating hubs from compatibility table
  const hubs = (gfHubCompat[size] || []).map(e => e.hubSize);
  gfPopulateSelect('gf-mating-hub-select', hubs, curHub, null);
  const selHub = document.getElementById('gf-mating-hub-select').value;

  // Covers filtered by size + style + hub
  const coverRows = gfSpacerData.filter(r =>
    r.size === size &&
    (!selStyle || r.spacerStyle === selStyle) &&
    (!selHub || r.matingHub === selHub)
  );
  const covers = [...new Set(coverRows.map(r => r.coverStyle))];
  gfPopulateSelect('gf-cover-select-sp', covers, curCover, v => gfCoverNames[v] || v);
  const selCover = document.getElementById('gf-cover-select-sp').value;

  // Inserts filtered further
  const insertRows = coverRows.filter(r => !selCover || r.coverStyle === selCover);
  const inserts = [...new Set(insertRows.map(r => r.insertStyle))];
  gfPopulateSelect('gf-insert-select-sp', inserts, curInsert, v => gfInsertNames[v] || v);

  // DBSE range hint
  if (selStyle && size) {
    const dbseRow = gfSpacerData.find(r =>
      r.size === size && r.spacerStyle === selStyle &&
      (!selHub || r.matingHub === selHub));
    if (dbseRow) {
      document.getElementById('gf-dbse-range-txt').innerHTML =
        `Range: <span>${dbseRow.minDBSE}</span> – <span>${dbseRow.maxDBSE}</span> in`;
    }
  }
  // Update stock DBSE dropdown
  gfUpdateStockDBSE();
}

// ===================== BOM ROW HELPER =====================
function gfBomRow(qty, itemId, desc, indent = false) {
  return `<tr${indent ? ' class="sub-row"' : ''}>
    <td class="qty${indent ? ' indent' : ''}">${qty}</td>
    <td class="item-id${indent ? ' indent' : ''}">${itemId}</td>
    <td class="${indent ? 'indent' : ''}">${desc}</td>
  </tr>`;
}

// ===================== COMPUTE =====================
function gfCompute() {
  const s1     = parseFloat(document.getElementById('gf-shaft1').value) || 0;
  const s2     = parseFloat(document.getElementById('gf-shaft2').value) || 0;
  const torque = parseFloat(document.getElementById('gf-torque').value) || 0;
  const sf     = parseFloat(document.getElementById('gf-sf').value) || 1;
  const speed  = parseFloat(document.getElementById('gf-speed').value) || 0;
  const size   = document.getElementById('gf-size-select').value;
  const output = document.getElementById('gf-output-content');
  const designTorque = torque * sf;

  if (!s1 && !s2 && !torque && !gfState.skipPerf) {
    output.innerHTML = `<div class="placeholder"><div class="placeholder-icon">⚙</div><p>Enter inputs to configure assembly</p></div>`;
    return;
  }

  const errors = [], warnings = [];

  if (gfState.style === 'Close-Coupled') {
    const cover  = document.getElementById('gf-cover-select').value;
    const insert = document.getElementById('gf-insert-select').value;

    if (!size)   return gfRenderErrors(['Select a coupling size to proceed.'], output);
    if (!cover)  return gfRenderErrors(['Select a cover style to proceed.'], output);
    if (!insert) return gfRenderErrors(['Select an insert style to proceed.'], output);

    const row = gfCCData.find(r => r.size===size && r.coverStyle===cover && r.insertStyle===insert);
    if (!row) return gfRenderErrors(['No matching configuration found.'], output);

    const lg = Math.max(s1, s2);
    if (lg > 0 && lg < row.minBore) warnings.push(`Shaft size (${lg}") below min bore (${row.minBore}")`);
    if (s1 > row.maxBore) errors.push(`Shaft 1 (${s1}") exceeds max bore (${row.maxBore}")`);
    if (s2 > row.maxBore) errors.push(`Shaft 2 (${s2}") exceeds max bore (${row.maxBore}")`);
    if (!gfState.skipPerf && torque > 0 && designTorque > row.maxTorque)
      errors.push(`Design torque (${designTorque.toFixed(0)} in-lbs) exceeds max (${row.maxTorque.toLocaleString()} in-lbs)`);
    if (!gfState.skipPerf && speed > row.maxRPM)
      errors.push(`Speed (${speed} RPM) exceeds max (${row.maxRPM} RPM)`);

    gfRenderCC(row, s1, s2, torque, sf, designTorque, speed, errors, warnings, output);

  } else {
    const spacerStyle = document.getElementById('gf-spacer-style-select').value;
    const matingHub   = document.getElementById('gf-mating-hub-select').value;
    const cover       = document.getElementById('gf-cover-select-sp').value;
    const insert      = document.getElementById('gf-insert-select-sp').value;

    if (!size)        return gfRenderErrors(['Select a coupling size to proceed.'], output);
    if (!spacerStyle) return gfRenderErrors(['Select a spacer style to proceed.'], output);
    if (!matingHub)   return gfRenderErrors(['Select a mating hub to proceed.'], output);
    if (!cover)       return gfRenderErrors(['Select a cover style to proceed.'], output);
    if (!insert)      return gfRenderErrors(['Select an insert style to proceed.'], output);

    // Get DBSE and stock spacer parts depending on mode
    let dbse = null;
    let stockSpacer1 = null, stockSpacer2 = null;
    if (gfState.dbseMode === 'stock') {
      const stockSel = document.getElementById('gf-stock-dbse-select');
      if (!stockSel.value) return gfRenderErrors(['Select a stock DBSE to proceed.'], output);
      dbse = parseFloat(stockSel.value);
      const opt = stockSel.options[stockSel.selectedIndex];
      stockSpacer1 = opt.dataset.spacer1 || null;
      stockSpacer2 = opt.dataset.spacer2 || null;
    } else {
      dbse = parseFloat(document.getElementById('gf-dbse').value) || null;
      if (dbse === null) return gfRenderErrors(['Enter a DBSE value.'], output);
    }

    const row = gfSpacerData.find(r =>
      r.size === size && r.spacerStyle === spacerStyle &&
      r.coverStyle === cover && r.insertStyle === insert &&
      r.matingHub === matingHub);

    if (!row) return gfRenderErrors(['No matching configuration found for these selections.'], output);

    if (s1 > 0 && s1 < row.minBore1) warnings.push(`Shaft 1 (${s1}") below min bore 1 (${row.minBore1}")`);
    if (s1 > row.maxBore1) errors.push(`Shaft 1 (${s1}") exceeds max bore 1 (${row.maxBore1}")`);
    if (s2 > 0 && s2 < row.minBore2) warnings.push(`Shaft 2 (${s2}") below min bore 2 (${row.minBore2}")`);
    if (s2 > row.maxBore2) errors.push(`Shaft 2 (${s2}") exceeds max bore 2 (${row.maxBore2}")`);
    if (!gfState.skipPerf && torque > 0 && designTorque > row.maxTorque)
      errors.push(`Design torque (${designTorque.toFixed(0)} in-lbs) exceeds max (${row.maxTorque.toLocaleString()} in-lbs)`);
    if (!gfState.skipPerf && speed > row.maxRPM)
      errors.push(`Speed (${speed} RPM) exceeds max (${row.maxRPM} RPM)`);
    if (dbse < row.minDBSE) errors.push(`DBSE (${dbse}") below minimum (${row.minDBSE}")`);
    if (dbse > row.maxDBSE) errors.push(`DBSE (${dbse}") exceeds maximum (${row.maxDBSE}")`);

    gfRenderSpacer(row, s1, s2, torque, sf, designTorque, speed, dbse, stockSpacer1, stockSpacer2, errors, warnings, output);
  }
}

function gfRenderErrors(msgs, output) {
  output.innerHTML = msgs.map(m => `<div class="err-block">⚠ ${m}</div>`).join('');
}

// ===================== RENDER: CLOSE COUPLED =====================
function gfRenderCC(row, s1, s2, torque, sf, designTorque, speed, errors, warnings, output) {
  const dsf    = row.maxTorque / (torque || 1);
  const dsfOk  = dsf >= sf;
  const coverID  = gfCoverID(row.size, row.coverStyle);
  const insertID = gfInsertID(row.size, row.insertStyle);
  const hub1ID   = s1 ? `${row.size}CS ${s1}` : `${row.size}CS`;
  const hub2ID   = s2 ? `${row.size}CS ${s2}` : `${row.size}CS`;
  const asmName  = `${row.size} ${s1 || '?'} X ${s2 || '?'}`;

  let html = '';
  if (errors.length)   html += errors.map(e => `<div class="alert err">⚠ ${e}</div>`).join('');
  if (warnings.length) html += warnings.map(w => `<div class="alert warn">⚠ ${w}</div>`).join('');
  const ccImg = gfGetAssemblyImage('Close-Coupled', null);
  if (ccImg) html += `<div class="assembly-image-wrap"><img src="${ccImg}" class="assembly-image" alt="Assembly diagram"></div>`;

  html += `
  <div class="output-header">
    <div>
      <div class="assembly-name-display">${asmName}</div>
      <div class="description-tag">Go-Flex Close Coupled — ${row.coverStyle} / ${row.insertStyle}</div>
    </div>
  </div>
  <div class="specs-bar">
    <div class="spec-item"><div class="spec-label">Max Torque</div><div class="spec-value accent">${row.maxTorque.toLocaleString()}</div><div class="spec-unit">in-lbs</div></div>
    <div class="spec-item"><div class="spec-label">Max Speed</div><div class="spec-value">${row.maxRPM.toLocaleString()}</div><div class="spec-unit">RPM</div></div>
    <div class="spec-item"><div class="spec-label">Design SF</div><div class="spec-value ${torque?(dsfOk?'ok':'err'):''}">${torque?dsf.toFixed(2):'—'}</div></div>
    <div class="spec-item"><div class="spec-label">Cover</div><div class="spec-value">${row.coverStyle}</div></div>
    <div class="spec-item"><div class="spec-label">Insert</div><div class="spec-value">${row.insertStyle}</div></div>
  </div>
  <div class="bom-section">
    <div class="bom-title">Bill of Materials</div>
    <table class="bom-table">
      <thead><tr><th>QTY</th><th>Item ID</th><th>Description</th></tr></thead>
      <tbody>
        ${gfBomRow(1, hub1ID, s1 ? `Hub 1 (${s1} in)` : 'Hub 1')}
        ${gfBomRow(1, hub2ID, s2 ? `Hub 2 (${s2} in)` : 'Hub 2')}
        ${gfBomRow(1, insertID, `Insert — ${row.insertStyle}`)}
        ${gfBomRow(1, coverID, `Cover — ${row.coverStyle}`)}
      </tbody>
    </table>
  </div>`;

  output.innerHTML = html;
}

// ===================== RENDER: SPACER =====================
function gfRenderSpacer(row, s1, s2, torque, sf, designTorque, speed, dbse, stockSpacer1, stockSpacer2, errors, warnings, output) {
  const dsf   = row.maxTorque / (torque || 1);
  const dsfOk = dsf >= sf;

  const result  = gfCalcCL(row.size, row.spacerStyle, row.coverStyle, row.matingHub, dbse);
  const cl      = result.cl;
  const oal     = result.oal;
  const clStr   = gfFmtNum(cl);
  const oalStr  = gfFmtNum(oal);
  const coverID  = gfCoverID(row.size, row.coverStyle);
  const insertID = gfInsertID(row.size, row.insertStyle);

  // Hardware kit from compatibility table
  const hubEntry = (gfHubCompat[row.size] || []).find(e => e.hubSize === row.matingHub);
  const hwID = hubEntry ? hubEntry.hardware : `${row.size}-SPCR-HDWR`;

  // Hub IDs depend on hub type
  const isStdGF = row.matingHub.startsWith('GF') || row.matingHub.includes('CS-PBS');
  const shaftHub1ID = s1 ? gfShaftHubID(row.matingHub, s1) : row.matingHub;
  const shaftHub2ID = s2 ? gfShaftHubID(row.matingHub, s2) : row.matingHub;
  const stdHub1ID   = s1 ? gfStdHubID(row.size, s1) : gfStdHubID(row.size, '');
  const stdHub2ID   = s2 ? gfStdHubID(row.size, s2) : gfStdHubID(row.size, '');

  const deSpcr = stockSpacer1 && row.spacerStyle === 'Double Ended T31 Full Spacer' ? stockSpacer1 : gfDESpacerID(row.size, cl);
  const seSpcr = stockSpacer1 && row.spacerStyle !== 'Double Ended T31 Full Spacer' ? stockSpacer1 : gfSESpacerID(row.size, cl);
  const seSpcrAlt = stockSpacer2 || (row.spacerStyle === 'Single Ended T35 Full Spacer' ? seSpcr : gfSESpacerID(row.size, cl));

  // Drop-in SE uses standard fixed length
  const seDropInLen = gfDropInSELength[row.size];

  const asmName = `${row.size}-${row.spacerStyle.replace(/ /g,'-')}-${dbse}`;

  let html = '';
  if (errors.length)   html += errors.map(e => `<div class="alert err">⚠ ${e}</div>`).join('');
  if (warnings.length) html += warnings.map(w => `<div class="alert warn">⚠ ${w}</div>`).join('');
  const spImg = gfGetAssemblyImage('Spacer', row.spacerStyle);
  if (spImg) html += `<div class="assembly-image-wrap"><img src="${spImg}" class="assembly-image" alt="Assembly diagram"></div>`;

  html += `
  <div class="output-header">
    <div>
      <div class="assembly-name-display">${gfSpacerAsmName(row.size, row.spacerStyle, dbse)}</div>
      <div class="description-tag">Go-Flex ${gfSpacerStyleNames[row.spacerStyle]||row.spacerStyle} — ${row.coverStyle} / ${row.insertStyle}</div>
    </div>
  </div>
  <div class="specs-bar">
    <div class="spec-item"><div class="spec-label">Max Torque</div><div class="spec-value accent">${row.maxTorque.toLocaleString()}</div><div class="spec-unit">in-lbs</div></div>
    <div class="spec-item"><div class="spec-label">Max Speed</div><div class="spec-value">${row.maxRPM.toLocaleString()}</div><div class="spec-unit">RPM</div></div>
    <div class="spec-item"><div class="spec-label">Design SF</div><div class="spec-value ${torque?(dsfOk?'ok':'err'):''}">${torque?dsf.toFixed(2):'—'}</div></div>
    <div class="spec-item"><div class="spec-label">DBSE Range</div><div class="spec-value" style="font-size:13px">${row.minDBSE} – ${row.maxDBSE}</div><div class="spec-unit">in</div></div>
    ${cl !== null ? `<div class="spec-item"><div class="spec-label">Spacer CL</div><div class="spec-value accent">${clStr}</div><div class="spec-unit">in</div></div>` : ''}
    ${oal !== null && row.spacerStyle !== 'Double Ended T31 Full Spacer' ? `<div class="spec-item"><div class="spec-label">Spacer OAL</div><div class="spec-value">${oalStr}</div><div class="spec-unit">in</div></div>` : ''}
  </div>
  <div class="bom-section">
    <div class="bom-title">Bill of Materials</div>
    <table class="bom-table">
      <thead><tr><th>QTY</th><th>Item ID</th><th>Description</th></tr></thead>
      <tbody>`;

  if (row.spacerStyle === 'Double Ended T31 Full Spacer') {
    // Uses Standard GoFlex Hubs (GF##CS), 2 covers, 2 inserts, 1 DE spacer
    html += `
        ${gfBomRow(2, coverID, `Cover — ${row.coverStyle}`)}
        ${gfBomRow(2, insertID, `Insert — ${row.insertStyle}`)}
        ${gfBomRow(1, stdHub1ID, s1 ? `Standard Hub 1 (${s1} in)` : 'Standard Hub 1')}
        ${gfBomRow(1, stdHub2ID, s2 ? `Standard Hub 2 (${s2} in)` : 'Standard Hub 2')}
        ${gfBomRow(1, deSpcr, `DE Spacer — CL ${clStr} in`)}`;

  } else if (row.spacerStyle === 'Single Ended T35 Full Spacer') {
    // Uses shaft hubs, 1 cover, 1 insert, 2 SE spacers, 2 hardware kits
    html += `
        ${gfBomRow(1, coverID, `Cover — ${row.coverStyle}`)}
        ${gfBomRow(1, insertID, `Insert — ${row.insertStyle}`)}
        ${gfBomRow(1, shaftHub1ID, s1 ? `Shaft Hub 1 (${s1} in)` : 'Shaft Hub 1')}
        ${gfBomRow(1, shaftHub2ID, s2 ? `Shaft Hub 2 (${s2} in)` : 'Shaft Hub 2')}
        ${gfBomRow(1, seSpcr, `SE Spacer 1 — CL ${clStr} in${oal ? ' / OAL ' + oalStr + ' in' : ''}`)}
        ${gfBomRow(1, seSpcrAlt, `SE Spacer 2`)}
        ${gfBomRow(2, hwID, 'Hardware Kit', true)}`;

  } else if (row.spacerStyle === 'Single Ended T35 Half Spacer') {
    // 1 cover, 1 insert, 1 shaft hub, 1 SE spacer, 1 std hub, 1 hardware
    html += `
        ${gfBomRow(1, coverID, `Cover — ${row.coverStyle}`)}
        ${gfBomRow(1, insertID, `Insert — ${row.insertStyle}`)}
        ${gfBomRow(1, shaftHub1ID, s1 ? `Shaft Hub (${s1} in)` : 'Shaft Hub')}
        ${gfBomRow(1, seSpcr, `SE Spacer — CL ${clStr} in${oal ? ' / OAL ' + oalStr + ' in' : ''}`)}
        ${gfBomRow(1, stdHub2ID, s2 ? `Standard Hub (${s2} in)` : 'Standard Hub')}
        ${gfBomRow(1, hwID, 'Hardware Kit', true)}`;

  } else if (row.spacerStyle === 'Drop-In Style With Double Ended Spacer') {
    // 2 covers, 2 inserts, 2 shaft hubs, 2 SE spacers (fixed length), 1 DE spacer, 2 hardware
    const seDropID = seDropInLen ? gfSESpacerID(row.size, seDropInLen) : seSpcr;
    html += `
        ${gfBomRow(2, coverID, `Cover — ${row.coverStyle}`)}
        ${gfBomRow(2, insertID, `Insert — ${row.insertStyle}`)}
        ${gfBomRow(1, shaftHub1ID, s1 ? `Shaft Hub 1 (${s1} in)` : 'Shaft Hub 1')}
        ${gfBomRow(1, shaftHub2ID, s2 ? `Shaft Hub 2 (${s2} in)` : 'Shaft Hub 2')}
        ${gfBomRow(2, seDropID, `SE Spacer${seDropInLen ? ' — L ' + seDropInLen + ' in' : ''}`)}
        ${gfBomRow(1, deSpcr, `DE Spacer — CL ${clStr} in`)}
        ${gfBomRow(2, hwID, 'Hardware Kit', true)}`;
  }

  html += `
      </tbody>
    </table>
  </div>`;

  output.innerHTML = html;
}
