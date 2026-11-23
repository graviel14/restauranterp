/* Stock Variance view — Excel rightmost table formulas:
   SUB TOTAL (U) = (STOCK SO + GR TF + GR PO/WMS DC - GI TF - WASTE) - SOLD
   VALUE     (V) = -(SUB TOTAL - STOCK CLOSING)
   Manual inputs: STOCK SO and STOCK CLOSING
   Auto-filled:   GR TF, GR PO / WMS DC, GI TF, WASTE, SOLD
   Export:        PDF (via PDFDoc.variance) + CSV
*/
(function () {
  'use strict';
  var root, fromDate, toDate;
  var manualSo = {};
  var manualClosing = {};

  function dayStr(offset) { return Store.dateKey(Date.now() - offset * 86400000); }

  function computeRows() {
    var s = Store.get();
    var agg = {};
    s.products.forEach(function (p) {
      agg[p.id] = {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        grTf: 0,
        grPoWms: 0,
        giTf: 0,
        waste: 0,
        sold: 0,
        currentStock: p.stock
      };
    });

    s.movements.forEach(function (m) {
      var d = Store.dateKey(m.ts);
      if (d < fromDate || d > toDate) return;
      var row = agg[m.productId];
      if (!row) return;
      var absQ = Math.abs(Number(m.qty) || 0);
      if (m.type === 'receive') {
        if (m.subType === 'gr_tf') row.grTf += absQ;
        else row.grPoWms += absQ;
      } else if (m.type === 'issue') {
        row.giTf += absQ;
      } else if (m.type === 'waste') {
        row.waste += absQ;
      } else if (m.type === 'sale') {
        row.sold += absQ;
      } else if (m.type === 'sale-void') {
        row.sold = Math.max(0, row.sold - absQ);
      }
    });

    return s.products.map(function (p) {
      var a = agg[p.id];
      var soVal = manualSo[p.id] !== undefined && manualSo[p.id] !== '' ? Number(manualSo[p.id]) : 0;
      var closeVal = manualClosing[p.id] !== undefined && manualClosing[p.id] !== '' ? Number(manualClosing[p.id]) : Number(p.stock) || 0;
      // Excel formula U: =SUM(N2+O2+P2-Q2-R2)-S2
      var subTotal = Math.round(((soVal + a.grTf + a.grPoWms - a.giTf - a.waste) - a.sold) * 10000) / 10000;
      // Excel formula V: =-SUM(U2-T2)
      var value = Math.round((-(subTotal - closeVal)) * 10000) / 10000;
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        stockSo: soVal,
        grTf: Math.round(a.grTf * 10000) / 10000,
        grPoWms: Math.round(a.grPoWms * 10000) / 10000,
        giTf: Math.round(a.giTf * 10000) / 10000,
        waste: Math.round(a.waste * 10000) / 10000,
        sold: Math.round(a.sold * 10000) / 10000,
        stockClosing: closeVal,
        subTotal: subTotal,
        value: value
      };
    });
  }

  function paint() {
    var rows = computeRows();
    var totalVar = rows.reduce(function (acc, r) { return acc + (r.value !== 0 ? 1 : 0); }, 0);

    root.querySelector('#var-tbody').innerHTML = rows.map(function (r) {
      var soInputVal = manualSo[r.productId] !== undefined ? manualSo[r.productId] : '';
      var clInputVal = manualClosing[r.productId] !== undefined ? manualClosing[r.productId] : r.stockClosing;
      var vCls = r.value > 0 ? 'pos' : (r.value < 0 ? 'neg' : 'muted');
      return '<tr data-pid="' + r.productId + '">' +
        '<td><b>' + UI.esc(r.name) + '</b></td>' +
        '<td>' + UI.esc(r.unit) + '</td>' +
        '<td><input type="number" step="any" class="var-so" data-pid="' + r.productId + '" value="' + UI.esc(soInputVal) + '" placeholder="0" style="width:92px"></td>' +
        '<td class="r">' + UI.num(r.grTf) + '</td>' +
        '<td class="r">' + UI.num(r.grPoWms) + '</td>' +
        '<td class="r neg">' + UI.num(r.giTf) + '</td>' +
        '<td class="r neg">' + UI.num(r.waste) + '</td>' +
        '<td class="r neg">' + UI.num(r.sold) + '</td>' +
        '<td><input type="number" step="any" class="var-cl" data-pid="' + r.productId + '" value="' + UI.esc(clInputVal) + '" placeholder="0" style="width:98px"></td>' +
        '<td class="r"><b class="var-sub">' + UI.num(r.subTotal) + '</b></td>' +
        '<td class="r ' + vCls + '"><b class="var-val">' + (r.value > 0 ? '+' : '') + UI.num(r.value) + '</b></td>' +
        '</tr>';
    }).join('');

    root.querySelector('#var-summary').textContent = rows.length + ' materials · ' + totalVar + ' with non-zero variance';
  }

  function exportPdf(mode) {
    var rows = computeRows();
    PDFDoc.variance({ from: fromDate, to: toDate, rows: rows }, mode);
  }

  function exportCsv() {
    var rows = computeRows();
    var out = [['NAME MATERIAL', 'UoM', 'STOCK SO', 'GR TF', 'GR PO / WMS DC', 'GI TF', 'WASTE', 'SOLD', 'STOCK CLOSING', 'SUB TOTAL', 'VALUE']];
    rows.forEach(function (r) {
      out.push([r.name, r.unit, r.stockSo, r.grTf, r.grPoWms, r.giTf, r.waste, r.sold, r.stockClosing, r.subTotal, r.value]);
    });
    UI.download('stock-variance-' + fromDate + '_to_' + toDate + '.csv', UI.csv(out), 'text/csv;charset=utf-8');
    UI.toast('Stock Variance CSV exported', 'ok');
  }

  window.Views = window.Views || {};
  window.Views.variance = {
    title: 'Stock Variance',
    sub: 'Manual Stock SO & Stock Closing; auto-calculated GR TF, GR PO/WMS DC, GI TF, Waste, Sold, Sub Total & Value',
    render: function (r) {
      root = r;
      fromDate = dayStr(6);
      toDate = UI.today();
      root.innerHTML =
        '<div class="card" style="margin-bottom:14px">' +
        '<div class="row sp" style="margin-bottom:10px">' +
        '<div class="row">' +
        '<div><label class="f">From Date</label><input type="date" id="var-from" value="' + fromDate + '" style="width:auto"></div>' +
        '<div><label class="f">To Date</label><input type="date" id="var-to" value="' + toDate + '" style="width:auto"></div>' +
        '<button class="btn ghost sm" id="var-today" style="align-self:flex-end">Today</button>' +
        '<button class="btn ghost sm" id="var-7d" style="align-self:flex-end">Last 7 days</button>' +
        '</div>' +
        '<div class="row" style="align-self:flex-end">' +
        '<button class="btn" id="var-csv">⬇ CSV</button>' +
        '<button class="btn primary" id="var-pdf">⬇ Export PDF</button>' +
        '<button class="btn ghost" id="var-print">🖨 Print</button>' +
        '</div></div>' +
        '<div class="note"><b>Excel Formulas:</b> <code>SUB TOTAL = (STOCK SO + GR TF + GR PO/WMS DC - GI TF - WASTE) - SOLD</code> &nbsp;|&nbsp; <code>VALUE = -(SUB TOTAL - STOCK CLOSING)</code>. Enter <b>Stock SO</b> and <b>Stock Closing</b> manually; movements are pulled automatically from transactions.</div>' +
        '</div>' +
        '<div class="card">' +
        '<div class="row sp" style="margin-bottom:8px"><h3 style="margin:0">Material Stock Variance Table</h3><span class="muted" id="var-summary"></span></div>' +
        '<div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr>' +
        '<th>Name Material</th><th>UoM</th><th>Stock SO *</th><th class="r">GR TF</th><th class="r">GR PO / WMS DC</th>' +
        '<th class="r">GI TF</th><th class="r">Waste</th><th class="r">Sold</th><th>Stock Closing *</th>' +
        '<th class="r">Sub Total</th><th class="r">Value</th>' +
        '</tr></thead>' +
        '<tbody id="var-tbody"></tbody>' +
        '</table></div></div>';

      paint();

      root.addEventListener('input', function (e) {
        if (e.target.classList.contains('var-so')) {
          manualSo[e.target.getAttribute('data-pid')] = e.target.value;
          paint();
        } else if (e.target.classList.contains('var-cl')) {
          manualClosing[e.target.getAttribute('data-pid')] = e.target.value;
          paint();
        }
      });

      root.addEventListener('change', function (e) {
        if (e.target.id === 'var-from') { fromDate = e.target.value || fromDate; paint(); }
        if (e.target.id === 'var-to') { toDate = e.target.value || toDate; paint(); }
      });

      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.id === 'var-today') { fromDate = UI.today(); toDate = UI.today(); root.querySelector('#var-from').value = fromDate; root.querySelector('#var-to').value = toDate; paint(); }
        else if (t.id === 'var-7d') { fromDate = dayStr(6); toDate = UI.today(); root.querySelector('#var-from').value = fromDate; root.querySelector('#var-to').value = toDate; paint(); }
        else if (t.id === 'var-pdf') exportPdf('download');
        else if (t.id === 'var-print') exportPdf('print');
        else if (t.id === 'var-csv') exportCsv();
      });
    },
    onStore: function () { if (root) paint(); }
  };
})();
