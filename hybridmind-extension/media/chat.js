(function () {
  var vsc = acquireVsCodeApi();
  var cfg = window.HM_CONFIG || {};
  var msgs = [], selMods = ['llama-3.3-70b'], wf = 'single', ctx = false;
  var alv = cfg.alv || 3;
  var ro = cfg.ro || false;
  var perms = cfg.perms || { read: true, edit: true, terminal: true, create: true, del: false, multi: true, restructure: false, network: false };
  var agSlots = [];
  var fcActive = false, fcContent = '', fcMode = 'build';
  var fcNodes = [
    { id: 1, type: 'start', label: 'Start' },
    { id: 2, type: 'step',  label: 'Step 1' },
    { id: 3, type: 'end',   label: 'End' }
  ];
  var fcNextId = 4;
  var AG_CATALOG = [
    { id: 'bug-hunter',           label: 'Bug Hunter',        desc: 'Finds & explains bugs in your code' },
    { id: 'code-generator',       label: 'Code Generator',    desc: 'Writes complete, production-ready code' },
    { id: 'refactoring',          label: 'Refactoring',       desc: 'Cleans up and restructures existing code' },
    { id: 'strategic-planner',    label: 'Strategic Planner', desc: 'Breaks complex tasks into step-by-step plans' },
    { id: 'research-synthesizer', label: 'Research Agent',    desc: 'Researches and synthesises technical answers' },
    { id: 'critical-evaluator',   label: 'Evaluator',         desc: 'Critically reviews plans and code for flaws' },
    { id: 'memory-curator',       label: 'Memory Curator',    desc: 'Tracks context across long conversations' },
    { id: 'logic-verifier',       label: 'Logic Verifier',    desc: 'Verifies correctness of logic and algorithms' },
    { id: 'scenario-simulation',  label: 'Scenario Sim',      desc: 'Simulates edge cases and what-if scenarios' },
    { id: 'constraint-solver',    label: 'Constraints',       desc: 'Identifies and resolves constraints in a design' },
    { id: 'documenter',           label: 'Documenter',        desc: 'Writes clear docs, README files, and comments' },
    { id: 'security-auditor',     label: 'Security Auditor',  desc: 'Checks code for security vulnerabilities' },
    { id: 'perf-optimizer',       label: 'Performance Guru',  desc: 'Finds and fixes performance bottlenecks' },
    { id: 'test-writer',          label: 'Test Writer',       desc: 'Generates comprehensive unit and integration tests' }
  ];
  var MAXM = cfg.maxModels || 2, MAXA = cfg.maxAgents || 0, PRO = cfg.isPro || false;
  var WFD = {
    single: 'One model answers directly.',
    parallel: 'Multiple models answer simultaneously.',
    chain: 'Models collaborate sequentially, each building on the previous.',
    agentic: 'Autonomous agent plans and executes multi-step tasks.',
    'all-to-all': 'All models communicate before reaching a final consensus.'
  };

  function g(id) { return document.getElementById(id); }
  function esc(t) { var d = document.createElement('div'); d.textContent = String(t == null ? '' : t); return d.innerHTML; }
  function showErr(e) { var b = g('eb'); if (b) { b.style.display = 'block'; b.textContent = 'ERR: ' + (e && e.message ? e.message : String(e)); } }

  // DIAG
  var diag = g('diag'); if (diag) diag.style.background = 'lime';
  var _cl = 0;
  window.addEventListener('click', function (e) {
    _cl++;
    var dc = g('dc'); if (dc) dc.textContent = _cl;
    var dl = g('dl'); if (dl) dl.textContent = (e.target.id || e.target.className || e.target.tagName || '?').toString().substring(0, 20);
  }, true);
  window.addEventListener('mousedown', function () { var dm = g('dm'); if (dm) dm.textContent = +dm.textContent + 1; }, true);

  try {
    // Tabs
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var n = t.dataset.p;
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x.dataset.p === n); });
        document.querySelectorAll('.panel').forEach(function (x) { x.classList.toggle('on', x.id === 'panel-' + n); });
      });
    });

    // Workflow buttons
    document.querySelectorAll('.wfb').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.wfb').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        wf = b.dataset.wf;
        var wd = g('wfDesc'); if (wd) wd.textContent = WFD[wf] || '';
        var ab = g('autoBlock'); if (ab) ab.style.display = wf === 'agentic' ? 'flex' : 'none';
        var wm = g('wfMini'); if (wm) wm.value = wf;
        vsc.postMessage({ type: 'changeWorkflow', workflow: wf });
      });
    });

    var wfMini = g('wfMini');
    if (wfMini) wfMini.addEventListener('change', function () {
      wf = wfMini.value;
      document.querySelectorAll('.wfb').forEach(function (b) { b.classList.toggle('on', b.dataset.wf === wf); });
      var wd = g('wfDesc'); if (wd) wd.textContent = WFD[wf] || '';
      var ab = g('autoBlock'); if (ab) ab.style.display = wf === 'agentic' ? 'flex' : 'none';
      vsc.postMessage({ type: 'changeWorkflow', workflow: wf });
    });

    // Autonomy options
    document.querySelectorAll('.autoopt').forEach(function (o) {
      o.addEventListener('click', function () {
        document.querySelectorAll('.autoopt').forEach(function (x) { x.classList.remove('on'); });
        o.classList.add('on');
        alv = parseInt(o.dataset.lv || '3', 10);
        vsc.postMessage({ type: 'changeAutonomy', level: alv, permissions: perms });
      });
    });

    // Permission checkboxes
    document.querySelectorAll('.pcb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        perms[cb.dataset.perm] = cb.checked;
        vsc.postMessage({ type: 'changeAutonomy', level: alv, permissions: perms });
      });
    });

    // Read-only toggle
    var roRow = g('roRow'), roSw = g('roSw');
    if (roRow) roRow.addEventListener('click', function () {
      ro = !ro;
      if (roSw) roSw.classList.toggle('on', ro);
      vsc.postMessage({ type: 'toggleReadOnly', readOnly: ro });
    });

    // Model tag management
    function renderTags() {
      var tw = g('tagWrap'); if (!tw) return;
      tw.innerHTML = selMods.map(function (m) {
        return '<span class="tag">' + esc(m) + '<button class="xbtn" data-m="' + esc(m) + '">\u00d7</button></span>';
      }).join('');
      tw.querySelectorAll('.xbtn').forEach(function (b) {
        b.addEventListener('click', function () {
          selMods = selMods.filter(function (x) { return x !== b.dataset.m; });
          renderTags(); updML(); updStats();
          vsc.postMessage({ type: 'changeModels', models: selMods });
        });
      });
      updStats();
    }

    function addMod(m) {
      if (!m) return;
      if (selMods.indexOf(m) >= 0) return;
      if (selMods.length >= MAXM) { vsc.postMessage({ type: 'showWarning', message: 'Limited to ' + MAXM + ' models.' }); return; }
      selMods.push(m); renderTags(); updML();
      vsc.postMessage({ type: 'changeModels', models: selMods });
    }

    function updML() {
      var l = g('amlbl'); if (!l) return;
      l.textContent = selMods.length === 0 ? 'No model' : selMods[0] + (selMods.length > 1 ? ' +' + (selMods.length - 1) : '');
    }

    var fmSel = g('fmSel'), pmSel = g('pmSel');
    if (fmSel) fmSel.addEventListener('change', function () { addMod(fmSel.value); fmSel.value = ''; });
    if (pmSel) pmSel.addEventListener('change', function () { addMod(pmSel.value); pmSel.value = ''; });

    // Agent slots
    function renderAgents() {
      var wrap = g('agSlots'); if (!wrap) return;
      if (agSlots.length === 0) {
        wrap.innerHTML = '<div style="font-size:10px;color:var(--mu);text-align:center;padding:10px 0;">No agents yet.</div>';
      } else {
        wrap.innerHTML = agSlots.map(function (a) {
          return '<div class="agslot"><span class="aglbl">' + esc(a.label) + '</span><button class="agrm" data-id="' + esc(a.id) + '">\u00d7</button></div>';
        }).join('');
        wrap.querySelectorAll('.agrm').forEach(function (b) {
          b.addEventListener('click', function () {
            agSlots = agSlots.filter(function (a) { return a.id !== b.dataset.id; });
            renderAgents(); updStats();
          });
        });
      }
      var cv = g('agCtrVal'); if (cv) cv.textContent = agSlots.length + '/' + MAXA;
      updStats();
    }

    var agAddBtn = g('agAddBtn');
    if (agAddBtn) agAddBtn.addEventListener('click', function () {
      if (agSlots.length >= MAXA) { vsc.postMessage({ type: 'showWarning', message: 'Slot limit reached.' }); return; }
      var picker = g('agPicker');
      if (picker) {
        var isOpen = picker.classList.toggle('open');
        if (isOpen) { renderPickerList(''); var sr = g('agSearch'); if (sr) { sr.value = ''; sr.focus(); } }
      }
    });

    function renderPickerList(filter) {
      var list = g('agList'); if (!list) return;
      var q = (filter || '').toLowerCase();
      var items = AG_CATALOG.filter(function (a) {
        if (agSlots.find(function (s) { return s.id === a.id; })) return false;
        return !q || a.label.toLowerCase().indexOf(q) >= 0 || a.desc.toLowerCase().indexOf(q) >= 0;
      });
      if (items.length === 0) { list.innerHTML = '<div style="padding:8px 9px;font-size:10px;color:var(--mu);">No agents found.</div>'; return; }
      list.innerHTML = items.map(function (a) {
        return '<div class="ag-item" data-id="' + esc(a.id) + '" data-lbl="' + esc(a.label) + '"><div class="ag-lbl">' + esc(a.label) + '</div><div class="ag-desc">' + esc(a.desc) + '</div></div>';
      }).join('');
      list.querySelectorAll('.ag-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var id = item.dataset.id, lbl = item.dataset.lbl;
          if (!id || agSlots.find(function (a) { return a.id === id; })) return;
          if (agSlots.length >= MAXA) { vsc.postMessage({ type: 'showWarning', message: 'Slot limit reached.' }); return; }
          agSlots.push({ id: id, label: lbl, model: 'auto' });
          renderAgents();
          var picker = g('agPicker'); if (picker) picker.classList.remove('open');
        });
      });
    }

    var agSearch = g('agSearch');
    if (agSearch) agSearch.addEventListener('input', function () { renderPickerList(agSearch.value); });

    // Close picker when clicking outside
    document.addEventListener('click', function (e) {
      var picker = g('agPicker'), btn = g('agAddBtn');
      if (picker && picker.classList.contains('open') && !picker.contains(e.target) && e.target !== btn) {
        picker.classList.remove('open');
      }
    });

    // Flowchart
    var fcToggle = g('fcToggle'), fcBody = g('fcBody'), fcChev = g('fcChev');
    if (fcToggle) fcToggle.addEventListener('click', function () {
      if (fcBody) fcBody.classList.toggle('open');
      if (fcChev) fcChev.classList.toggle('open');
    });

    function renderFcBuilder() {
      var list = g('fcNodeList'); if (!list) return;
      var colors = { start: '#10b981', step: '#0b6a76', decision: '#f59e0b', end: '#ef4444' };
      var icons  = { start: '▶', step: '—', decision: '◆', end: '■' };
      list.innerHTML = fcNodes.map(function (n, i) {
        var c = colors[n.type] || '#0b6a76', ic = icons[n.type] || '—';
        return '<div class="fcn">' +
          '<span class="fcn-badge" style="background:' + c + ';">' + ic + '</span>' +
          '<input class="fcn-inp" value="' + esc(n.label) + '" data-id="' + n.id + '" />' +
          (i > 0 ? '<button class="fcn-btn" data-act="up" data-id="' + n.id + '">↑</button>' : '<span class="fcn-ph"></span>') +
          (i < fcNodes.length - 1 ? '<button class="fcn-btn" data-act="dn" data-id="' + n.id + '">↓</button>' : '<span class="fcn-ph"></span>') +
          (n.type !== 'start' ? '<button class="fcn-btn fcn-del" data-act="del" data-id="' + n.id + '">×</button>' : '<span class="fcn-ph"></span>') +
          '</div>';
      }).join('');
      list.querySelectorAll('.fcn-inp').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var node = fcNodes.find(function (x) { return x.id === parseInt(inp.dataset.id); });
          if (node) { node.label = inp.value; renderFcSvg(); }
        });
      });
      list.querySelectorAll('.fcn-btn[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = parseInt(btn.dataset.id), act = btn.dataset.act;
          var idx = fcNodes.findIndex(function (x) { return x.id === id; });
          if (idx < 0) return;
          if (act === 'del') { fcNodes.splice(idx, 1); }
          else if (act === 'up' && idx > 0) { var t = fcNodes[idx]; fcNodes[idx] = fcNodes[idx - 1]; fcNodes[idx - 1] = t; }
          else if (act === 'dn' && idx < fcNodes.length - 1) { var t2 = fcNodes[idx]; fcNodes[idx] = fcNodes[idx + 1]; fcNodes[idx + 1] = t2; }
          renderFcBuilder();
        });
      });
      renderFcSvg();
    }

    function renderFcSvg() {
      var svg = g('fcSvg'); if (!svg) return;
      var W = 240, cx = W / 2, NH = 32, DH = 40, GAP = 18;
      var nodeColors = { start: '#10b981', step: '#0b6a76', decision: '#f59e0b', end: '#ef4444' };
      var ys = [], y = 8;
      fcNodes.forEach(function (n) { ys.push(y); y += (n.type === 'decision' ? DH : NH) + GAP; });
      var totalH = Math.max(y - GAP + 10, 20);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + totalH);
      svg.style.height = totalH + 'px';
      var parts = [
        '<defs><marker id="fcarr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">',
        '<path d="M0,0 L0,6 L8,3 z" fill="rgba(11,106,118,0.55)"/></marker></defs>'
      ];
      for (var i = 0; i < fcNodes.length - 1; i++) {
        var bh = fcNodes[i].type === 'decision' ? DH : NH;
        parts.push('<line x1="' + cx + '" y1="' + (ys[i] + bh) + '" x2="' + cx + '" y2="' + (ys[i + 1] - 1) + '" stroke="#0b6a76" stroke-width="1.5" stroke-opacity="0.45" marker-end="url(#fcarr)"/>');
      }
      fcNodes.forEach(function (n, i) {
        var ny = ys[i], c = nodeColors[n.type] || '#0b6a76';
        var lbl = n.label.length > 22 ? n.label.substring(0, 22) + '…' : n.label;
        var midY = ny + (n.type === 'decision' ? DH : NH) / 2;
        if (n.type === 'decision') {
          parts.push('<polygon points="' + cx + ',' + ny + ' ' + (cx + 112) + ',' + (ny + DH / 2) + ' ' + cx + ',' + (ny + DH) + ' ' + (cx - 112) + ',' + (ny + DH / 2) + '" fill="' + c + '" fill-opacity="0.82" stroke="' + c + '" stroke-width="1" stroke-opacity="0.4"/>');
        } else {
          var rx2 = (n.type === 'start' || n.type === 'end') ? NH / 2 : 5;
          parts.push('<rect x="' + (cx - 100) + '" y="' + ny + '" width="200" height="' + NH + '" rx="' + rx2 + '" fill="' + c + '" fill-opacity="0.82" stroke="' + c + '" stroke-width="1" stroke-opacity="0.4"/>');
        }
        parts.push('<text x="' + cx + '" y="' + (midY + 4) + '" text-anchor="middle" fill="#fff" font-size="10" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="600">' + esc(lbl) + '</text>');
      });
      svg.innerHTML = parts.join('');
    }

    document.querySelectorAll('.fc-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.fc-tab').forEach(function (t) { t.classList.remove('on'); });
        tab.classList.add('on');
        fcMode = tab.dataset.fc || 'build';
        var builderArea = g('fcBuilderArea'), uploadArea = g('fcUploadArea');
        if (builderArea) builderArea.style.display = fcMode === 'build' ? 'flex' : 'none';
        if (uploadArea) uploadArea.style.display = fcMode === 'upload' ? 'flex' : 'none';
      });
    });

    document.querySelectorAll('.fc-addbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.dataset.type || 'step';
        var stepCount = fcNodes.filter(function (n) { return n.type === 'step' || n.type === 'decision'; }).length;
        var defaultLabels = { step: 'Step ' + (stepCount + 1), decision: 'Decision', end: 'End' };
        var newNode = { id: fcNextId++, type: type, label: defaultLabels[type] || type };
        var endIdx = fcNodes.findIndex(function (n) { return n.type === 'end'; });
        if (endIdx >= 0 && type !== 'end') { fcNodes.splice(endIdx, 0, newNode); }
        else { fcNodes.push(newNode); }
        renderFcBuilder();
      });
    });

    renderFcBuilder();

    var fcFileInput = g('fcFileInput');
    if (fcFileInput) fcFileInput.addEventListener('change', function () {
      var file = fcFileInput.files && fcFileInput.files[0];
      var fn = g('fcFileName');
      if (fn) fn.textContent = file ? file.name : 'No file selected';
    });

    var fcApply = g('fcApply');
    if (fcApply) fcApply.addEventListener('click', function () {
      var status = g('fcStatus'), clearBtn = g('fcClear');
      if (fcMode === 'build') {
        if (fcNodes.length === 0) { if (status) { status.style.display = 'block'; status.style.color = 'var(--err)'; status.textContent = 'Add nodes first.'; } return; }
        fcContent = fcNodes.map(function (n, i) {
          var prefix = n.type === 'start' ? 'START' : n.type === 'end' ? 'END' : n.type === 'decision' ? 'DECISION' : 'Step ' + i;
          return prefix + ': ' + n.label;
        }).join('\n');
        fcActive = true;
        if (status) { status.style.display = 'block'; status.style.color = 'var(--ok)'; status.textContent = 'Flowchart active — will guide next messages.'; }
        if (clearBtn) clearBtn.style.display = '';
      } else {
        var file = fcFileInput && fcFileInput.files && fcFileInput.files[0];
        if (!file) { if (status) { status.style.display = 'block'; status.style.color = 'var(--err)'; status.textContent = 'Choose a file first.'; } return; }
        var reader = new FileReader();
        reader.onload = function (e) {
          fcContent = '[Uploaded flowchart: ' + file.name + ']';
          if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
            fcContent = '[Flowchart SVG uploaded: ' + file.name + ']\n' + (e.target.result || '');
          }
          fcActive = true;
          if (status) { status.style.display = 'block'; status.style.color = 'var(--ok)'; status.textContent = 'Flowchart active (' + file.name + ')'; }
          if (clearBtn) clearBtn.style.display = '';
        };
        reader.readAsText(file);
      }
    });

    var fcClear = g('fcClear');
    if (fcClear) fcClear.addEventListener('click', function () {
      fcActive = false; fcContent = '';
      fcNodes = [{ id: 1, type: 'start', label: 'Start' }, { id: 2, type: 'step', label: 'Step 1' }, { id: 3, type: 'end', label: 'End' }];
      fcNextId = 4;
      renderFcBuilder();
      var status = g('fcStatus'); if (status) { status.style.display = 'none'; status.textContent = ''; }
      fcClear.style.display = 'none';
      var fn = g('fcFileName'); if (fn) fn.textContent = 'No file selected';
    });

    var agUpBtn = g('agUpBtn');
    if (agUpBtn) agUpBtn.addEventListener('click', function () { vsc.postMessage({ type: 'openUpgrade' }); });

    var upBtn = g('upBtn');
    if (upBtn) upBtn.addEventListener('click', function () { vsc.postMessage({ type: 'openUpgrade' }); });

    // BYOK
    var byokSave = g('byokSave'), byokVerify = g('byokVerify');
    if (byokSave) byokSave.addEventListener('click', function () {
      vsc.postMessage({ type: 'saveApiKey', provider: g('byokProv').value, key: g('byokKey').value });
    });
    if (byokVerify) byokVerify.addEventListener('click', function () {
      vsc.postMessage({ type: 'verifyApiKey', provider: g('byokProv').value, key: g('byokKey').value });
    });

    var clrBtn = g('clrBtn');
    if (clrBtn) clrBtn.addEventListener('click', function () { vsc.postMessage({ type: 'clearHistory' }); msgs = []; renderMsgs(); });

    var killRalph = g('killRalph');
    if (killRalph) killRalph.addEventListener('click', function () { vsc.postMessage({ type: 'killRalphLoop' }); });

    // Context toggle
    var ctxBtn = g('ctxBtn');
    if (ctxBtn) ctxBtn.addEventListener('click', function () {
      ctx = !ctx;
      ctxBtn.textContent = ctx ? 'Context on' : 'Context off';
      ctxBtn.classList.toggle('on', ctx);
    });

    // Message textarea
    var msgTA = g('msgTA');
    if (msgTA) msgTA.addEventListener('input', function () {
      msgTA.style.height = 'auto';
      msgTA.style.height = Math.min(msgTA.scrollHeight, 120) + 'px';
      var l = (msgTA.value || '').length;
      var cc = g('charcnt');
      if (cc) { cc.textContent = l > 0 ? String(l) : ''; cc.classList.toggle('w', l > 1800); }
    });

    function doSend() {
      var txt = (msgTA ? msgTA.value : '').trim();
      if (!txt) return;
      if (selMods.length === 0) { vsc.postMessage({ type: 'showWarning', message: 'Select at least one model.' }); return; }
      if (agSlots.length > 0) {
        var h = agSlots.map(function (a) { return a.id; }).join(', ');
        txt = '[Agents: ' + h + ']\n\n' + txt;
      }
      if (fcActive && fcContent) {
        txt = '[Flowchart:\n' + fcContent + ']\n\n' + txt;
      }
      vsc.postMessage({ type: 'sendMessage', message: txt, models: selMods, workflow: wf, includeContext: ctx });
      if (msgTA) { msgTA.value = ''; msgTA.style.height = 'auto'; }
      var cc = g('charcnt'); if (cc) cc.textContent = '';
      var sb = g('sendBtn'); if (sb) sb.disabled = true;
    }

    var sendBtn = g('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', doSend);
    if (msgTA) msgTA.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });

    function updStats() {
      var sm = g('stM'), sa = g('stA');
      if (sm) sm.textContent = selMods.length + ' / ' + MAXM;
      if (sa) sa.textContent = agSlots.length + ' / ' + MAXA;
    }

    function updRates() {
      fetch('http://localhost:3000/cost-stats').then(function (r) { return r.json(); }).then(function (data) {
        var s = data.data || {};
        var ce = g('stC'); if (ce) ce.textContent = s.dailyRemaining !== undefined ? '$' + Number(s.dailyRemaining).toFixed(2) : '--';
        var used = s.requestsToday || 0, max = PRO ? 500 : 50, pct = Math.min(100, (used / max) * 100);
        var re = g('stR'), rb = g('stRB');
        if (re) re.textContent = used + ' / ' + max;
        if (rb) { rb.style.width = pct + '%'; rb.className = 'sfill' + (pct > 90 ? ' c' : pct > 70 ? ' w' : ''); }
      }).catch(function () {});
    }

    function renderMsgs() {
      var mc = g('msgs'); if (!mc) return;
      if (msgs.length === 0) {
        mc.innerHTML = [
          '<div class="empty">',
          '<div class="empty-mark"><svg width="20" height="20" viewBox="0 0 20 20" fill="none">',
          '<rect x="2" y="2" width="7" height="7" rx="2" fill="#0b6a76"/>',
          '<rect x="11" y="2" width="7" height="7" rx="2" fill="#0b6a76" opacity=".5"/>',
          '<rect x="2" y="11" width="7" height="7" rx="2" fill="#0b6a76" opacity=".5"/>',
          '<rect x="11" y="11" width="7" height="7" rx="2" fill="#0b6a76"/>',
          '</svg></div>',
          '<div class="empty-title">HybridMind Chat</div>',
          '<div class="empty-sub">Ask anything. Edit files. Plan multi-step tasks.</div>',
          '<div class="chips">',
          '<button class="chip" data-p="Explain the selected code">Explain code</button>',
          '<button class="chip" data-p="Review this code for best practices">Code review</button>',
          '<button class="chip" data-p="Generate unit tests for this function">Write tests</button>',
          '<button class="chip" data-p="How can I optimize this code?">Optimize</button>',
          '<button class="chip" data-p="Find and fix bugs in the selected file">Fix bugs</button>',
          '<button class="chip" data-p="Refactor this code to improve readability">Refactor</button>',
          '</div></div>'
        ].join('');
        mc.querySelectorAll('.chip').forEach(function (c) {
          c.addEventListener('click', function () {
            var p = c.dataset.p || ''; if (msgTA) msgTA.value = p; doSend();
          });
        });
        return;
      }
      mc.innerHTML = msgs.map(function (m) {
        var t = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var rl = m.role === 'user' ? 'You' : (m.model || 'HybridMind');
        var body = esc(String(m.content || '')).replace(/\n/g, '<br>');

        // Assistant responses render as collapsible answer boxes
        if (m.role === 'assistant') {
          // Agent Planner / Agent Summary cards start collapsed to save space
          var isCard = m.model === 'Agent Planner' || m.model === 'Agent Summary';
          var openClass = isCard ? '' : ' open';
          return '<div class="ans-box' + openClass + '">'
            + '<div class="ans-hdr">'
            + '<div class="ans-meta"><span class="ans-dot"></span><span>' + esc(rl) + '</span>'
            + (m.model ? '<span class="ans-badge">' + esc(m.model) + '</span>' : '') + '</div>'
            + '<div class="ans-right"><span class="ans-time">' + esc(t) + '</span><span class="ans-chevron">&#9660;</span></div>'
            + '</div>'
            + '<div class="ans-body">' + body + '</div>'
            + '<div class="ans-footer"><button class="btn btn-sm insBtn">Insert</button><button class="btn btn-sm cpyBtn">Copy</button></div>'
            + '</div>';
        }

        // System messages → compact single-line status
        if (m.role === 'system') {
          var c = m.content || '';
          var slCls = c.startsWith('[running]') ? 'sl-run'
                    : c.startsWith('Success:') ? 'sl-ok'
                    : c.startsWith('Error:') ? 'sl-err'
                    : 'sl-sys';
          return '<div class="status-line ' + slCls + '"><span class="sdot"></span><span class="stxt">' + esc(c) + '</span></div>';
        }

        // User messages stay as flat bubbles
        return '<div class="msg ' + esc(m.role || 'assistant') + '">'
          + '<div class="mhdr"><div class="mrole"><span class="rdot2"></span><span>' + esc(rl) + '</span></div>'
          + '<span class="mtime">' + esc(t) + '</span></div>'
          + '<div class="mbody">' + body + '</div></div>';
      }).join('');
      mc.scrollTop = mc.scrollHeight;
      var sb = g('sendBtn'); if (sb) sb.disabled = false;

      // Collapsible toggle
      mc.querySelectorAll('.ans-hdr').forEach(function (hdr) {
        hdr.addEventListener('click', function () {
          var box = hdr.parentElement;
          if (box) box.classList.toggle('open');
        });
      });

      var am = msgs.filter(function (m) { return m.role === 'assistant'; });
      mc.querySelectorAll('.insBtn').forEach(function (b, i) {
        b.addEventListener('click', function (e) { e.stopPropagation(); if (am[i]) vsc.postMessage({ type: 'insertCode', code: am[i].content }); });
      });
      mc.querySelectorAll('.cpyBtn').forEach(function (b, i) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (am[i] && navigator.clipboard) navigator.clipboard.writeText(am[i].content).catch(function () {});
        });
      });
    }

    // VSCode message handler
    window.addEventListener('message', function (ev) {
      var m = ev.data; if (!m || !m.type) return;
      switch (m.type) {
        case 'updateMessages':
          msgs = m.messages || []; renderMsgs();
          var sb = g('sendBtn'); if (sb) sb.disabled = false;
          break;
        case 'byokStatus': {
          var el = g('byokStat');
          if (el) { el.textContent = m.message || ''; el.className = 'bstat' + (m.status === 'error' ? ' er' : (m.status === 'verified' || m.status === 'saved') ? ' ok' : ''); }
          break;
        }
        case 'agentAdded': {
          if (!m.id) break;
          if (agSlots.length >= MAXA) break;
          if (agSlots.find(function (a) { return a.id === m.id; })) break;
          agSlots.push({ id: m.id, label: m.label || m.id, model: 'auto' });
          renderAgents();
          break;
        }
        case 'tierUpdate': {
          var pill = document.querySelector('.tier-pill');
          if (pill) {
            if (m.isProPlus) { pill.className = 'tier-pill pro-plus'; pill.textContent = 'PRO PLUS'; }
            else if (m.isPro) { pill.className = 'tier-pill pro'; pill.textContent = 'PRO'; }
            else { pill.className = 'tier-pill free'; pill.textContent = 'FREE'; }
          }
          var ps = g('pmSel'); if (ps) ps.disabled = !m.isPro;
          // Update runtime caps so they stay in sync after async license verification
          if (typeof m.maxAgents === 'number') MAXA = m.maxAgents;
          if (typeof m.maxModels === 'number') MAXM = m.maxModels;
          PRO = !!m.isPro;
          // If agents panel is still showing the free-tier banner, swap it to the Pro UI
          var agPanel = g('panel-agents');
          if (agPanel && MAXA > 0 && !g('agAddBtn')) {
            agPanel.innerHTML =
              '<div class="agctr"><span class="agctrlbl">Active agents</span>' +
              '<span class="agctrval" id="agCtrVal">0 / ' + MAXA + '</span></div>' +
              '<div id="agSlots" class="agslots"></div>' +
              '<button class="btn btn-t btn-full" id="agAddBtn" style="margin-top:4px;">+ Add Agent</button>' +
              '<div id="agPicker" class="ag-picker">' +
              '<input class="ag-search" id="agSearch" placeholder="Filter agents..." autocomplete="off" />' +
              '<div id="agList" class="ag-list"></div></div>' +
              '<div class="fc-sep"></div>' +
              '<div class="fc-hdr" id="fcToggle"><span class="fc-title">Flowchart</span><span class="fc-chev" id="fcChev">&#9662;</span></div>' +
              '<div id="fcBody" class="fc-body">' +
              '<div class="fc-tabs"><button class="fc-tab on" data-fc="build">Build Steps</button><button class="fc-tab" data-fc="upload">Upload Image</button></div>' +
              '<div id="fcBuilderArea" style="display:flex;flex-direction:column;gap:4px;">' +
              '<div id="fcNodeList" class="fc-nodes"></div>' +
              '<div class="fc-add-row"><button class="fc-addbtn" data-type="step">+ Step</button><button class="fc-addbtn" data-type="decision">&#9670; Decision</button><button class="fc-addbtn" data-type="end">&#9632; End</button></div>' +
              '<div class="fc-svg-wrap"><svg id="fcSvg" style="width:100%;display:block;"></svg></div>' +
              '</div>' +
              '<div id="fcUploadArea" style="display:none;flex-direction:column;gap:5px;align-items:center;"><label class="btn btn-full" style="cursor:pointer;justify-content:center;">Choose Image / SVG<input type="file" id="fcFileInput" accept="image/*,.svg" style="display:none;"/></label><div id="fcFileName" style="font-size:10px;color:var(--mu);text-align:center;">No file selected</div></div>' +
              '<div style="display:flex;gap:5px;"><button class="btn btn-t btn-sm" id="fcApply" style="flex:1;">Apply</button><button class="btn btn-sm" id="fcClear" style="flex:1;display:none;">Clear</button></div>' +
              '<div id="fcStatus" style="font-size:10px;color:var(--ok);display:none;text-align:center;padding:2px 0;"></div></div>';
            var newAddBtn = g('agAddBtn');
            if (newAddBtn) newAddBtn.addEventListener('click', function () {
              if (agSlots.length >= MAXA) { vsc.postMessage({ type: 'showWarning', message: 'Slot limit reached.' }); return; }
              var picker = g('agPicker');
              if (picker) {
                var isOpen = picker.classList.toggle('open');
                if (isOpen) { renderPickerList(''); var sr = g('agSearch'); if (sr) { sr.value = ''; sr.focus(); } }
              }
            });
            var newSearch = g('agSearch');
            if (newSearch) newSearch.addEventListener('input', function () { renderPickerList(newSearch.value); });
            // Flowchart controls
            var ft = g('fcToggle'), fb = g('fcBody'), fc2 = g('fcChev');
            if (ft) ft.addEventListener('click', function () { if (fb) fb.classList.toggle('open'); if (fc2) fc2.classList.toggle('open'); });
            document.querySelectorAll('.fc-tab').forEach(function (tab) {
              tab.addEventListener('click', function () {
                document.querySelectorAll('.fc-tab').forEach(function (t) { t.classList.remove('on'); });
                tab.classList.add('on'); fcMode = tab.dataset.fc || 'build';
                var steps = g('fcSteps'), uploadArea = g('fcUploadArea');
                if (steps) steps.style.display = fcMode === 'build' ? 'block' : 'none';
                if (uploadArea) uploadArea.style.display = fcMode === 'upload' ? 'flex' : 'none';
              });
            });
            var fa = g('fcApply'); if (fa) fa.addEventListener('click', function () {
              if (fcMode === 'build') {
                if (!fcNodes.length) return;
                fcContent = fcNodes.map(function (n, i) { var p = n.type === 'start' ? 'START' : n.type === 'end' ? 'END' : n.type === 'decision' ? 'DECISION' : 'Step ' + i; return p + ': ' + n.label; }).join('\n');
                fcActive = true;
                var st = g('fcStatus'); if (st) { st.style.display = 'block'; st.textContent = 'Flowchart active.'; st.style.color = 'var(--ok)'; }
                var cl = g('fcClear'); if (cl) cl.style.display = '';
              }
            });
            var fcc = g('fcClear'); if (fcc) fcc.addEventListener('click', function () {
              fcActive = false; fcContent = '';
              fcNodes = [{ id: 1, type: 'start', label: 'Start' }, { id: 2, type: 'step', label: 'Step 1' }, { id: 3, type: 'end', label: 'End' }]; fcNextId = 4;
              renderFcBuilder(); fcc.style.display = 'none';
              var st = g('fcStatus'); if (st) st.style.display = 'none';
            });
            document.querySelectorAll('.fc-tab').forEach(function (tab) {
              tab.addEventListener('click', function () {
                document.querySelectorAll('.fc-tab').forEach(function (t) { t.classList.remove('on'); });
                tab.classList.add('on'); fcMode = tab.dataset.fc || 'build';
                var ba = g('fcBuilderArea'), ua = g('fcUploadArea');
                if (ba) ba.style.display = fcMode === 'build' ? 'flex' : 'none';
                if (ua) ua.style.display = fcMode === 'upload' ? 'flex' : 'none';
              });
            });
            document.querySelectorAll('.fc-addbtn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var type = btn.dataset.type || 'step';
                var sc = fcNodes.filter(function (n) { return n.type === 'step' || n.type === 'decision'; }).length;
                var dl = { step: 'Step ' + (sc + 1), decision: 'Decision', end: 'End' };
                var nn = { id: fcNextId++, type: type, label: dl[type] || type };
                var ei = fcNodes.findIndex(function (n) { return n.type === 'end'; });
                if (ei >= 0 && type !== 'end') { fcNodes.splice(ei, 0, nn); } else { fcNodes.push(nn); }
                renderFcBuilder();
              });
            });
            renderFcBuilder();
            renderAgents();
          }
          // Refresh stats counters to reflect new limits
          updStats();
          break;
        }
        case 'telemetryState': {
          var rp = g('ralphPanel'); if (rp) rp.style.display = m.active ? 'block' : 'none';
          break;
        }
        case 'telemetryEvent': {
          var ev2 = m.event || {};
          var tx = 'Attempt ' + (ev2.attempt || '?') + ': ' + (ev2.message || '');
          var rrs = g('ralphRows');
          if (rrs) {
            var row = document.createElement('div'); row.className = 'rrow';
            var sc = ev2.status === 'green' ? 'ok' : ev2.status === 'red' ? 'e' : 'w';
            row.innerHTML = '<span class="rdot ' + sc + '"></span><span>' + esc(tx) + '</span>';
            rrs.appendChild(row);
          }
          var rp2 = g('ralphPanel'); if (rp2) rp2.style.display = 'block';
          break;
        }
        case 'telemetryClear': {
          var rr = g('ralphRows'); if (rr) rr.innerHTML = '';
          break;
        }
      }
    });

    renderTags(); updML(); renderAgents(); updStats(); renderMsgs(); updRates();
    setInterval(updRates, 30000);

    // Signal init success in DIAG
    var dlx = g('dl'); if (dlx) dlx.textContent = 'INIT-OK';

  } catch (e) {
    showErr(e);
  }
}());
