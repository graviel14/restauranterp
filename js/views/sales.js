(function () {
  'use strict';
  var root, from, to, ch = 'all', incCancel = false;
  var PAY = { cash: 'Cash', qris: 'QRIS', edc: 'EDC', xendit: 'Xendit', online: 'Online' };

  function dayStr(offset) { return Store.dateKey(Date.now() - offset * 86400000); }

  function data() {
    return Store.get().orders.filter(function (o) {
      var d = Store.dateKey(o.createdAt);
      return d >= from && d <= to && (ch === 'all' || o.channel === ch) && (incCancel || o.status !== 'cancelled');
    }).sort(function (a, b) { return a.createdAt - b.createdAt; });
  }

  function paint() {
    var rows = data();
    var total = rows.reduce(function (a, o) { return a + (o.status === 'cancelled' ? 0 : o.total); }, 0);
    var byCh = {}, byItem = {}, byBom = {};
    rows.forEach(function (o) {
      if (o.status === 'cancelled') return;
      byCh[o.channel] = byCh[o.channel] || { n: 0, v: 0 }; byCh[o.channel].n++; byCh[o.channel].v += o.total;
      o.items.forEach(function (i) { byItem[i.name] = byItem[i.name] || { q: 0, v: 0 }; byItem[i.name].q += i.qty; byItem[i.name].v += i.qty * i.price; });
      Store.calculateBom(o.items).forEach(function (b) {
        byBom[b.productId] = byBom[b.productId] || { name: b.name, unit: b.unit, qty: 0 };
        byBom[b.productId].qty += b.qty;
      });
    });
    var top = Object.keys(byItem).sort(function (a, b) { return byItem[b].v - byItem[a].v; }).slice(0, 8);
    var bomList = Object.keys(byBom).sort(function (a, b) { return byBom[b].qty - byBom[a].qty; });

    root.querySelector('#sl-out').innerHTML =
      '<div class="grid g3" style="margin-bottom:14px"><div class="card stat"><span>Total Orders</span><b>' + rows.length + '</b></div><div class="card stat"><span>Total Sales</span><b>' + UI.rp(total) + '</b></div>' +
      '<div class="card stat"><span>Average Order Value</span><b>' + UI.rp(rows.length ? total / rows.length : 0) + '</b></div></div>' +
      '<div class="grid g2" style="margin-bottom:14px"><div class="card"><h3>By Channel</h3><table class="tbl"><tbody>' + (Object.keys(byCh).map(function (k) { return '<tr><td>' + UI.chBadge(k) + '</td><td class="r">' + byCh[k].n + ' orders</td><td class="r"><b>' + UI.rp(byCh[k].v) + '</b></td></tr>'; }).join('') || '<tr><td class="empty">No data</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>Top Menu Items</h3><table class="tbl"><tbody>' + (top.map(function (k) { return '<tr><td>' + UI.esc(k) + '</td><td class="r">' + byItem[k].q + ' pcs</td><td class="r"><b>' + UI.rp(byItem[k].v) + '</b></td></tr>'; }).join('') || '<tr><td class="empty">No data</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><h3>Total BOM Material Usage (Selected Period)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Material</th><th class="r">BOM Qty Used</th><th>UoM</th></tr></thead><tbody>' +
      (bomList.map(function (k) { var b = byBom[k]; return '<tr><td>' + UI.esc(b.name) + '</td><td class="r"><b>' + UI.num(b.qty) + '</b></td><td>' + UI.esc(b.unit) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="empty">No BOM usage in selected period</td></tr>') +
      '</tbody></table></div></div>';
  }

  function exportCsv(kind) {
    var rows = data();
    if (!rows.length) { UI.toast('No sales data in selected range', 'warn'); return; }
    var delim = root.querySelector('#sl-delim').value;
    var out = [];
    if (kind === 'detail') {
      out.push(['Date', 'Time', 'Order No', 'Channel', 'Order Type', 'Platform ID', 'Customer', 'Payment', 'Status', 'SKU', 'Item', 'Qty', 'Price', 'Subtotal', 'Note']);
      rows.forEach(function (o) {
        o.items.forEach(function (i) {
          out.push([Store.dateKey(o.createdAt), UI.time(o.createdAt), o.no, Store.CHANNELS[o.channel].label, o.orderType === 'takeaway' ? 'Takeaway' : (o.orderType === 'dinein' ? 'Dine In' : ''), o.externalId, o.customer, PAY[o.payment] || o.payment, o.status, i.sku, i.name, i.qty, i.price, i.qty * i.price, i.note]);
        });
        if (o.bagFee) out.push([Store.dateKey(o.createdAt), UI.time(o.createdAt), o.no, Store.CHANNELS[o.channel].label, 'Takeaway', o.externalId, o.customer, PAY[o.payment] || o.payment, o.status, '', 'Shopping bag', 1, o.bagFee, o.bagFee, '']);
      });
    } else if (kind === 'bom') {
      var byBom = {};
      rows.forEach(function (o) {
        if (o.status === 'cancelled') return;
        Store.calculateBom(o.items).forEach(function (b) {
          byBom[b.productId] = byBom[b.productId] || { name: b.name, unit: b.unit, qty: 0 };
          byBom[b.productId].qty += b.qty;
        });
      });
      out.push(['Material', 'BOM Qty Used', 'UoM']);
      Object.keys(byBom).forEach(function (k) { var b = byBom[k]; out.push([b.name, b.qty, b.unit]); });
    } else {
      out.push(['Date', 'Order No', 'Channel', 'Order Type', 'Payment', 'Status', 'Total']);
      rows.forEach(function (o) { out.push([Store.dateKey(o.createdAt), o.no, Store.CHANNELS[o.channel].label, o.orderType === 'takeaway' ? 'Takeaway' : (o.orderType === 'dinein' ? 'Dine In' : ''), PAY[o.payment] || o.payment, o.status, o.total]); });
    }
    UI.download('sales-' + kind + '-' + from + '_to_' + to + '.csv', UI.csv(out, delim), 'text/csv;charset=utf-8');
    UI.toast('CSV downloaded (' + rows.length + ' orders)', 'ok');
  }

  window.Views = window.Views || {};
  window.Views.sales = {
    title: 'Sales Export', sub: 'Download sales reports & BOM material consumption by date range',
    render: function (r) {
      root = r; from = dayStr(6); to = UI.today(); ch = 'all'; incCancel = false;
      root.innerHTML =
        '<div class="card" style="margin-bottom:14px"><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">' +
        '<div><label class="f">From Date</label><input type="date" id="sl-from" value="' + from + '"></div>' +
        '<div><label class="f">To Date</label><input type="date" id="sl-to" value="' + to + '"></div>' +
        '<div><label class="f">Channel</label><select id="sl-ch"><option value="all">All channels</option>' + Object.keys(Store.CHANNELS).map(function (k) { return '<option value="' + k + '">' + Store.CHANNELS[k].label + '</option>'; }).join('') + '</select></div>' +
        '<div><label class="f">CSV Delimiter</label><select id="sl-delim"><option value=",">Comma ( , )</option><option value=";">Semicolon ( ; )</option></select></div></div>' +
        '<div class="row sp" style="margin-top:12px"><div class="row"><button class="chip" data-q="0">Today</button><button class="chip" data-q="6">7 days</button><button class="chip" data-q="29">30 days</button>' +
        '<label class="row" style="gap:6px;margin-left:8px"><input type="checkbox" id="sl-cancel" style="width:auto"> include cancelled</label></div>' +
        '<div class="row"><button class="btn primary" data-exp="detail">⬇ Item Detail CSV</button><button class="btn" data-exp="bom">⬇ BOM Usage CSV</button><button class="btn ghost" data-exp="summary">⬇ Summary CSV</button></div></div></div>' +
        '<div id="sl-out"></div>';
      paint();
      root.addEventListener('change', function (e) {
        if (e.target.id === 'sl-from') from = e.target.value || from;
        if (e.target.id === 'sl-to') to = e.target.value || to;
        if (e.target.id === 'sl-ch') ch = e.target.value;
        if (e.target.id === 'sl-cancel') incCancel = e.target.checked;
        paint();
      });
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-q')) {
          from = dayStr(+t.getAttribute('data-q')); to = UI.today();
          root.querySelector('#sl-from').value = from; root.querySelector('#sl-to').value = to; paint();
        } else if (t.hasAttribute('data-exp')) exportCsv(t.getAttribute('data-exp'));
      });
    },
    onStore: function () { if (root && root.querySelector('#sl-out')) paint(); }
  };
})();
