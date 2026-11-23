(function () {
  'use strict';
  var root, fCh = 'all', fSt = 'all', fDate = '';
  var PAY = { cash: 'Cash', qris: 'QRIS', edc: 'EDC', xendit: 'Xendit', online: 'Online Platform' };

  function list() {
    return Store.get().orders.filter(function (o) {
      return (fCh === 'all' || o.channel === fCh) && (fSt === 'all' || o.status === fSt) && (!fDate || Store.dateKey(o.createdAt) === fDate);
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function paint() {
    var rows = list();
    var chips = function (arr, cur, attr) {
      return arr.map(function (c) { return '<button class="chip ' + (cur === c[0] ? 'on' : '') + '" ' + attr + '="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    };
    var chArr = [['all', 'All channels']].concat(Object.keys(Store.CHANNELS).map(function (k) { return [k, Store.CHANNELS[k].label]; }));
    var stArr = [['all', 'All statuses'], ['new', 'New'], ['preparing', 'Preparing'], ['ready', 'Ready'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
    root.querySelector('#ord-filters').innerHTML =
      '<div class="chips">' + chips(chArr, fCh, 'data-ch') + '</div><div class="chips">' + chips(stArr, fSt, 'data-fs') + '</div>' +
      '<div class="row"><input type="date" id="ord-date" value="' + fDate + '" style="width:auto"><button class="btn ghost sm" data-today>Today</button><button class="btn ghost sm" data-alld>All dates</button></div>';
    root.querySelector('#ord-body').innerHTML = rows.length ? rows.slice(0, 150).map(function (o) {
      var sum = o.items.map(function (i) { return i.qty + '× ' + i.name; }).join(', ');
      return '<tr><td><b>' + o.no + '</b></td><td>' + UI.chBadge(o.channel) + UI.typeBadge(o) + '</td><td class="muted">' + UI.dateTime(o.createdAt) + '</td>' +
        '<td>' + UI.esc(o.customer || '-') + '</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + UI.esc(sum) + '">' + UI.esc(sum) + '</td>' +
        '<td class="r">' + UI.rp(o.total) + '</td><td>' + UI.statusPill(o.status) + '</td><td><button class="btn sm" data-detail="' + o.id + '">Details</button></td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">No orders match current filters</td></tr>';
    root.querySelector('#ord-count').textContent = rows.length + ' orders';
  }

  function detail(id) {
    var o = Store.get().orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var nxt = { new: ['preparing', 'Start Cooking'], preparing: ['ready', 'Mark Ready'], ready: ['completed', 'Complete'] }[o.status];
    var actions = [{ label: 'Close' }];
    if (nxt) actions.push({ label: nxt[1], kind: 'primary', onClick: function () { Store.setOrderStatus(o.id, nxt[0]); } });
    if (o.status === 'new' || o.status === 'preparing') actions.unshift({ label: 'Cancel order', kind: 'danger', onClick: function () { Store.setOrderStatus(o.id, 'cancelled'); } });
    var bom = o.bomBreakdown && o.bomBreakdown.length ? o.bomBreakdown : Store.calculateBom(o.items);
    UI.modal({
      title: 'Order ' + o.no, wide: true, actions: actions,
      body: '<div class="row sp" style="margin-bottom:10px"><div>' + UI.chBadge(o.channel) + ' ' + UI.statusPill(o.status) + '</div><span class="muted">' + UI.dateTime(o.createdAt) + '</span></div>' +
        '<div class="fgrid" style="margin-bottom:10px"><div><span class="muted">Customer</span><br>' + UI.esc(o.customer || '-') + '</div><div><span class="muted">Platform ID</span><br>' + UI.esc(o.externalId || '-') + '</div>' +
        '<div><span class="muted">Payment</span><br>' + (PAY[o.payment] || o.payment) + '</div><div><span class="muted">Total</span><br><b>' + UI.rp(o.total) + '</b></div></div>' +
        '<table class="tbl"><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Subtotal</th></tr></thead><tbody>' +
        o.items.map(function (i) { return '<tr><td>' + UI.esc(i.name) + (i.note ? '<div class="muted" style="font-size:12px">📝 ' + UI.esc(i.note) + '</div>' : '') + '</td><td class="r">' + i.qty + '</td><td class="r">' + UI.rp(i.price) + '</td><td class="r">' + UI.rp(i.price * i.qty) + '</td></tr>'; }).join('') + (o.bagFee ? '<tr><td>🛍️ Shopping bag (takeaway)</td><td class="r">1</td><td class="r">' + UI.rp(o.bagFee) + '</td><td class="r">' + UI.rp(o.bagFee) + '</td></tr>' : '') + '</tbody></table>' +
        '<h4 style="margin:14px 0 6px">Calculated BOM Material Usage</h4>' +
        (bom.length ? '<table class="tbl"><thead><tr><th>Material</th><th class="r">Qty Used</th><th>UoM</th></tr></thead><tbody>' +
          bom.map(function (b) { return '<tr><td>' + UI.esc(b.name || b.material) + '</td><td class="r">' + UI.num(b.qty) + '</td><td>' + UI.esc(b.unit) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="muted">No BOM items</div>') +
        (o.unmapped && o.unmapped.length ? '<div class="note" style="margin-top:10px">⚠️ Unmapped items (no BOM stock deducted): ' + UI.esc(o.unmapped.join(', ')) + '. Match the menu SKU/name in Master Data → Menu & BOM.</div>' : '') +
        '<h4 style="margin:14px 0 6px">Timeline</h4><div class="muted">Received ' + UI.time(o.createdAt) + ' → Cooking ' + UI.time(o.startedAt) + ' → Ready ' + UI.time(o.readyAt) + ' → Completed ' + UI.time(o.doneAt) + '</div>'
    });
  }

  window.Views = window.Views || {};
  window.Views.orders = {
    title: 'Incoming Orders', sub: 'Real-time order list across POS and delivery channels',
    render: function (r) {
      root = r; fCh = 'all'; fSt = 'all'; fDate = UI.today();
      root.innerHTML = '<div class="card"><div id="ord-filters" class="grid" style="gap:10px;margin-bottom:14px"></div>' +
        '<div class="row sp" style="margin-bottom:6px"><span class="muted" id="ord-count"></span><span class="live"><i></i> real-time</span></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>Channel</th><th>Time</th><th>Customer</th><th>Items</th><th class="r">Total</th><th>Status</th><th></th></tr></thead><tbody id="ord-body"></tbody></table></div></div>';
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-ch')) { fCh = t.getAttribute('data-ch'); paint(); }
        else if (t.hasAttribute('data-fs')) { fSt = t.getAttribute('data-fs'); paint(); }
        else if (t.hasAttribute('data-today')) { fDate = UI.today(); paint(); }
        else if (t.hasAttribute('data-alld')) { fDate = ''; paint(); }
        else if (t.hasAttribute('data-detail')) detail(t.getAttribute('data-detail'));
      });
      root.addEventListener('change', function (e) { if (e.target.id === 'ord-date') { fDate = e.target.value; paint(); } });
      paint();
    },
    onStore: function () { if (root) paint(); }
  };
})();
