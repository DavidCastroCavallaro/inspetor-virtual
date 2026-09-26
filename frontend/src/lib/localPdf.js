/* Relatorio executivo PDF — versao STANDALONE (roda no navegador via jsPDF).
   Mesmo conteudo do backend/src/report.js, adaptado pro layout manual do jsPDF
   (que nao tem fluxo automatico de texto/paginas como o pdfkit). */
import { jsPDF } from 'jspdf';

const PAGE_H = 841.89; // A4 em pt
const MARGIN = 40;
const BOTTOM = PAGE_H - MARGIN;

export function buildReportPdfBlob(results) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = MARGIN;

  const total = results.length;
  const by = (s) => results.filter((r) => r.status === s).length;

  const line = (text, size, color, gap = size * 1.3) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, MARGIN, y);
    y += gap;
  };
  const ensureSpace = (needed) => {
    if (y + needed > BOTTOM) { doc.addPage(); y = MARGIN; }
  };

  line('Relatório Executivo de Vistoria', 20, [0, 0, 0], 26);
  line(`Inspetor Virtual  •  Emitido em ${new Date().toLocaleString('pt-BR')}`, 10, [85, 85, 85], 20);

  line('Resumo', 13, [0, 0, 0], 18);
  doc.setFontSize(10);
  line(`Ativos processados: ${total}`, 10, [0, 0, 0], 14);
  line(`Confirmados: ${by('confirmado')}   |   Divergentes: ${by('divergente')}   |   Novos: ${by('novo')}`, 10, [0, 0, 0], 14);
  const vidaMedia = total ? (results.reduce((a, r) => a + (r.vidaRemanescenteAnos || 0), 0) / total).toFixed(1) : 0;
  const depMedia = total ? (results.reduce((a, r) => a + (r.depreciacaoPct || 0), 0) / total).toFixed(1) : 0;
  line(`Vida remanescente média: ${vidaMedia} anos   |   Depreciação média: ${depMedia}%`, 10, [0, 0, 0], 22);

  line('Ativos', 13, [0, 0, 0], 20);

  results.forEach((r, i) => {
    ensureSpace(70);
    line(`${i + 1}. [${r.statusLabel}] ${r.codigo} — ${r.fabricante} ${r.modelo}`.trim(), 11, [0, 0, 0], 14);
    line(`Descrição: ${r.descricao || '-'}   •   Localização: ${r.localizacao || '-'}`, 9, [51, 51, 51], 12);
    line(`Potência: ${r.potencia || '-'}   RPM: ${r.rpm || '-'}   Voltagem: ${r.voltagem || '-'}   Série: ${r.numeroSerie || '-'}`, 9, [51, 51, 51], 12);
    line(`Condição (IA): ${r.condicao || '-'}${r.estadoConservacao ? '   •   Estado observado: ' + r.estadoConservacao.toUpperCase() : ''}   •   Vida útil total: ${r.vidaUtilTotalAnos}a (${r.vidaUtilOrigem === 'manual' ? 'informada' : r.vidaUtilOrigem === 'ia' ? 'IA' : 'tabela'})   •   Idade: ${r.idadeAnos}a   •   Remanescente: ${r.vidaRemanescenteAnos}a   •   Depreciação: ${r.depreciacaoPct}%`, 9, [51, 51, 51], 12);
    if (r.divergencias?.length) line(`Divergências: ${r.divergencias.join('; ')}`, 9, [180, 83, 9], 12);
    if (r.observacao) line(`Obs. perito: ${r.observacao}`, 9, [29, 78, 216], 12);
    y += 8;
  });

  return doc.output('blob');
}
