import xlsx from 'xlsx';

// Mapeia cabecalhos PT-BR variados -> chaves internas
const HEADER_MAP = {
  codigo: 'codigo', 'código': 'codigo', code: 'codigo', tag: 'codigo',
  descricao: 'descricao', 'descrição': 'descricao', description: 'descricao',
  fabricante: 'fabricante', manufacturer: 'fabricante', marca: 'fabricante',
  modelo: 'modelo', model: 'modelo',
  potencia: 'potencia', 'potência': 'potencia', power: 'potencia', cv: 'potencia', kw: 'potencia',
  'localizacao esperada': 'localizacao', 'localização esperada': 'localizacao',
  localizacao: 'localizacao', 'localização': 'localizacao', local: 'localizacao', location: 'localizacao',
  rpm: 'rpm', voltagem: 'voltagem', tensao: 'voltagem', 'tensão': 'voltagem',
  ano: 'ano', year: 'ano', 'ano fabricacao': 'ano', 'ano de fabricação': 'ano',

  // identificador patrimonial (numero de tombamento/inventario do ativo fixo)
  patrimonio: 'patrimonio', 'patrimônio': 'patrimonio',
  patrimonial: 'patrimonio', 'bem patrimonial': 'patrimonio',
  'numero patrimonial': 'patrimonio', 'número patrimonial': 'patrimonio',
  'n patrimonial': 'patrimonio', 'no patrimonial': 'patrimonio',
  'ativo n': 'patrimonio', 'ativo no': 'patrimonio',
  'ativo numero': 'patrimonio', 'ativo número': 'patrimonio',
  'numero do ativo': 'patrimonio', 'número do ativo': 'patrimonio',
  'n do ativo': 'patrimonio', 'no do ativo': 'patrimonio',
  inventario: 'patrimonio', 'inventário': 'patrimonio',
  'n inventario': 'patrimonio', 'n inventário': 'patrimonio',
  'numero inventario': 'patrimonio', 'número inventário': 'patrimonio',
  tombamento: 'patrimonio', 'n tombamento': 'patrimonio',
  plaqueta: 'patrimonio', 'n plaqueta': 'patrimonio',
};

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[º°]/g, '')
    .replace(/\s+/g, ' ');
}

export function parseExpectedXlsx(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

  const used = new Set();
  return rows.map((raw, i) => {
    const item = { rpm: '', voltagem: '', ano: '', patrimonio: '' };
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_MAP[norm(k)];
      if (key) item[key] = typeof v === 'string' ? v.trim() : v;
    }
    item.descricao = String(item.descricao || '').trim();
    item.patrimonio = String(item.patrimonio || '').trim();

    // identificador: codigo explicito -> patrimonio -> descricao -> ultimo recurso
    let codigo = String(item.codigo || '').trim() || item.patrimonio || item.descricao || `Linha ${i + 1}`;
    // evita colisao (ex: duas linhas com a mesma descricao e sem codigo/patrimonio)
    if (used.has(codigo.toLowerCase())) {
      let n = 2;
      while (used.has(`${codigo} (${n})`.toLowerCase())) n++;
      codigo = `${codigo} (${n})`;
    }
    used.add(codigo.toLowerCase());

    return {
      codigo,
      descricao: item.descricao,
      patrimonio: item.patrimonio,
      fabricante: item.fabricante || '',
      modelo: item.modelo || '',
      potencia: String(item.potencia || ''),
      rpm: String(item.rpm || ''),
      voltagem: String(item.voltagem || ''),
      ano: String(item.ano || ''),
      localizacao: item.localizacao || '',
    };
  });
}

export function buildInventoryXlsx(results) {
  const data = results.map((r) => ({
    'Código': r.codigo,
    'Patrimônio': r.patrimonio,
    'Status': r.statusLabel,
    'Descrição': r.descricao,
    'Fabricante': r.fabricante,
    'Modelo': r.modelo,
    'Potência': r.potencia,
    'RPM': r.rpm,
    'Voltagem': r.voltagem,
    'N° Série': r.numeroSerie,
    'Condição (IA)': r.condicao,
    'Estado de Conservação': r.estadoConservacao ? r.estadoConservacao.toUpperCase() : '',
    'Localização': r.localizacao,
    'Vida Útil Total (anos)': r.vidaUtilTotalAnos,
    'Origem Vida Útil': r.vidaUtilOrigem === 'manual' ? 'Informada' : r.vidaUtilOrigem === 'ia' ? 'IA' : 'Tabela IBAPE',
    'Idade Estimada (anos)': r.idadeAnos,
    'Vida Remanescente (anos)': r.vidaRemanescenteAnos,
    'Depreciação (%)': r.depreciacaoPct,
    'Divergências': (r.divergencias || []).join('; '),
    'Observação Perito': r.observacao,
  }));
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Inventário Final');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
