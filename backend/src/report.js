import PDFDocument from 'pdfkit';

export function buildReportPdf(results, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  const total = results.length;
  const by = (s) => results.filter((r) => r.status === s).length;

  doc.fontSize(20).text('Relatório Executivo de Vistoria', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555')
    .text(`Inspetor Virtual  •  Emitido em ${new Date().toLocaleString('pt-BR')}`);
  doc.fillColor('#000').moveDown(1);

  doc.fontSize(13).text('Resumo');
  doc.fontSize(10).moveDown(0.3);
  doc.text(`Ativos processados: ${total}`);
  doc.text(`Confirmados: ${by('confirmado')}   |   Divergentes: ${by('divergente')}   |   Novos: ${by('novo')}`);
  const vidaMedia = total ? (results.reduce((a, r) => a + (r.vidaRemanescenteAnos || 0), 0) / total).toFixed(1) : 0;
  const depMedia = total ? (results.reduce((a, r) => a + (r.depreciacaoPct || 0), 0) / total).toFixed(1) : 0;
  doc.text(`Vida remanescente média: ${vidaMedia} anos   |   Depreciação média: ${depMedia}%`);
  doc.moveDown(1);

  doc.fontSize(13).text('Ativos');
  doc.moveDown(0.5);

  results.forEach((r, i) => {
    if (doc.y > 720) doc.addPage();
    doc.fontSize(11).fillColor('#000')
      .text(`${i + 1}. [${r.statusLabel}] ${r.codigo} — ${r.fabricante} ${r.modelo}`.trim());
    doc.fontSize(9).fillColor('#333');
    doc.text(`Descrição: ${r.descricao || '-'}   •   Localização: ${r.localizacao || '-'}`);
    doc.text(`Potência: ${r.potencia || '-'}   RPM: ${r.rpm || '-'}   Voltagem: ${r.voltagem || '-'}   Série: ${r.numeroSerie || '-'}`);
    doc.text(`Condição (IA): ${r.condicao || '-'}${r.estadoConservacao ? '   •   Estado observado: ' + r.estadoConservacao.toUpperCase() : ''}   •   Vida útil total: ${r.vidaUtilTotalAnos}a (${r.vidaUtilOrigem === 'manual' ? 'informada' : r.vidaUtilOrigem === 'ia' ? 'IA' : 'tabela'})   •   Idade: ${r.idadeAnos}a   •   Remanescente: ${r.vidaRemanescenteAnos}a   •   Depreciação: ${r.depreciacaoPct}%`);
    if (r.divergencias?.length) doc.fillColor('#b45309').text(`Divergências: ${r.divergencias.join('; ')}`);
    if (r.observacao) doc.fillColor('#1d4ed8').text(`Obs. perito: ${r.observacao}`);
    doc.fillColor('#000').moveDown(0.6);
  });

  doc.end();
}
