(function (root) {
  const criteria = [
    ['responsabilidade', 'Responsabilidade'], ['relacionamento', 'Relacionamento interpessoal'],
    ['cooperacao', 'Cooperação'], ['organizacao', 'Organização'], ['educacao', 'Educação'],
  ];
  const levels = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
  const colors = ['#c73a3a', '#f0a09c', '#d9d8d2', '#86b6ef', '#1c5cab'];
  const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const format = value => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const libraries = new Map();
  function library(name, src) {
    if (root[name]) return Promise.resolve();
    if (!libraries.has(name)) libraries.set(name, new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src;
      script.onload = resolve;
      script.onerror = () => { libraries.delete(name); script.remove(); reject(new Error('Não foi possível carregar a exportação. Tente novamente.')); };
      document.head.appendChild(script);
    }));
    return libraries.get(name);
  }
  function summarize(student) {
    const categories = criteria.map(([key, label]) => {
      const values = student.evaluations.map(e => e[key]).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
      const counts = levels.map((_, i) => values.filter(v => v === i + 1).length);
      return { key, label, counts, total: values.length, mean: average(values), satisfied: values.length ? (counts[3] + counts[4]) / values.length : 0 };
    });
    return { ...student, categories, mean: average(categories.flatMap(c => student.evaluations.map(e => e[c.key]).filter(v => Number.isInteger(v) && v >= 1 && v <= 5))) };
  }
  function summarizeSelection(students) {
    const classes = new Map();
    for (const student of students.map(summarize)) {
      const classLabel = student.classLabel || student.label?.replace(/\s*·\s*G\d+\s*$/, '') || 'Turma não informada';
      const groupNumber = student.groupNumber ?? student.label?.match(/·\s*G(\d+)\s*$/)?.[1] ?? '';
      if (!classes.has(classLabel)) classes.set(classLabel, { label: classLabel, students: [] });
      classes.get(classLabel).students.push({ ...student, classLabel, groupNumber });
    }
    const alphabetical = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });
    const groups = [...classes.values()].sort((a, b) => alphabetical(a.label, b.label));
    groups.forEach(group => group.students.sort((a, b) => alphabetical(a.name, b.name) || alphabetical(String(a.groupNumber), String(b.groupNumber))));
    const ordered = groups.flatMap(group => group.students);
    return { classes: groups, students: ordered, mean: average(ordered.map(student => student.mean)) };
  }
  function summaryPages(doc, selection, period) {
    function heading(continued) {
      doc.setFillColor('#173c38'); doc.rect(0, 0, 210, 7, 'F');
      doc.setTextColor('#173c38'); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('COLÉGIO CONTATO · STEM', 15, 18);
      doc.setFontSize(19); doc.text(continued ? 'Resumo dos alunos · continuação' : 'Resumo dos alunos', 15, 29);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(period, 15, 39);
      if (continued) return 51;
      doc.setFillColor('#eef5f3'); doc.roundedRect(15, 46, 180, 22, 3, 3, 'F');
      doc.setFontSize(10); doc.text('Média do recorte', 20, 54);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.text(`${format(selection.mean)} / 5`, 20, 64);
      doc.setFontSize(10);
      doc.text(`${selection.students.length} ${selection.students.length === 1 ? 'aluno' : 'alunos'} · ${selection.classes.length} ${selection.classes.length === 1 ? 'turma' : 'turmas'}`, 190, 59, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#475569');
      doc.text('Média das médias finais, com o mesmo peso para cada aluno.', 15, 77);
      return 90;
    }
    let y = heading(false);
    function classHeading(group, continued = false) {
      doc.setFillColor('#eef5f3'); doc.rect(15, y - 5, 180, 9, 'F');
      doc.setTextColor('#173c38'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(group.label + (continued ? ' · continuação' : ''), 18, y + 1);
      doc.setFontSize(9); doc.setTextColor('#475569');
      doc.text('Aluno', 15, y + 12); doc.text('Grupo', 160, y + 12, { align: 'center' }); doc.text('Média final', 195, y + 12, { align: 'right' });
      y += 18;
    }
    for (const group of selection.classes) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const firstHeight = Math.max(6, doc.splitTextToSize(group.students[0].name, 126).length * 4.2 + 1.8);
      if (y + 18 + firstHeight > 270) { doc.addPage(); y = heading(true); }
      classHeading(group);
      for (const student of group.students) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        const lines = doc.splitTextToSize(student.name, 126);
        const height = Math.max(6, lines.length * 4.2 + 1.8);
        if (y + height > 270) { doc.addPage(); y = heading(true); classHeading(group, true); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#173c38');
        doc.text(lines, 15, y); doc.text(String(student.groupNumber || '—'), 160, y, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.text(format(student.mean), 195, y, { align: 'right' });
        doc.setDrawColor('#e2e8e6'); doc.line(15, y + height - 3, 195, y + height - 3);
        y += height;
      }
      y += 4;
    }
  }
  function chart(student) {
    const canvas = document.createElement('canvas');
    canvas.width = 1440; canvas.height = 680;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1440, 680);
    ctx.fillStyle = '#173c38'; ctx.font = 'bold 32px Arial';
    ctx.fillText('Distribuição por categoria', 25, 50);
    levels.forEach((label, i) => {
      const x = 25 + (i % 3) * 460, y = 94 + Math.floor(i / 3) * 38;
      ctx.fillStyle = colors[i]; ctx.fillRect(x, y - 18, 22, 22);
      ctx.fillStyle = '#334155'; ctx.font = '22px Arial'; ctx.fillText(`${i + 1} · ${label}`, x + 34, y);
    });
    ctx.font = 'bold 21px Arial'; ctx.fillStyle = '#475569';
    ctx.fillText('Categoria', 25, 196); ctx.fillText('Distribuição das respostas', 365, 196);
    ctx.fillText('Média', 1170, 196); ctx.fillText('Notas 4–5', 1280, 196);
    student.categories.forEach((c, index) => {
      const y = 240 + index * 78;
      ctx.fillStyle = '#173c38'; ctx.font = '22px Arial'; ctx.fillText(c.label, 25, y + 28);
      let x = 365;
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(x, y, 755, 44);
      c.counts.forEach((count, i) => {
        if (!count) return;
        const width = count / c.total * 755;
        ctx.fillStyle = colors[i]; ctx.fillRect(x, y, width, 44);
        if (width > 72) {
          ctx.fillStyle = i === 0 || i === 4 ? '#ffffff' : '#18234b'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(count / c.total * 100)}%`, x + width / 2, y + 29); ctx.textAlign = 'left';
        }
        x += width;
      });
      ctx.fillStyle = '#173c38'; ctx.font = 'bold 23px Arial'; ctx.fillText(c.total ? format(c.mean) : '—', 1170, y + 29);
      ctx.fillText(c.total ? `${Math.round(c.satisfied * 100)}%` : '—', 1280, y + 29);
    });
    ctx.font = '20px Arial'; ctx.fillStyle = '#64748b';
    ctx.fillText(`Base: ${student.received} avaliações recebidas. Escala de 1 a 5.`, 25, 663);
    return canvas.toDataURL('image/png');
  }
  function download(data, type, filename) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pdf(students, period, filename, { summaryOnly = false } = {}) {
    if (!students.length) throw new Error('Não há alunos avaliados para exportar.');
    await library('jspdf', '/js/vendor/jspdf.umd.min.js');
    const doc = new root.jspdf.jsPDF({ compress: true });
    const selection = summarizeSelection(students);
    summaryPages(doc, selection, period);
    if (!summaryOnly) selection.students.forEach((s) => {
      doc.addPage();
      doc.setFillColor('#173c38'); doc.rect(0, 0, 210, 7, 'F');
      doc.setTextColor('#173c38'); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('COLÉGIO CONTATO · STEM', 15, 22);
      doc.setFontSize(19); doc.text('Acompanhamento por aluno', 15, 35);
      doc.setFontSize(15);
      const name = doc.splitTextToSize(s.name, 180); doc.text(name, 15, 50);
      const y = 53 + name.length * 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`${s.label} · ${period}`, 15, y);
      doc.text(`${s.received} avaliações recebidas · Notas 1 ou 2: ${s.values.filter(v => v <= 2).length}`, 15, y + 9);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text(`Média final: ${format(s.mean)} / 5`, 15, y + 24);
      doc.addImage(chart(s), 'PNG', 15, y + 34, 180, 85);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#475569');
      const note = 'A média final considera as notas recebidas nos cinco critérios. As barras mostram a proporção de cada nota por categoria; notas 4 e 5 indicam satisfação.';
      doc.text(doc.splitTextToSize(note, 180), 15, y + 133);
    });
    const created = new Date().toLocaleString('pt-BR');
    for (let page = 1; page <= doc.getNumberOfPages(); page++) {
      doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#475569');
      doc.text(`Gerado em ${created}`, 15, 282);
      doc.text(`Página ${page} de ${doc.getNumberOfPages()}`, 195, 282, { align: 'right' });
    }
    doc.save(filename + '.pdf');
  }
  async function excel(students, period, filename) {
    await library('ExcelJS', '/js/vendor/exceljs.min.js');
    const workbook = new root.ExcelJS.Workbook();
    workbook.creator = 'Colégio Contato'; workbook.created = new Date();
    const summary = workbook.addWorksheet('Médias por aluno');
    summary.addRow(['Acompanhamento por aluno · STEM · Colégio Contato']); summary.addRow([period]);
    summary.mergeCells('A1:J1'); summary.mergeCells('A2:J2'); summary.getRow(1).font = { bold: true, size: 16 }; summary.getRow(1).height = 30;
    summary.addRow(['Aluno', 'Equipe', 'Avaliações recebidas', 'Média final', ...criteria.map(([, label]) => label), 'Notas 1 ou 2']);
    for (const [index, raw] of students.entries()) {
      const s = summarize(raw);
      summary.addRow([s.name, s.label, s.received, s.mean, ...s.categories.map(c => c.mean), s.values.filter(v => v <= 2).length]);
      const sheet = workbook.addWorksheet(`Aluno ${index + 1}`);
      sheet.addRow([s.name]); sheet.addRow([s.label]); sheet.addRow([period]);
      sheet.mergeCells('A1:I1'); sheet.mergeCells('A2:I2'); sheet.mergeCells('A3:I3');
      sheet.getRow(1).font = { bold: true, size: 16 }; sheet.getRow(1).height = 45; sheet.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
      sheet.addRow(['Avaliações recebidas', s.received]); sheet.addRow(['Média final', s.mean]); sheet.getCell('B5').numFmt = '0.0';
      sheet.addRow([]);
      sheet.addRow(['Categoria', 'Média', 'Respostas', 'Notas 4–5', ...levels]);
      s.categories.forEach(c => sheet.addRow([c.label, c.mean, c.total, c.satisfied, ...c.counts]));
      for (let row = 8; row <= 12; row++) { sheet.getCell(row, 2).numFmt = '0.0'; sheet.getCell(row, 4).numFmt = '0%'; }
      sheet.addRow(['As cinco últimas colunas mostram a quantidade de respostas de cada nota (1 a 5).']);
      sheet.mergeCells('A13:I13');
      const imageId = workbook.addImage({ base64: chart(s), extension: 'png' });
      sheet.addImage(imageId, { tl: { col: 0, row: 15 }, ext: { width: 1080, height: 510 } });
      sheet.columns.forEach((column, n) => column.width = n === 0 ? 36 : 23);
      sheet.views = [{ state: 'frozen', ySplit: 7 }];
      sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: 'A1:I43' };
      styleHeader(sheet.getRow(7));
    }
    summary.columns.forEach((column, i) => { column.width = i < 2 ? 38 : 25; if (i >= 3 && i <= 8) column.numFmt = '0.0'; });
    summary.autoFilter = { from: 'A3', to: `J${students.length + 3}` }; summary.views = [{ state: 'frozen', ySplit: 3 }];
    styleHeader(summary.getRow(3));
    download(await workbook.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename + '.xlsx');
  }
  function styleHeader(row) { row.font = { bold: true, color: { argb: 'FFFFFFFF' } }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173C38' } }; row.height = 32; row.alignment = { vertical: 'middle', wrapText: true }; }
  const api = { summarize, summarizeSelection, pdf, excel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudentReports = api;
})(typeof window !== 'undefined' ? window : globalThis);
