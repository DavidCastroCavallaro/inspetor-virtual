// Evita repetir texto quando o codigo foi derivado da propria descricao
// (ativo sem Codigo/Patrimonio na planilha original).
export function titulo(codigo, descricao) {
  if (!descricao || descricao === codigo) return codigo;
  return `${codigo} — ${descricao}`;
}
