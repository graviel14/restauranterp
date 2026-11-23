(function () {
  'use strict';
  var root, editor, viewDate;
  var REASONS = ['Expired', 'Spoiled / Damaged', 'Cooking Error', 'Spilled / Dropped', 'Production Leftover', 'Sample / Tester', 'Other'];

  function paintDay() {
    var list = Store.get().waste.filter(function (w) { return w.date === viewDate; });
    var agg = {};
    list.forEach(function (w) { var k = w.productId; agg[k] = agg[k] || { name: w.name, unit: w.unit, qty: 0 }; agg[k].qty += w.qty; });
    root.querySelector('#ws-sum').innerHTML = Object.keys(agg).length ?
      '<div class="chips">' + Object.keys(agg).map(function (k) { return '<span class="chip">' + UI.esc(agg[k].name) + ': <b>' + UI.num(agg[k].qty) + ' ' + agg[k].unit + '</b></span>'; }).join('') + '</div>' : '';
    root.querySelector('#ws-hist').innerHTML = list.length ? list.slice().reverse().map(function (w) {
      return '<tr><td class="muted">' + UI.time(w.createdAt) + '</td><td>' + UI.esc(w.name) + '</td><td class="r neg">' + UI.num(w.qty) + ' ' + w.unit + '</td><td>' + UI.esc(w.reason) + '</td><td class="muted">' + UI.esc(w.officer || '-') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No waste logged on this date</td></tr>';
  }

  function save() {
    var lines = editor.getLines();
    if (!lines.length) { UI.toast('Enter at least one material with quantity', 'warn'); return; }
    var date = root.querySelector('#ws-date').value || UI.today();
    Store.addWaste(date, lines, root.querySelector('#ws-officer').value.trim());
    UI.toast(lines.length + ' waste record(s) saved, stock deducted', 'ok');
    editor.reset();
    viewDate = date; root.querySelector('#ws-view').value = date;
    paintDay();
  }

  window.Views = window.Views || {};
  window.Views.waste = {
    title: 'Daily Waste', sub: 'Record discarded materials per day — automatically deducts stock',
    render: function (r) {
      root = r; viewDate = UI.today();
      root.innerHTML =
        '<div class="card"><h3>Log Waste</h3><div class="fgrid"><div class="fg"><label class="f">Date</label><input type="date" id="ws-date" value="' + viewDate + '"></div>' +
        '<div class="fg"><label class="f">Officer</label><input id="ws-officer" placeholder="Officer name"></div></div>' +
        '<div id="ws-lines" class="fg"></div><button class="btn primary" id="ws-save">Save Waste</button></div>' +
        '<div class="card" style="margin-top:14px"><div class="row sp" style="margin-bottom:10px"><h3 style="margin:0">Waste Log</h3><input type="date" id="ws-view" value="' + viewDate + '" style="width:auto"></div>' +
        '<div id="ws-sum" style="margin-bottom:10px"></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Material</th><th class="r">Qty</th><th>Reason</th><th>Officer</th></tr></thead><tbody id="ws-hist"></tbody></table></div></div>';
      editor = UI.lineEditor(root.querySelector('#ws-lines'), { showStock: true, extra: { label: 'Reason', options: REASONS } });
      paintDay();
      root.addEventListener('click', function (e) { if (e.target.id === 'ws-save') save(); });
      root.addEventListener('change', function (e) { if (e.target.id === 'ws-view') { viewDate = e.target.value || UI.today(); paintDay(); } });
    }
  };
})();
