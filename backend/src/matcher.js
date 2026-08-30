/* Matcher Agent - correlacao sem IA (regras deterministicas, custo zero) */

function clean(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function tokens(s) {
  return new Set(clean(s).replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean));
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}
function numOf(s) {
  const m = String(s || '').match(/(\d+([.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}
function potenciaClose(a, b) {
  const x = numOf(a), y = numOf(b);
  if (x == null || y == null) return true;
  return Math.abs(x - y) / Math.max(x, y) <= 0.1; // 10%
}

/**
 * @param extracted dados da IA
 * @param expectedList lista previa
 * @param hintCodigo codigo escolhido pelo perito na captura (opcional)
 */
export function matchAsset(extracted, expectedList, hintCodigo) {
  let cand = null;
  if (hintCodigo) cand = expectedList.find((e) => clean(e.codigo) === clean(hintCodigo)) || null;

  if (!cand) {
    let best = 0;
    for (const e of expectedList) {
      const score =
        0.5 * jaccard(`${e.fabricante} ${e.modelo}`, `${extracted.fabricante} ${extracted.modelo}`) +
        0.3 * jaccard(e.descricao, `${extracted.fabricante} ${extracted.modelo}`) +
        0.2 * (potenciaClose(e.potencia, extracted.potencia) ? 1 : 0);
      if (score > best) { best = score; cand = e; }
    }
    if (best < 0.35) cand = null;
  }

  if (!cand) {
    return { status: 'novo', statusLabel: 'Novo Ativo', matched: null, divergencias: [] };
  }

  const divergencias = [];
  const cmp = [
    ['fabricante', cand.fabricante, extracted.fabricante, (a, b) => jaccard(a, b) >= 0.5],
    ['modelo', cand.modelo, extracted.modelo, (a, b) => jaccard(a, b) >= 0.4],
    ['potencia', cand.potencia, extracted.potencia, potenciaClose],
    ['voltagem', cand.voltagem, extracted.voltagem, (a, b) => !a || !b || jaccard(a, b) >= 0.3],
    ['rpm', cand.rpm, extracted.rpm, (a, b) => { const x = numOf(a), y = numOf(b); return x == null || y == null || Math.abs(x - y) <= 120; }],
  ];
  for (const [campo, esperado, lido, ok] of cmp) {
    if (esperado && lido && !ok(esperado, lido)) {
      divergencias.push(`${campo}: cadastro "${esperado}" vs lido "${lido}"`);
    }
  }

  const status = divergencias.length ? 'divergente' : 'confirmado';
  return {
    status,
    statusLabel: status === 'divergente' ? 'Divergente' : 'Confirmado',
    matched: cand,
    divergencias,
  };
}
