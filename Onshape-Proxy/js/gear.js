// ===================== GEAR COUPLING STATE =====================
let gcState = {
  skipPerf:  false,
  styleType: 'G20',    // G20, G52, G82
  boltStyle: 'exposed', // exposed, shrouded
};

// Sizes that have shrouded variants
const gcShroudedSizes = ['1010G','1015G','1020G','1025G','1030G','1035G','1040G','1045G','1050G','1055G'];

// Map styleType + boltStyle → actual assembly style code
function gcResolveStyle(styleType, boltStyle, size) {
  const shroudedMap = {'G20':'G10','G52':'G51','G82':'G81'};
  const hasShrouded = gcShroudedSizes.includes(size);
  const isHD = size && !gcShroudedSizes.includes(size) && parseInt(size) >= 1060;

  if (boltStyle === 'shrouded' && hasShrouded) {
    const base = shroudedMap[styleType];
    return `${base}-SD`;
  }
  // Exposed bolt — SD for 1010-1055, HD for 1060+
  const suffix = (size && parseInt(size) >= 1060) ? 'HD' : 'SD';
  return `${styleType}-${suffix}`;
}

function gcSetStyleType(type) {
  gcState.styleType = type;
  ['G20','G52','G82'].forEach(t => {
    document.getElementById(`gc-btn-${t.toLowerCase()}`).classList.toggle('active', t === type);
  });
  gcUpdateBoltToggle();
  gcCompute();
}

function gcSetBoltStyle(bolt) {
  gcState.boltStyle = bolt;
  document.getElementById('gc-btn-exposed').classList.toggle('active', bolt === 'exposed');
  document.getElementById('gc-btn-shrouded').classList.toggle('active', bolt === 'shrouded');
  gcCompute();
}

function gcUpdateBoltToggle() {
  const size = document.getElementById('gc-size-select').value;
  const boltGroup = document.getElementById('gc-bolt-group');
  const hasShrouded = gcShroudedSizes.includes(size);
  boltGroup.style.display = (size && hasShrouded) ? '' : 'none';
  // If size doesn't support shrouded, reset to exposed
  if (!hasShrouded && gcState.boltStyle === 'shrouded') {
    gcState.boltStyle = 'exposed';
    document.getElementById('gc-btn-exposed').classList.add('active');
    document.getElementById('gc-btn-shrouded').classList.remove('active');
  }
}

// ===================== GEAR COUPLING INIT =====================
let gcInitialized = false;

function gcInit() {
  if (!gcInitialized) {
    gcInitialized = true;
    gcSetupEventListeners();
  }
  gcUpdateSizes();
  gcCompute();
}

function gcSetupEventListeners() {
  sfInit('gc-', 'gear'); // gear couplings use their own SF table

  ['gc-shaft1','gc-shaft2','gc-torque','gc-sf','gc-speed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { gcUpdateSizes(); gcCompute(); });
  });

  document.getElementById('gc-hp').addEventListener('input', gcCalcTorque);
  document.getElementById('gc-speed').addEventListener('input', gcCalcTorque);

  ['gc-size-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { gcUpdateBoltToggle(); gcCompute(); });
  });
}

// ===================== HP → TORQUE =====================
function gcCalcTorque() {
  const hp    = parseFloat(document.getElementById('gc-hp').value) || 0;
  const speed = parseFloat(document.getElementById('gc-speed').value) || 0;
  const display     = document.getElementById('gc-torque-display');
  const torqueInput = document.getElementById('gc-torque');

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
  gcUpdateSizes();
  gcCompute();
}

// ===================== SKIP PERF =====================
function gcToggleSkipPerf() {
  gcState.skipPerf = !gcState.skipPerf;
  const btn = document.getElementById('gc-btn-skip-perf');
  const perfGroup = document.getElementById('gc-perf-inputs-group');
  btn.classList.toggle('active', gcState.skipPerf);
  btn.textContent = gcState.skipPerf ? 'Performance Inputs Skipped' : 'Skip Performance Inputs';
  perfGroup.style.display = gcState.skipPerf ? 'none' : '';
  if (gcState.skipPerf) {
    document.getElementById('gc-hp').value = '';
    document.getElementById('gc-torque').value = '';
    document.getElementById('gc-torque-display').textContent = '—';
    document.getElementById('gc-torque-display').className = 'sf-value-display dim';
    document.getElementById('gc-sf').value = '1.0';
    document.getElementById('gc-speed').value = '';
  }
  gcUpdateSizes();
  gcCompute();
}

