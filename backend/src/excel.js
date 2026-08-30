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
};

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

export function parseExpectedXlsx(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  return rows.map((raw, i) => {
    const item = { rpm: '', voltagem: '', ano: '' };
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_MAP[norm(k)];
      if (key) item[key] = typeof v === 'string' ? v.trim() : v;
    }
    if (!item.codigo) item.codigo = `LINHA-${i + 1}`;
    return {
      codigo: String(item.codigo),
      descricao: item.descricao || '',
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
    'Status': r.statusLabel,
    'Descrição': r.descricao,
    'Fabricante': r.fabricante,
    'Modelo': r.modelo,
    'Potência': r.potencia,
    'RPM': r.rpm,
    'Voltagem': r.voltagem,
    'N° Série': r.numeroSerie,
    'Condição': r.condicao,
    'Localização': r.localizacao,
    'Vida Útil Total (anos)': r.vidaUtilTotalAnos,
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
