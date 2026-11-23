(function () {
  'use strict';
  var root, editor;

  function paintHistory() {
    var list = Store.get().issues.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 30);
    root.querySelector('#gi-hist').innerHTML = list.length ? list.map(function (r) {
      var sum = r.lines.map(function (l) { return UI.num(l.qty) + ' ' + l.unit + ' ' + l.name; }).join(', ');
      return '<tr><td><b>' + r.no + '</b></td><td>' + UI.dateLabel(r.date) + '</td><td>' + UI.esc(r.recipient) + '</td>' +
        '<td class="muted" style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + UI.esc(sum) + '">' + UI.esc(sum) + '</td>' +
        '<td class="row"><button class="btn sm" data-pdf="' + r.id + '">⬇ PDF</button><button class="btn sm ghost" data-print="' + r.id + '">🖨 Print</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No goods issues recorded yet</td></tr>';
  }

  function save(mode) {
    var recipient = root.querySelector('#gi-recipient').value.trim();
    var outlet = root.querySelector('#gi-outlet').value.trim();
    var lines = editor.getLines();
    if (!outlet) { UI.toast('Please enter the sending outlet', 'warn'); return; }
    if (!recipient) { UI.toast('Please enter recipient name', 'warn'); return; }
    if (!lines.length) { UI.toast('Add at least one material with quantity', 'warn'); return; }
    var short = lines.filter(function (l) { return l.qty > Store.product(l.productId).stock; });
    if (short.length) {
      UI.toast('Insufficient stock: ' + short.map(function (l) { return Store.product(l.productId).name; }).join(', '), 'err');
      return;
    }
    var doc = Store.createIssue({
      outlet: outlet, recipient: recipient, sender: root.querySelector('#gi-sender').value.trim(), date: root.querySelector('#gi-date').value || UI.today(),
      note: root.querySelector('#gi-note').value.trim(), lines: lines
    });
    UI.toast('Goods issue ' + doc.no + ' saved, stock deducted', 'ok');
    editor.reset();
    root.querySelector('#gi-outlet').value = ''; root.querySelector('#gi-note').value = '';
    paintHistory();
    if (mode) PDFDoc.issue(doc, mode);
  }

  window.Views = window.Views || {};
  window.Views.issue = {
    title: 'Goods Issue', sub: 'Record outgoing material transfers (GI TF) & generate PDF',
    render: function (r) {
      root = r;
      root.innerHTML =
        '<div class="card"><h3>New Goods Issue (GI TF)</h3>' +
        '<div class="fgrid"><div class="fg"><label class="f">Recipient (branch / destination)</label><input id="gi-recipient" placeholder="e.g. Branch Outlet B"></div>' +
        '<div class="fg"><label class="f">Date</label><input type="date" id="gi-date" value="' + UI.today() + '"></div>' +
        '<div class="fg"><label class="f">Manager on Duty</label><input id="gi-sender" placeholder="Manager name"></div>' +
        '<div class="fg"><label class="f">Sending Outlet</label><input id="gi-outlet" placeholder="Type sending outlet name"></div></div>' +
        '<div id="gi-lines" class="fg"></div>' +
        '<div class="fg"><label class="f">Notes / Purpose</label><input id="gi-note" placeholder="Optional"></div>' +
        '<div class="row"><button class="btn primary" data-save="">Save</button><button class="btn" data-save="download">Save & Download PDF</button><button class="btn ghost" data-save="print">Save & Print</button></div></div>' +
        '<div class="card" style="margin-top:14px"><h3>Goods Issue History</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>Date</th><th>From → To</th><th>Items</th><th></th></tr></thead><tbody id="gi-hist"></tbody></table></div></div>';
      editor = UI.lineEditor(root.querySelector('#gi-lines'), { showStock: true });
      paintHistory();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-save')) save(t.getAttribute('data-save'));
        else if (t.hasAttribute('data-pdf') || t.hasAttribute('data-print')) {
          var id = t.getAttribute('data-pdf') || t.getAttribute('data-print');
          var doc = Store.get().issues.filter(function (x) { return x.id === id; })[0];
          if (doc) PDFDoc.issue(doc, t.hasAttribute('data-print') ? 'print' : 'download');
        }
      });
    }
  };
})();