// ===================== SIZE FILTERING =====================
function gcUpdateSizes() {
  const sel = document.getElementById('gc-size-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— select size —</option>';

  const s1 = parseFloat(document.getElementById('gc-shaft1').value) || 0;
  const s2 = parseFloat(document.getElementById('gc-shaft2').value) || 0;
  const torque = parseFloat(document.getElementById('gc-torque').value) || 0;
  const sf = parseFloat((document.getElementById('gc-sf-btn-app').classList.contains('active')
    ? document.getElementById('gc-sf-hidden')
    : document.getElementById('gc-sf')).value) || 1;
  const speed = parseFloat(document.getElementById('gc-speed').value) || 0;
  const designTorque = torque * sf;
  const style = gcResolveStyle(gcState.styleType, gcState.boltStyle, cur);
  const filterActive = !gcState.skipPerf && (s1 > 0 || s2 > 0 || torque > 0 || speed > 0);

  const isFlexOnly  = gcFlexOnlyStyles.includes(style)  || !style;
  const isRigidOnly = gcRigidOnlyStyles.includes(style) || !style;
  const isMixed     = gcMixedStyles.includes(style)     || !style;

  const compatible = gcSizeData.filter(row => {
    if (!filterActive) return true;

    // Torque and speed checks
    if (!gcState.skipPerf && torque > 0 && row.maxTorque < designTorque) return false;
    if (!gcState.skipPerf && speed > 0 && row.maxRPM < speed) return false;

    // Bore checks depend on style
    if (style && gcFlexOnlyStyles.includes(style)) {
      const lg = Math.max(s1, s2);
      if (lg > 0 && lg > row.flexMaxBore) return false;
    } else if (style && gcRigidOnlyStyles.includes(style)) {
      const lg = Math.max(s1, s2);
      if (lg > 0 && lg > row.rigidMaxBore) return false;
    } else if (style && gcMixedStyles.includes(style)) {
      // Larger shaft → rigid hub, smaller → flex hub
      const larger  = Math.max(s1, s2);
      const smaller = Math.min(s1 || s2, s2 || s1);
      if (larger  > 0 && larger  > row.rigidMaxBore) return false;
      if (smaller > 0 && smaller > row.flexMaxBore)  return false;
    } else {
      // No style selected — check against max of either
      const lg = Math.max(s1, s2);
      if (lg > 0 && lg > row.rigidMaxBore) return false;
    }
    return true;
  }).map(r => r.size);

  compatible.forEach(sz => {
    const o = document.createElement('option');
    o.value = sz; o.textContent = sz;
    if (sz === cur) o.selected = true;
    sel.appendChild(o);
  });

  if (cur && !compatible.includes(cur)) sel.value = '';

  gcUpdateBoltToggle();
}

// ===================== BOM ROW =====================
function gcBomRow(qty, itemId, desc, indent) {
  return `<tr${indent ? ' class="sub-row"' : ''}>
    <td class="qty${indent ? ' indent' : ''}">${qty}</td>
    <td class="item-id${indent ? ' indent' : ''}">${itemId}</td>
    <td class="${indent ? 'indent' : ''}">${desc}</td>
  </tr>`;
}

// ===================== COMPUTE =====================
function gcCompute() {
  const s1     = parseFloat(document.getElementById('gc-shaft1').value) || 0;
  const s2     = parseFloat(document.getElementById('gc-shaft2').value) || 0;
  const torque = parseFloat(document.getElementById('gc-torque').value) || 0;
  const sf = parseFloat((document.getElementById('gc-sf-btn-app').classList.contains('active')
    ? document.getElementById('gc-sf-hidden')
    : document.getElementById('gc-sf')).value) || 1;
  const speed  = parseFloat(document.getElementById('gc-speed').value) || 0;
  const size   = document.getElementById('gc-size-select').value;
  const style  = gcResolveStyle(gcState.styleType, gcState.boltStyle, size);
  const output = document.getElementById('gc-output-content');
  const designTorque = torque * sf;

  if (!s1 && !s2 && !torque && !gcState.skipPerf) {
    output.innerHTML = `<div class="placeholder"><div class="placeholder-icon">⚙</div><p>Enter inputs to configure assembly</p></div>`;
    return;
  }

  if (!size)  return gcRenderErrors(['Select a coupling size to proceed.'], output);

  const sizeRow = gcSizeData.find(r => r.size === size);
  const asmRow  = gcAssemblyData.find(r => r.size === size && r.style === style);
  if (!sizeRow || !asmRow) return gcRenderErrors(['No matching configuration found.'], output);

  const errors = [], warnings = [];

  // Torque / speed validation
  if (!gcState.skipPerf && torque > 0 && designTorque > sizeRow.maxTorque)
    errors.push(`Design torque (${designTorque.toFixed(0)} in-lbs) exceeds max torque (${sizeRow.maxTorque.toLocaleString()} in-lbs)`);
  if (!gcState.skipPerf && speed > sizeRow.maxRPM)
    errors.push(`Speed (${speed} RPM) exceeds max speed (${sizeRow.maxRPM} RPM)`);

  // Bore validation
  const isFlexOnly  = gcFlexOnlyStyles.includes(style);
  const isRigidOnly = gcRigidOnlyStyles.includes(style);
  const isMixed     = gcMixedStyles.includes(style);

  // For mixed: larger shaft → rigid, smaller → flex
  const larger  = (s1 || 0) >= (s2 || 0) ? s1 : s2;
  const smaller = (s1 || 0) >= (s2 || 0) ? s2 : s1;

  if (isFlexOnly) {
    if (s1 > sizeRow.flexMaxBore) errors.push(`Shaft 1 (${s1}") exceeds flex hub max bore (${sizeRow.flexMaxBore}")`);
    if (s2 > sizeRow.flexMaxBore) errors.push(`Shaft 2 (${s2}") exceeds flex hub max bore (${sizeRow.flexMaxBore}")`);
    if (s1 > 0 && s1 < sizeRow.flexMinBore) warnings.push(`Shaft 1 (${s1}") below flex hub min bore (${sizeRow.flexMinBore}")`);
    if (s2 > 0 && s2 < sizeRow.flexMinBore) warnings.push(`Shaft 2 (${s2}") below flex hub min bore (${sizeRow.flexMinBore}")`);
  } else if (isRigidOnly) {
    if (s1 > sizeRow.rigidMaxBore) errors.push(`Shaft 1 (${s1}") exceeds rigid hub max bore (${sizeRow.rigidMaxBore}")`);
    if (s2 > sizeRow.rigidMaxBore) errors.push(`Shaft 2 (${s2}") exceeds rigid hub max bore (${sizeRow.rigidMaxBore}")`);
    if (s1 > 0 && s1 < sizeRow.rigidMinBore) warnings.push(`Shaft 1 (${s1}") below rigid hub min bore (${sizeRow.rigidMinBore}")`);
    if (s2 > 0 && s2 < sizeRow.rigidMinBore) warnings.push(`Shaft 2 (${s2}") below rigid hub min bore (${sizeRow.rigidMinBore}")`);
  } else if (isMixed) {
    if (larger  > sizeRow.rigidMaxBore) errors.push(`Larger shaft (${larger}") exceeds rigid hub max bore (${sizeRow.rigidMaxBore}")`);
    if (smaller > sizeRow.flexMaxBore)  errors.push(`Smaller shaft (${smaller}") exceeds flex hub max bore (${sizeRow.flexMaxBore}")`);
    if (larger  > 0 && larger  < sizeRow.rigidMinBore) warnings.push(`Larger shaft (${larger}") below rigid hub min bore (${sizeRow.rigidMinBore}")`);
    if (smaller > 0 && smaller < sizeRow.flexMinBore)  warnings.push(`Smaller shaft (${smaller}") below flex hub min bore (${sizeRow.flexMinBore}")`);
  }

  gcRenderOutput(asmRow, sizeRow, s1, s2, larger, smaller, torque, sf, designTorque, speed, isMixed, errors, warnings, output);
}

function gcRenderErrors(msgs, output) {
  output.innerHTML = msgs.map(m => `<div class="err-block">⚠ ${m}</div>`).join('');
}

function gcRenderOutput(asm, sizeRow, s1, s2, larger, smaller, torque, sf, designTorque, speed, isMixed, errors, warnings, output) {
  const dsf   = sizeRow.maxTorque / (torque || 1);
  const dsfOk = dsf >= sf;

  // Build bore-aware hub IDs
  const flexHub1ID  = s1 ? `${asm.flexHub} ${isMixed ? smaller : s1}` : (asm.flexHub || '—');
  const flexHub2ID  = s2 ? `${asm.flexHub} ${isMixed ? smaller : s2}` : (asm.flexHub || '—');
  const rigidHub1ID = s1 ? `${asm.rigidHub} ${isMixed ? larger : s1}` : (asm.rigidHub || '—');
  const rigidHub2ID = s2 ? `${asm.rigidHub} ${isMixed ? larger : s2}` : (asm.rigidHub || '—');

  const isFlexOnly  = gcFlexOnlyStyles.includes(asm.style);
  const isRigidOnly = gcRigidOnlyStyles.includes(asm.style);

  // Assembly name: size + style suffix + shaft sizes
  const asmName = `${asm.size}${asm.style.replace(/[A-Z]+\d+$/,'')} ${s1||'?'} X ${s2||'?'}`;

  let html = '';
  if (errors.length)   html += errors.map(e => `<div class="alert err">⚠ ${e}</div>`).join('');
  if (warnings.length) html += warnings.map(w => `<div class="alert warn">⚠ ${w}</div>`).join('');

  const gcImg = gcGetAssemblyImage(asm.style);
  if (gcImg) html += `<div class="assembly-image-wrap"><img src="${gcImg}" class="assembly-image" alt="Assembly diagram"></div>`;

  html += `
  <div class="output-header">
    <div>
      <div class="assembly-name-display">${asm.size} ${s1||'?'} X ${s2||'?'}</div>
      <div class="description-tag">${gcStyleNames[asm.style] || asm.style}</div>
    </div>
  </div>
  <div class="specs-bar">
    <div class="spec-item"><div class="spec-label">Max Torque</div><div class="spec-value accent">${sizeRow.maxTorque.toLocaleString()}</div><div class="spec-unit">in-lbs</div></div>
    <div class="spec-item"><div class="spec-label">Max Speed</div><div class="spec-value">${sizeRow.maxRPM.toLocaleString()}</div><div class="spec-unit">RPM</div></div>
    <div class="spec-item"><div class="spec-label">Design SF</div><div class="spec-value ${torque?(dsfOk?'ok':'err'):''}">${torque?dsf.toFixed(2):'—'}</div></div>
    <div class="spec-item"><div class="spec-label">Flex Bore</div><div class="spec-value" style="font-size:13px">${sizeRow.flexMinBore} – ${sizeRow.flexMaxBore}</div><div class="spec-unit">in</div></div>
    <div class="spec-item"><div class="spec-label">Rigid Bore</div><div class="spec-value" style="font-size:13px">${sizeRow.rigidMinBore} – ${sizeRow.rigidMaxBore}</div><div class="spec-unit">in</div></div>
  </div>
  <div class="bom-section">
    <div class="bom-title">Bill of Materials</div>
    <table class="bom-table">
      <thead><tr><th>QTY</th><th>Item ID</th><th>Description</th></tr></thead>
      <tbody>`;

  // Flex hubs — always flat individual rows
  if (asm.flexHub) {
    if (isMixed) {
      html += gcBomRow(1, `${asm.flexHub}${smaller ? ' ' + smaller : ''}`, `${asm.flexHubDesc}${smaller ? ' (' + smaller + ' in)' : ''}`);
    } else {
      html += gcBomRow(1, `${asm.flexHub}${s1 ? ' ' + s1 : ''}`, `${asm.flexHubDesc}${s1 ? ' (' + s1 + ' in)' : ''}`);
      html += gcBomRow(1, `${asm.flexHub}${s2 ? ' ' + s2 : ''}`, `${asm.flexHubDesc}${s2 ? ' (' + s2 + ' in)' : ''}`);
    }
  }

  // Rigid hubs — always flat individual rows
  if (asm.rigidHub) {
    if (isMixed) {
      html += gcBomRow(1, `${asm.rigidHub}${larger ? ' ' + larger : ''}`, `${asm.rigidHubDesc}${larger ? ' (' + larger + ' in)' : ''}`);
    } else {
      html += gcBomRow(1, `${asm.rigidHub}${s1 ? ' ' + s1 : ''}`, `${asm.rigidHubDesc}${s1 ? ' (' + s1 + ' in)' : ''}`);
      html += gcBomRow(1, `${asm.rigidHub}${s2 ? ' ' + s2 : ''}`, `${asm.rigidHubDesc}${s2 ? ' (' + s2 + ' in)' : ''}`);
    }
  }

  // Sleeves
  if (asm.sleeve1) html += gcBomRow(asm.sleeve1Qty, asm.sleeve1, asm.sleeve1Desc);
  if (asm.sleeve2) html += gcBomRow(asm.sleeve2Qty, asm.sleeve2, asm.sleeve2Desc);

  // Fastener kit — flat, not indented
  if (asm.fasKit) html += gcBomRow(asm.fasKitQty, asm.fasKit, asm.fasKitDesc);

  html += `</tbody></table></div>`;
  output.innerHTML = html;
}
