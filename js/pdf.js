/* PDF document generator (jsPDF via CDN). Falls back to HTML print window if offline. */
(function (global) {
  'use strict';

  function hasJsPdf() { return !!(global.jspdf && global.jspdf.jsPDF); }

  function build(spec) {
    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: spec.landscape ? 'a4' : 'a4', orientation: spec.landscape ? 'landscape' : 'portrait' });
    var W = spec.landscape ? 297 : 210, M = 14, y = 16;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(spec.restaurant || '', M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    if (spec.address) { y += 5; doc.text(spec.address, M, y); }
    doc.setTextColor(0);
    y += 4; doc.setDrawColor(40); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);

    y += 8; doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5);
    doc.text(spec.title, W / 2, y, { align: 'center' });
    y += 4; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Document No: ' + spec.docNo, W / 2, y + 3, { align: 'center' });
    y += 10;

    doc.setFontSize(9.5);
    (spec.meta || []).forEach(function (m) {
      doc.setFont('helvetica', 'bold'); doc.text(m[0], M, y);
      doc.setFont('helvetica', 'normal'); doc.text(': ' + (m[1] || '-'), M + 42, y);
      y += 5.5;
    });
    y += 3;

    var cols = spec.columns, total = cols.reduce(function (a, c) { return a + c.w; }, 0);
    var scale = (W - 2 * M) / total;
    var pageBottom = spec.landscape ? 175 : 255;

    function header() {
      doc.setFillColor(235, 238, 245); doc.rect(M, y - 4.5, W - 2 * M, 7.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      var x = M;
      cols.forEach(function (c) {
        var w = c.w * scale;
        doc.text(c.label, c.align === 'right' ? x + w - 1.5 : x + 1.5, y, { align: c.align === 'right' ? 'right' : 'left' });
        x += w;
      });
      y += 4.5; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    }
    header();
    spec.rows.forEach(function (r) {
      if (y > pageBottom) { doc.addPage(); y = 18; header(); }
      var x = M;
      cols.forEach(function (c, i) {
        var w = c.w * scale, t = String(r[i] == null ? '' : r[i]);
        var lines = doc.splitTextToSize(t, w - 3);
        doc.text(lines[0], c.align === 'right' ? x + w - 1.5 : x + 1.5, y, { align: c.align === 'right' ? 'right' : 'left' });
        x += w;
      });
      doc.setDrawColor(215); doc.setLineWidth(0.2); doc.line(M, y + 2, W - M, y + 2);
      y += 6.5;
    });

    if (spec.note) {
      y += 3; doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Notes:', M, y);
      doc.setFont('helvetica', 'normal');
      doc.splitTextToSize(spec.note, W - 2 * M - 18).forEach(function (l, i) { doc.text(l, M + 18, y + i * 5); });
      y += 8;
    }

    var sigTop = spec.landscape ? 178 : 232;
    if (y > sigTop - 10) { doc.addPage(); y = sigTop; }
    y = Math.max(y + 12, sigTop);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    var sig = spec.signatures || [];
    sig.forEach(function (s, i) {
      var cx = sig.length === 1 ? W / 2 : (i === 0 ? M + 35 : W - M - 35);
      doc.text(s.label, cx, y, { align: 'center' });
      doc.line(cx - 28, y + 20, cx + 28, y + 20);
      if (s.name) doc.text(s.name, cx, y + 25, { align: 'center' });
    });
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Generated ' + new Date().toLocaleString('en-US') + ' — Integrated Restaurant ERP', M, spec.landscape ? 202 : 287);
    return doc;
  }

  function printFallback(spec) {
    var w = global.open('', '_blank');
    if (!w) { UI.toast('Pop-up blocked by browser. Allow pop-ups to print.', 'err'); return; }
    var head = spec.columns.map(function (c) { return '<th style="text-align:' + (c.align || 'left') + '">' + UI.esc(c.label) + '</th>'; }).join('');
    var body = spec.rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) { return '<td style="text-align:' + (spec.columns[i].align || 'left') + '">' + UI.esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var meta = (spec.meta || []).map(function (m) { return '<div><b>' + UI.esc(m[0]) + '</b>: ' + UI.esc(m[1]) + '</div>'; }).join('');
    var sig = (spec.signatures || []).map(function (s) { return '<div class="sg">' + UI.esc(s.label) + '<br><br><br><br>' + UI.esc(s.name || '') + '</div>'; }).join('');
    w.document.write('<html><head><title>' + UI.esc(spec.docNo) + '</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border-bottom:1px solid #ccc;padding:6px}th{background:#eef}h2,h4{text-align:center;margin:4px}.sgs{display:flex;justify-content:space-around;margin-top:50px}.sg{text-align:center}</style></head><body>' +
      '<h3>' + UI.esc(spec.restaurant) + '</h3><div>' + UI.esc(spec.address || '') + '</div><hr><h2>' + UI.esc(spec.title) + '</h2><h4>No. ' + UI.esc(spec.docNo) + '</h4>' +
      meta + '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table><div class="sgs">' + sig + '</div></body></html>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
  }

  var PDFDoc = {
    output: function (spec, filename, mode) {
      if (!hasJsPdf()) {
        UI.toast('PDF library not loaded (requires internet). Using print window.', 'err');
        printFallback(spec); return;
      }
      var doc = build(spec);
      if (mode === 'print') {
        doc.autoPrint();
        var url = doc.output('bloburl');
        var w = global.open(url, '_blank');
        if (!w) UI.toast('Pop-up blocked by browser. Allow pop-ups to print.', 'err');
      } else {
        doc.save(filename);
      }
    },

    receipt: function (r, mode) {
      var st = Store.get().settings;
      PDFDoc.output({
        title: 'GOODS RECEIVE NOTE', restaurant: st.restaurant, address: st.address, docNo: r.no,
        meta: [['Date', UI.dateLabel(r.date)], ['Vendor', r.vendorName], ['Receiving Outlet', st.restaurant], ['Received By', r.receiver], ['Delivery / PO Ref', r.ref], ['Notes', r.note]]
          .filter(function (m) { return m[1]; }),
        columns: [{ label: 'No', w: 8 }, { label: 'Material', w: 82 }, { label: 'Qty', w: 18, align: 'right' }, { label: 'UoM', w: 16 }],
        rows: r.lines.map(function (l, i) { return [i + 1, l.name, UI.num(l.qty), l.unit]; }),
        signatures: [{ label: 'Receiver (Outlet)', name: r.receiver }, { label: 'Sender (Vendor)', name: r.vendorName }]
      }, 'GoodsReceive_' + r.no + '_' + slug(r.vendorName) + '.pdf', mode);
    },

    issue: function (r, mode) {
      var st = Store.get().settings;
      PDFDoc.output({
        title: 'GOODS ISSUE NOTE', restaurant: st.restaurant, address: st.address, docNo: r.no,
        meta: [['Date', UI.dateLabel(r.date)], ['Sending Outlet', r.outlet || st.restaurant], ['Manager on Duty', r.sender], ['Recipient', r.recipient], ['Notes', r.note]]
          .filter(function (m) { return m[1]; }),
        columns: [{ label: 'No', w: 8 }, { label: 'Material', w: 82 }, { label: 'Qty', w: 18, align: 'right' }, { label: 'UoM', w: 16 }],
        rows: r.lines.map(function (l, i) { return [i + 1, l.name, UI.num(l.qty), l.unit]; }),
        signatures: [{ label: 'Issuer (' + (r.outlet || st.restaurant) + ')', name: r.sender }, { label: 'Recipient', name: r.recipient }]
      }, 'GoodsIssue_' + r.no + '_' + slug(r.recipient) + '.pdf', mode);
    },

    opname: function (o, mode) {
      var st = Store.get().settings;
      var names = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' };
      PDFDoc.output({
        title: 'STOCK COUNT REPORT — ' + (names[o.type] || ''), restaurant: st.restaurant, address: st.address, docNo: o.no,
        meta: [['Date', UI.dateLabel(o.date)], ['Manager on duty', o.officer], ['Notes', o.note]].filter(function (m) { return m[1]; }),
        columns: [{ label: 'Material', w: 50 }, { label: 'System', w: 20, align: 'right' }, { label: 'Physical', w: 20, align: 'right' }, { label: 'Variance', w: 20, align: 'right' }, { label: 'UoM', w: 16 }],
        rows: o.lines.map(function (l) { return [l.name, UI.num(l.system), UI.num(l.physical), (l.diff > 0 ? '+' : '') + UI.num(l.diff), l.unit]; }),
        signatures: [{ label: 'Manager on duty', name: o.officer }, { label: 'Manager Approval', name: '' }]
      }, 'StockCount_' + o.no + '.pdf', mode);
    },

    variance: function (specData, mode) {
      var st = Store.get().settings;
      PDFDoc.output({
        title: 'STOCK VARIANCE REPORT',
        restaurant: st.restaurant,
        address: st.address,
        docNo: 'VAR-' + specData.from + '_TO_' + specData.to,
        landscape: true,
        meta: [
          ['Period', UI.dateLabel(specData.from) + ' to ' + UI.dateLabel(specData.to)],
          ['Formula', 'Sub Total = (Stock SO + GR TF + GR PO/WMS DC - GI TF - Waste) - Sold | Value = -(Sub Total - Stock Closing)']
        ],
        columns: [
          { label: 'Name Material', w: 46 },
          { label: 'UoM', w: 12 },
          { label: 'Stock SO', w: 18, align: 'right' },
          { label: 'GR TF', w: 16, align: 'right' },
          { label: 'GR PO/WMS', w: 20, align: 'right' },
          { label: 'GI TF', w: 16, align: 'right' },
          { label: 'Waste', w: 16, align: 'right' },
          { label: 'Sold', w: 18, align: 'right' },
          { label: 'Stock Closing', w: 22, align: 'right' },
          { label: 'Sub Total', w: 20, align: 'right' },
          { label: 'Value', w: 20, align: 'right' }
        ],
        rows: specData.rows.map(function (r) {
          return [
            r.name, r.unit,
            UI.num(r.stockSo), UI.num(r.grTf), UI.num(r.grPoWms),
            UI.num(r.giTf), UI.num(r.waste), UI.num(r.sold),
            UI.num(r.stockClosing), UI.num(r.subTotal),
            (r.value > 0 ? '+' : '') + UI.num(r.value)
          ];
        }),
        signatures: [{ label: 'Inventory Controller', name: '' }, { label: 'Outlet Manager', name: '' }]
      }, 'StockVariance_' + specData.from + '_' + specData.to + '.pdf', mode);
    }
  };

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }

  global.PDFDoc = PDFDoc;
})(window);
