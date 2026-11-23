(function () {
  'use strict';
  var root, editor;

  function paintHistory() {
    var list = Store.get().receipts.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 30);
    root.querySelector('#gr-hist').innerHTML = list.length ? list.map(function (r) {
      var sum = r.lines.map(function (l) { return UI.num(l.qty) + ' ' + l.unit + ' ' + l.name; }).join(', ');
      var typeLbl = r.grType === 'gr_tf' ? 'GR TF' : 'GR PO / WMS DC';
      return '<tr><td><b>' + r.no + '</b></td><td>' + UI.dateLabel(r.date) + '</td><td>' + UI.esc(typeLbl) + ' · ' + UI.esc(r.vendorName) + '</td>' +
        '<td class="muted" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + UI.esc(sum) + '">' + UI.esc(sum) + '</td>' +
        '<td class="row"><button class="btn sm" data-pdf="' + r.id + '">⬇ PDF</button><button class="btn sm ghost" data-print="' + r.id + '">🖨 Print</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No goods receipts recorded yet</td></tr>';
  }

  function save(mode) {
    var vendorName = root.querySelector('#gr-vendor').value.trim();
    var lines = editor.getLines();
    if (!vendorName) { UI.toast('Please enter the vendor / source', 'warn'); return; }
    if (!lines.length) { UI.toast('Add at least one material with quantity', 'warn'); return; }
    var doc = Store.createReceipt({
      vendorName: vendorName,
      grType: root.querySelector('#gr-type').value,
      date: root.querySelector('#gr-date').value || UI.today(),
      receiver: root.querySelector('#gr-receiver').value.trim(),
      ref: root.querySelector('#gr-ref').value.trim(),
      note: root.querySelector('#gr-note').value.trim(),
      lines: lines
    });
    UI.toast('Goods receipt ' + doc.no + ' saved, stock increased', 'ok');
    editor.reset();
    root.querySelector('#gr-vendor').value = ''; root.querySelector('#gr-ref').value = ''; root.querySelector('#gr-note').value = '';
    paintHistory();
    if (mode) PDFDoc.receipt(doc, mode);
  }

  window.Views = window.Views || {};
  window.Views.receive = {
    title: 'Goods Receive', sub: 'Record incoming materials (GR TF / GR PO / WMS DC) & generate PDF',
    render: function (r) {
      root = r;
      root.innerHTML =
        '<div class="card"><h3>New Goods Receive</h3>' +
        '<div class="fgrid">' +
        '<div class="fg"><label class="f">Receipt Type</label><select id="gr-type"><option value="gr_po_wms">GR PO / WMS DC</option><option value="gr_tf">GR TF (Transfer In)</option></select></div>' +
        '<div class="fg"><label class="f">Vendor / Source</label><input id="gr-vendor" placeholder="Type vendor / source name"></div>' +
        '<div class="fg"><label class="f">Receive Date</label><input type="date" id="gr-date" value="' + UI.today() + '"></div>' +
        '<div class="fg"><label class="f">Received By</label><input id="gr-receiver" placeholder="Receiver name"></div>' +
        '<div class="fg"><label class="f">Delivery / PO Reference</label><input id="gr-ref" placeholder="Optional"></div>' +
        '<div class="fg"><label class="f">Notes</label><input id="gr-note" placeholder="Optional"></div></div>' +
        '<div id="gr-lines" class="fg"></div>' +
        '<div class="row"><button class="btn primary" data-save="">Save</button><button class="btn" data-save="download">Save & Download PDF</button><button class="btn ghost" data-save="print">Save & Print</button></div></div>' +
        '<div class="card" style="margin-top:14px"><h3>Goods Receive History</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>Date</th><th>Type & Vendor</th><th>Items</th><th></th></tr></thead><tbody id="gr-hist"></tbody></table></div></div>';
      editor = UI.lineEditor(root.querySelector('#gr-lines'));
      paintHistory();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-save')) save(t.getAttribute('data-save'));
        else if (t.hasAttribute('data-pdf') || t.hasAttribute('data-print')) {
          var id = t.getAttribute('data-pdf') || t.getAttribute('data-print');
          var doc = Store.get().receipts.filter(function (x) { return x.id === id; })[0];
          if (doc) PDFDoc.receipt(doc, t.hasAttribute('data-print') ? 'print' : 'download');
        }
      });
    }
  };
})();
