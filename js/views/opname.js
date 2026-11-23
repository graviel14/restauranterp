(function () {
  'use strict';
  var root, tab = 'daily', showAll = false;
  var TYPES = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  var MOVE = { sale: 'Sale (BOM)', 'sale-void': 'Void Sale', receive: 'Goods Receive', issue: 'Goods Issue', opname: 'Stock Count', waste: 'Waste' };

  function scope(type) {
    var all = Store.get().products;
    if (showAll || type === 'monthly') return all;
    // Daily count uses the same material list as the weekly count
    return all.filter(function (p) { return p.cycle === 'daily' || p.cycle === 'weekly'; });
  }

  function tabsHtml() {
    var t = [['daily', 'Daily Count'], ['weekly', 'Weekly Count'], ['monthly', 'Monthly Count'], ['history', 'History']];
    return '<div class="tabs">' + t.map(function (x) { return '<button class="tab ' + (tab === x[0] ? 'on' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }

  function opnameForm(type) {
    var prods = scope(type);
    var note = type === 'daily' ? 'Daily count uses the same material list as the weekly count.' :
      type === 'weekly' ? 'Count dry goods, coatings, sauces & fast-moving materials weekly.' : 'Full physical count at month-end. Supports CSV import.';
    return '<div class="card"><div class="row sp" style="margin-bottom:12px"><div><h3 style="margin:0">' + TYPES[type] + ' Stock Count</h3><div class="muted" style="font-size:12.5px">' + note + '</div></div>' +
      '<div class="row">' + (type !== 'monthly' ? '<label class="row" style="gap:6px"><input type="checkbox" id="stk-all" style="width:auto" ' + (showAll ? 'checked' : '') + '> all materials</label>' : '') +
      '<button class="btn sm" id="stk-tpl">⬇ CSV Template</button><button class="btn sm" id="stk-imp">⬆ Import CSV</button><input type="file" id="stk-file" accept=".csv,text/csv" style="display:none"></div></div>' +
      '<div class="fgrid" style="margin-bottom:12px"><div><label class="f">Date</label><input type="date" id="stk-date" value="' + UI.today() + '"></div><div><label class="f">Manager on duty</label><input id="stk-officer" placeholder="Manager name"></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Material</th><th class="r">System Stock</th><th style="width:140px">Physical Stock</th><th class="r">Variance</th></tr></thead><tbody>' +
      (prods.length ? prods.map(function (p) {
        return '<tr data-pid="' + p.id + '" data-sys="' + p.stock + '"><td>' + UI.esc(p.name) + '</td><td class="r">' + UI.num(p.stock) + ' ' + p.unit + '</td>' +
          '<td><input type="number" step="any" min="0" class="phys" placeholder="—"></td><td class="r diff muted">-</td></tr>';
      }).join('') : '<tr><td colspan="4" class="empty">No materials scheduled for ' + TYPES[type].toLowerCase() + ' count.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="fg" style="margin-top:12px"><label class="f">Notes</label><input id="stk-note" placeholder="Optional"></div>' +
      '<div class="row sp"><span class="muted" id="stk-sum"></span><button class="btn primary" id="stk-save">Save Stock Count</button></div></div>';
  }

  function recalc() {
    var counted = 0, diffs = 0;
    Array.prototype.forEach.call(root.querySelectorAll('tr[data-pid]'), function (tr) {
      var v = tr.querySelector('.phys').value, cell = tr.querySelector('.diff');
      if (v === '') { cell.textContent = '-'; cell.className = 'r diff muted'; return; }
      var d = Math.round((parseFloat(v) - parseFloat(tr.getAttribute('data-sys'))) * 10000) / 10000;
      counted++; if (d !== 0) diffs++;
      cell.textContent = (d > 0 ? '+' : '') + UI.num(d);
      cell.className = 'r diff ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'muted');
    });
    var sum = root.querySelector('#stk-sum');
    if (sum) sum.textContent = counted + ' counted · ' + diffs + ' variances';
  }

  function saveOpname() {
    var lines = [];
    Array.prototype.forEach.call(root.querySelectorAll('tr[data-pid]'), function (tr) {
      var v = tr.querySelector('.phys').value;
      if (v !== '') lines.push({ productId: tr.getAttribute('data-pid'), physical: parseFloat(v) });
    });
    if (!lines.length) { UI.toast('Enter at least one physical stock value', 'warn'); return; }
    var diffs = root.querySelectorAll('.diff.pos,.diff.neg').length;
    UI.confirm('Save ' + TYPES[tab].toLowerCase() + ' count',
      lines.length + ' materials counted, ' + diffs + ' variances. System stock will be adjusted to physical stock. Continue?', 'Save', function () {
        var doc = Store.saveOpname(tab, root.querySelector('#stk-date').value || UI.today(), lines, root.querySelector('#stk-note').value, root.querySelector('#stk-officer').value);
        UI.toast('Stock count ' + doc.no + ' saved', 'ok');
        paint();
      });
  }

  function templateCsv() {
    var rows = [['material', 'uom', 'system_stock', 'physical_stock']];
    scope(tab).forEach(function (p) { rows.push([p.name, p.unit, p.stock, '']); });
    UI.download('stock-count-' + tab + '.csv', UI.csv(rows), 'text/csv;charset=utf-8');
  }

  function importCsv(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var rows = UI.parseCsv(String(rd.result));
      if (rows.length < 2) { UI.toast('CSV file is empty', 'err'); return; }
      var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      var iName = head.indexOf('material'); if (iName < 0) iName = 0;
      var iQty = -1;
      ['physical_stock', 'stok_fisik', 'physical', 'qty'].forEach(function (k) { if (iQty < 0) iQty = head.indexOf(k); });
      if (iQty < 0) iQty = head.length - 1;
      var map = {};
      rows.slice(1).forEach(function (r) {
        var v = parseFloat(String(r[iQty] || '').replace(',', '.'));
        if (r[iName] && !isNaN(v)) map[r[iName].trim().toLowerCase()] = v;
      });
      var n = 0;
      Array.prototype.forEach.call(root.querySelectorAll('tr[data-pid]'), function (tr) {
        var p = Store.product(tr.getAttribute('data-pid'));
        var key = p.name.toLowerCase();
        if (map[key] !== undefined) { tr.querySelector('.phys').value = map[key]; n++; }
      });
      recalc();
      UI.toast(n + ' rows populated from CSV', 'ok');
    };
    rd.readAsText(file);
  }

  function historyTab() {
    var s = Store.get();
    var ops = s.opnames.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 20);
    var mv = s.movements.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 60);
    return '<div class="card" style="margin-bottom:14px"><h3>Stock Count History</h3>' + (ops.length ? '<table class="tbl"><thead><tr><th>No</th><th>Type</th><th>Date</th><th>Manager on duty</th><th class="r">Items</th><th class="r">Variances</th><th></th></tr></thead><tbody>' +
      ops.map(function (o) {
        var d = o.lines.filter(function (l) { return l.diff !== 0; }).length;
        return '<tr><td><b>' + o.no + '</b></td><td>' + TYPES[o.type] + '</td><td>' + UI.dateLabel(o.date) + '</td><td>' + UI.esc(o.officer || '-') + '</td><td class="r">' + o.lines.length + '</td><td class="r ' + (d ? 'neg' : '') + '">' + d + '</td>' +
          '<td class="row"><button class="btn sm" data-view="' + o.id + '">Details</button><button class="btn sm" data-pdf="' + o.id + '">PDF</button></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">No stock counts yet</div>') + '</div>' +
      '<div class="card"><h3>Recent Stock Movements</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Material</th><th>Type</th><th class="r">Change</th><th class="r">Balance</th><th>Reference</th></tr></thead><tbody>' +
      (mv.map(function (m) {
        var p = Store.product(m.productId);
        return '<tr><td class="muted">' + UI.dateTime(m.ts) + '</td><td>' + UI.esc(p ? p.name : m.productId) + '</td><td>' + (MOVE[m.type] || m.type) + '</td><td class="r ' + (m.qty < 0 ? 'neg' : 'pos') + '">' + (m.qty > 0 ? '+' : '') + UI.num(m.qty) + '</td><td class="r">' + UI.num(m.balance) + '</td><td class="muted">' + UI.esc(m.ref) + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="empty">No movements yet</td></tr>') + '</tbody></table></div></div>';
  }

  function viewOpname(id) {
    var o = Store.get().opnames.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    UI.modal({
      title: o.no + ' — ' + TYPES[o.type] + ' Count', wide: true,
      body: '<table class="tbl"><thead><tr><th>Material</th><th class="r">System</th><th class="r">Physical</th><th class="r">Variance</th></tr></thead><tbody>' +
        o.lines.map(function (l) { return '<tr><td>' + UI.esc(l.name) + '</td><td class="r">' + UI.num(l.system) + ' ' + l.unit + '</td><td class="r">' + UI.num(l.physical) + '</td><td class="r ' + (l.diff < 0 ? 'neg' : l.diff > 0 ? 'pos' : 'muted') + '">' + (l.diff > 0 ? '+' : '') + UI.num(l.diff) + '</td></tr>'; }).join('') + '</tbody></table>',
      actions: [{ label: 'Close' }, { label: 'Download PDF', kind: 'primary', onClick: function () { PDFDoc.opname(o, 'download'); return false; } }]
    });
  }

  function paint() {
    var body;
    if (tab === 'history') body = historyTab();
    else body = opnameForm(tab);
    root.innerHTML = tabsHtml() + body;
    if (TYPES[tab]) recalc();
  }

  window.Views = window.Views || {};
  window.Views.opname = {
    title: 'Stock Opname', sub: 'Daily, weekly, and monthly physical stock counts & count history',
    render: function (r) {
      root = r; tab = 'daily'; showAll = false; paint();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); paint(); }
        else if (t.id === 'stk-save') saveOpname();
        else if (t.id === 'stk-tpl') templateCsv();
        else if (t.id === 'stk-imp') root.querySelector('#stk-file').click();
        else if (t.hasAttribute('data-view')) viewOpname(t.getAttribute('data-view'));
        else if (t.hasAttribute('data-pdf')) PDFDoc.opname(Store.get().opnames.filter(function (x) { return x.id === t.getAttribute('data-pdf'); })[0], 'download');
      });
      root.addEventListener('input', function (e) { if (e.target.classList.contains('phys')) recalc(); });
      root.addEventListener('change', function (e) {
        if (e.target.id === 'stk-all') { showAll = e.target.checked; paint(); }
        if (e.target.id === 'stk-file' && e.target.files[0]) { importCsv(e.target.files[0]); e.target.value = ''; }
      });
    },
    onStore: function () { if (root && tab === 'history') paint(); }
  };
})();
