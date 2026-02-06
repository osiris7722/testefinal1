import * as XLSX from 'xlsx';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    downloadBlob(filename, new Blob([''], { type: 'text/csv;charset=utf-8' }));
    return;
  }

  const delimiter = ';';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const str = value == null ? '' : String(value);
    const needs = new RegExp(`[\\n\\r${delimiter}"]`, 'g').test(str);
    const escaped = str.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };

  // UTF-8 BOM + Excel delimiter hint
  const lines = ['\uFEFFsep=' + delimiter, headers.join(delimiter)];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(delimiter));
  }

  downloadBlob(filename, new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

export function exportTxt(filename, rows) {
  const lines = (rows || []).map((r) => {
    const id = r.docId || r.id || '';
    return `${r.data || ''} ${r.hora || ''} | ${r.grau_satisfacao || ''} | ${id}`;
  });
  downloadBlob(filename, new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
}

export function exportXlsx(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows || []);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'feedback');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    filename,
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  );
}
