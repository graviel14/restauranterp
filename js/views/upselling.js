/* Upselling report — Upselling Rate = total qty of upselling products / TC (transaction count) */
(function () {
  'use strict';
  var root, from, to;

  function dayStr(offset) { return Store.dateKey(Date.now() - offset * 86400000); }

  function compute() {
    // TC = every non-cancelled POS transaction (dine in + takeaway) in the range; upselling only happens at the POS
    var orders = Store.get().orders.filter(function (o) {
      var d = Store.dateKey(o.createdAt);
      return o.channel === 'pos' && o.status !== 'cancelled' && d >= from && d <= to;
    });
    var byDay = {}, byItem = {}, qty = 0, upOrders = 0;
    orders.forEach(function (o) {
      var d = Store.dateKey(o.createdAt);
      byDay[d] = byDay[d] || { tc: 0, up: 0 };
      byDay[d].tc++;
      var oq = 0;
      o.items.forEach(function (i) {
        var u = Number(i.upsellQty) || 0;
        if (!u) return;
        oq += u;
        byItem[i.name] = byItem[i.name] || { q: 0, v: 0 };
        byItem[i.name].q += u; byItem[i.name].v += u * i.price;
      });
      byDay[d].up += oq; qty += oq; if (oq) upOrders++;
    });
    return { tc: orders.length, qty: qty, upOrders: upOrders, byDay: byDay, byItem: byItem };
  }

  function pct(up, tc) { return tc ? (up / tc * 100).toFixed(1) + '%' : '0.0%'; }

  function paint() {
    var r = compute();
    var days = Object.keys(r.byDay).sort().reverse();
    var items = Object.keys(r.byItem).sort(function (a, b) { return r.byItem[b].q - r.byItem[a].q; });
    root.querySelector('#up-body').innerHTML =
      '<div class="grid g4" style="margin-bottom:14px">' +
      '<div class="card stat"><span>Upselling Rate</span><b>' + pct(r.qty, r.tc) + '</b><small>Upselling qty ÷ TC</small></div>' +
      '<div class="card stat"><span>Total Upselling Qty</span><b>' + UI.num(r.qty) + '</b><small>Ala Carte items sold via upselling</small></div>' +
      '<div class="card stat"><span>TC (Transactions)</span><b>' + UI.num(r.tc) + '</b><small>POS transactions in range</small></div>' +
      '<div class="card stat"><span>Transactions with Upselling</span><b>' + UI.num(r.upOrders) + '</b><small>' + pct(r.upOrders, r.tc) + ' of TC</small></div></div>' +
      '<div class="split"><div class="card"><h3>Upselling by Product</h3>' + (items.length ?
        '<table class="tbl"><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Sales</th></tr></thead><tbody>' +
        items.map(function (n) { return '<tr><td>' + UI.esc(n) + '</td><td class="r">' + UI.num(r.byItem[n].q) + '</td><td class="r">' + UI.rp(r.byItem[n].v) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No upselling in this date range</div>') + '</div>' +
      '<div class="card"><h3>Upselling Rate by Day</h3>' + (days.length ?
        '<table class="tbl"><thead><tr><th>Date</th><th class="r">TC</th><th class="r">Upselling Qty</th><th class="r">Rate</th></tr></thead><tbody>' +
        days.map(function (d) { var x = r.byDay[d]; return '<tr><td>' + UI.dateLabel(d) + '</td><td class="r">' + x.tc + '</td><td class="r">' + x.up + '</td><td class="r"><b>' + pct(x.up, x.tc) + '</b></td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No transactions in this date range</div>') + '</div></div>';
  }

  window.Views = window.Views || {};
  window.Views.upselling = {
    title: 'Upselling', sub: 'Upselling rate = total qty of upselling products ÷ TC (transaction count)',
    render: function (r) {
      root = r; from = dayStr(6); to = UI.today();
      root.innerHTML = '<div class="card" style="margin-bottom:14px"><div class="row sp"><div class="row">' +
        '<div><label class="f">From</label><input type="date" id="up-from" value="' + from + '" style="width:auto"></div>' +
        '<div><label class="f">To</label><input type="date" id="up-to" value="' + to + '" style="width:auto"></div></div>' +
        '<div class="row"><button class="btn sm" data-r="0">Today</button><button class="btn sm" data-r="6">Last 7 days</button><button class="btn sm" data-r="29">Last 30 days</button></div></div></div>' +
        '<div id="up-body"></div>';
      function setRange(f, t) {
        from = f; to = t;
        root.querySelector('#up-from').value = f; root.querySelector('#up-to').value = t;
        paint();
      }
      root.addEventListener('change', function (e) {
        if (e.target.id === 'up-from' || e.target.id === 'up-to') {
          var f = root.querySelector('#up-from').value, t = root.querySelector('#up-to').value;
          if (f && t && f > t) { UI.toast('"From" date must be before "To" date', 'warn'); return; }
          if (f && t) { from = f; to = t; paint(); }
        }
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-r]'); if (!b) return;
        setRange(dayStr(+b.getAttribute('data-r')), UI.today());
      });
      paint();
    },
    onStore: function () { if (root) paint(); }
  };
})();
