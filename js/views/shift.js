/* End Shift / End Day — receipt-style summary (format modeled on the POS "Shift Summary" slip) */
(function () {
  'use strict';
  var root;
  var W = 42; // characters per line (80 mm thermal paper)

  /* ---------- receipt text ---------- */
  function rep(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }
  function padR(t, n) { t = String(t); return t.length >= n ? t.slice(0, n) : t + rep(' ', n - t.length); }
  function padL(t, n) { t = String(t); return t.length >= n ? t : rep(' ', n - t.length) + t; }
  function money(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function row(l, v) { return padR(l, W - 14) + ': ' + padL(v, 12); }
  function center(t) { t = String(t); return rep(' ', Math.floor((W - t.length) / 2)) + t; }
  function dmy(key) { var p = String(key).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function stamp(ts) {
    var d = new Date(ts), z = function (n) { return ('0' + n).slice(-2); };
    return z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function receiptText(rec) {
    var sm = rec.summary, st = Store.get().settings, date = dmy(rec.date);
    var isDay = rec.type === 'day';
    var L = [], DASH = rep('-', W), EQ = rep('=', W);
    L.push(center('******* START *******'));
    L.push(center(st.restaurant));
    L.push(center(isDay ? 'End Day Summary | ' + date : 'Shift Summary | ' + date));
    L.push(DASH);
    if (isDay) {
      L.push(row('Day Report No', rec.no));
      L.push(row('Closed By', rec.closedBy || '-'));
      L.push(row('Closed At', stamp(rec.closedAt)));
      L.push(row('Shifts', (rec.shiftNos || []).length ? rec.shiftNos.length + ' shift(s)' : 'none'));
      (rec.shiftNos || []).forEach(function (n) { L.push('  ' + n); });
    } else {
      L.push(row('Shift No', rec.no));
      L.push(row('Cashier', rec.cashier || '-'));
      L.push(row('Closed By', rec.closedBy || '-'));
      L.push(row('Opened', stamp(rec.openedAt)));
      L.push(row('Closed', stamp(rec.closedAt)));
    }
    L.push(EQ);
    L.push(row('Sales Total', money(sm.salesTotal)));
    L.push(row('Menu Discount', money(sm.menuDiscount)));
    L.push(row('Bill Discount', money(sm.billDiscount)));
    L.push(DASH);
    L.push(row('Net Sales Total', money(sm.netSales)));
    L.push(DASH);
    L.push(row('Delivery Cost Total', money(sm.deliveryCost)));
    L.push(row('Order Fee Total', money(sm.orderFee)));
    L.push(row('SC Total', money(sm.sc)));
    L.push(row('PB1 Total', money(sm.pb1)));
    L.push(row('PPN Total', money(sm.ppn)));
    L.push(row('Platform Fee Total', money(sm.platformFee)));
    L.push(row('Voucher Sales Total', money(sm.voucher)));
    L.push(row('Rounding Total', money(sm.rounding)));
    L.push(DASH);
    L.push(row('Gross Sales Total', money(sm.grossSales)));
    L.push(DASH);
    L.push(row('Number of Pax', money(sm.pax)));
    L.push(row('Avg. Net Sales per Pax', money(sm.avgNetPax)));
    L.push(row('Avg. Sales per Pax', money(sm.avgSalesPax)));
    L.push(DASH);
    L.push(row('Number of Bills', money(sm.bills)));
    L.push(row('Avg. Net Sales per Bill', money(sm.avgNetBill)));
    L.push(row('Avg. Sales per Bill', money(sm.avgSalesBill)));
    L.push(DASH);
    L.push(row('Cancel Total', money(sm.cancelTotal)));
    L.push(row('Void Total', money(sm.voidTotal)));
    L.push(EQ);
    L.push(center('Sales by Type | ' + date));
    L.push(DASH);
    L.push(row('Quick Service', ''));
    L.push(row('Total', money(sm.netSales)));
    L.push(EQ);
    L.push(center('Sales By Visit Purpose | ' + date));
    L.push(DASH);
    var tb = 0, ts = 0;
    sm.purposes.forEach(function (p) {
      tb += p.bills; ts += p.sales;
      L.push(p.name);
      L.push(row(' - Number Of Bill', money(p.bills)));
      L.push(row(' - Sales', money(p.sales)));
    });
    L.push(DASH);
    L.push(row('Total Bill', money(tb)));
    L.push(row('Total Sales', money(ts)));
    L.push(EQ);
    L.push(center('Payment Method Summary | ' + date));
    L.push(DASH);
    var pq = 0, pt = 0;
    sm.payments.forEach(function (p) {
      pq += p.qty; pt += p.total;
      L.push(p.name);
      L.push(row(' - Qty', money(p.qty)));
      L.push(row(' - Total', money(p.total)));
    });
    L.push(DASH);
    L.push(row('Total', money(pt)));
    L.push(EQ);
    L.push(center('Non Sales Payment Method Summary | ' + date));
    L.push(DASH);
    L.push(row('Total', money(sm.nonSales)));
    if (!isDay) {
      var cash = 0;
      sm.payments.forEach(function (p) { if (p.name === 'CASH') cash = p.total; });
      var expected = (rec.openingCash || 0) + cash;
      L.push(EQ);
      L.push(center('Cash Drawer | ' + date));
      L.push(DASH);
      L.push(row('Opening Cash', money(rec.openingCash)));
      L.push(row('Cash Sales', money(cash)));
      L.push(row('Expected Cash', money(expected)));
      if (rec.countedCash != null) {
        L.push(row('Counted Cash', money(rec.countedCash)));
        L.push(row('Difference', money(rec.countedCash - expected)));
      } else L.push(row('Counted Cash', '-'));
    }
    L.push(EQ);
    L.push(center('******** END ********'));
    L.push(center('Printed ' + stamp(Date.now())));
    return L.join('\n');
  }

  function printRec(rec) {
    var w = window.open('', '_blank');
    if (!w) { UI.toast('Pop-up blocked by browser. Allow pop-ups to print.', 'err'); return; }
    w.document.write('<html><head><title>' + UI.esc(rec.no) + '</title><style>@page{size:80mm auto;margin:3mm}body{margin:0}' +
      'pre{font:11.5px/1.3 "Courier New",monospace;margin:0;white-space:pre}</style></head><body><pre>' + UI.esc(receiptText(rec)) + '</pre></body></html>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
  }

  function preview(rec) {
    UI.modal({
      title: (rec.type === 'day' ? 'End Day ' : 'Shift ') + rec.no,
      body: '<pre class="receipt">' + UI.esc(receiptText(rec)) + '</pre>',
      actions: [{ label: 'Close' }, { label: '🖨 Print', kind: 'primary', onClick: function () { printRec(rec); return false; } }]
    });
  }

  /* ---------- screen ---------- */
  function paint() {
    var s = Store.get(), sh = Store.currentShift();
    var today = Store.dateKey(Date.now());
    var todayOrders = s.orders.filter(function (o) { return Store.dateKey(o.createdAt) === today; });
    var daySum = Store.buildSummary(todayOrders);
    var dayDone = (s.days || []).filter(function (d) { return d.date === today; });
    var shiftCard;
    if (sh) {
      var live = Store.buildSummary(Store.ordersBetween(sh.openedAt, Date.now()));
      var cash = 0; live.payments.forEach(function (p) { if (p.name === 'CASH') cash = p.total; });
      shiftCard = '<div class="card"><div class="row sp"><h3 style="margin:0">Current Shift <span class="pill s-ready">Open</span></h3><span class="muted">' + sh.no + '</span></div>' +
        '<p class="muted" style="margin:8px 0">Cashier <b>' + UI.esc(sh.cashier || '-') + '</b> · opened ' + UI.dateTime(sh.openedAt) + ' · opening cash ' + UI.rp(sh.openingCash) + '</p>' +
        '<div class="grid g3" style="margin:10px 0"><div class="stat"><span>Bills</span><b>' + live.bills + '</b></div><div class="stat"><span>Net Sales</span><b>' + UI.rp(live.netSales) + '</b></div><div class="stat"><span>Cash Sales</span><b>' + UI.rp(cash) + '</b></div></div>' +
        '<button class="btn primary" id="sh-end">End Shift</button></div>';
    } else {
      shiftCard = '<div class="card"><h3>Start Shift</h3><p class="muted" style="margin-top:0">No shift is open. Start a shift to begin tracking sales for the next End Shift report.</p>' +
        '<div class="fgrid"><div class="fg"><label class="f">Cashier</label><input id="sh-cashier" placeholder="Cashier name"></div>' +
        '<div class="fg"><label class="f">Opening cash (Rp)</label><input id="sh-open" type="number" min="0" placeholder="0"></div></div>' +
        '<button class="btn primary" id="sh-start">Start Shift</button></div>';
    }
    var dayCard = '<div class="card"><h3>End Day · ' + UI.dateLabel(today) + '</h3>' +
      '<div class="grid g3" style="margin-bottom:10px"><div class="stat"><span>Bills today</span><b>' + daySum.bills + '</b></div><div class="stat"><span>Net Sales today</span><b>' + UI.rp(daySum.netSales) + '</b></div><div class="stat"><span>Day reports closed</span><b>' + dayDone.length + '</b></div></div>' +
      (sh ? '<div class="note" style="margin-bottom:10px">End the open shift first, then you can end the day.</div>' : '') +
      '<button class="btn primary" id="sh-endday" ' + (sh ? 'disabled' : '') + '>End Day</button></div>';

    var hist = [].concat(s.shifts.filter(function (x) { return x.closedAt; }), s.days || []).sort(function (a, b) { return b.closedAt - a.closedAt; }).slice(0, 40);
    var histHtml = '<div class="card" style="margin-top:14px"><h3>Report History</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Type</th><th>No</th><th>Date</th><th>By</th><th class="r">Bills</th><th class="r">Net Sales</th><th></th></tr></thead><tbody>' +
      (hist.length ? hist.map(function (r) {
        return '<tr><td><span class="badge" style="--c:' + (r.type === 'day' ? '#7c3aed' : '#0284c7') + '">' + (r.type === 'day' ? 'End Day' : 'Shift') + '</span></td><td><b>' + r.no + '</b></td><td>' + UI.dateLabel(r.date) + '</td>' +
          '<td>' + UI.esc(r.closedBy || '-') + '</td><td class="r">' + r.summary.bills + '</td><td class="r">' + UI.rp(r.summary.netSales) + '</td>' +
          '<td class="row"><button class="btn sm" data-view="' + r.id + '">View</button><button class="btn sm ghost" data-print="' + r.id + '">🖨 Print</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No shift or day reports yet</td></tr>') + '</tbody></table></div></div>';
    root.innerHTML = '<div class="grid g2">' + shiftCard + dayCard + '</div>' + histHtml;
  }

  function findRec(id) {
    var s = Store.get();
    return s.shifts.concat(s.days || []).filter(function (r) { return r.id === id; })[0];
  }

  function endShiftDialog() {
    var sh = Store.currentShift(); if (!sh) return;
    UI.modal({
      title: 'End Shift ' + sh.no,
      body: '<div class="fg"><label class="f">Closed by</label><input id="es-by" value="' + UI.esc(sh.cashier) + '"></div>' +
        '<div class="fg"><label class="f">Counted cash in drawer (Rp, optional)</label><input id="es-cash" type="number" min="0" placeholder="Leave empty to skip"></div>' +
        '<div class="muted" style="font-size:12.5px">The shift will be closed and its summary saved. You can print it right after.</div>',
      actions: [{ label: 'Cancel' }, {
        label: 'End Shift', kind: 'primary', onClick: function (w) {
          var rec = Store.endShift({ closedBy: w.querySelector('#es-by').value.trim(), countedCash: w.querySelector('#es-cash').value });
          if (!rec) { UI.toast('No open shift', 'err'); return; }
          UI.toast('Shift ' + rec.no + ' closed', 'ok');
          setTimeout(function () { preview(rec); }, 50);
        }
      }]
    });
  }

  function endDayDialog() {
    var today = Store.dateKey(Date.now());
    var again = (Store.get().days || []).some(function (d) { return d.date === today; });
    UI.modal({
      title: 'End Day',
      body: '<div class="fg"><label class="f">Closed by</label><input id="ed-by" placeholder="Manager on duty"></div>' +
        (again ? '<div class="note">A day report already exists for today. Ending the day again creates a new report with the latest figures.</div>' : '<div class="muted" style="font-size:12.5px">Summarizes all sales of today across every shift and channel.</div>'),
      actions: [{ label: 'Cancel' }, {
        label: 'End Day', kind: 'primary', onClick: function (w) {
          var rec = Store.endDay({ closedBy: w.querySelector('#ed-by').value.trim() });
          if (!rec) { UI.toast('Close the open shift first', 'warn'); return; }
          UI.toast('Day report ' + rec.no + ' saved', 'ok');
          setTimeout(function () { preview(rec); }, 50);
        }
      }]
    });
  }

  window.ShiftReceipt = { text: receiptText, print: printRec };
  window.Views = window.Views || {};
  window.Views.shift = {
    title: 'End Shift / End Day', sub: 'Close your shift or the day and print the summary slip',
    render: function (r) {
      root = r; paint();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.id === 'sh-start') {
          var c = root.querySelector('#sh-cashier').value.trim();
          if (!c) { UI.toast('Enter the cashier name', 'warn'); return; }
          var sh = Store.startShift({ cashier: c, openingCash: root.querySelector('#sh-open').value });
          if (sh) UI.toast('Shift ' + sh.no + ' started', 'ok');
        }
        else if (t.id === 'sh-end') endShiftDialog();
        else if (t.id === 'sh-endday') endDayDialog();
        else if (t.hasAttribute('data-view')) { var a = findRec(t.getAttribute('data-view')); if (a) preview(a); }
        else if (t.hasAttribute('data-print')) { var b = findRec(t.getAttribute('data-print')); if (b) printRec(b); }
      });
    },
    onStore: function () {
      if (!root) return;
      var a = document.activeElement;
      if (a && a.tagName === 'INPUT' && root.contains(a)) return;
      paint();
    }
  };
})();
