import xlsx from 'xlsx';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rows = [
  ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Potência', 'RPM', 'Voltagem', 'Ano', 'Localização Esperada'],
  ['MOT-001', 'Motor elétrico de indução trifásico', 'WEG', 'W22 IR3 Premium', '15 cv', '3540', '380/660 V', '2016', 'Casa de Bombas - Nível 1'],
  ['MOT-002', 'Motor elétrico de indução trifásico', 'WEG', 'W21', '10 cv', '1760', '220/380 V', '2012', 'Linha de Envase A'],
  ['MOT-003', 'Motor elétrico alta rotação', 'Siemens', '1LE0', '20 cv', '1780', '380 V', '2018', 'Torre de Resfriamento'],
  ['CMP-001', 'Compressor de ar parafuso', 'Atlas Copco', 'GA 30', '40 cv', '2970', '440 V', '2010', 'Central de Ar Comprimido'],
  ['CMP-002', 'Compressor de ar pistão', 'Schulz', 'MSV 40 MAX', '10 cv', '1150', '220 V', '2009', 'Oficina de Manutenção'],
  ['BMB-001', 'Bomba centrífuga de recalque', 'KSB', 'Meganorm 50-160', '7,5 cv', '3480', '380 V', '2015', 'Casa de Bombas - Nível 2'],
  ['BMB-002', 'Bomba centrífuga de processo', 'Grundfos', 'NB 65-200', '25 cv', '1750', '440 V', '2019', 'Sala de Processo B'],
  ['TRF-001', 'Transformador a seco', 'ABB', 'RESIBLOC 750', '750 kVA', '', '13,8 kV / 380 V', '2011', 'Subestação Principal'],
  ['TRF-002', 'Transformador óleo', 'WEG', 'TTD 300', '300 kVA', '', '13,8 kV / 220 V', '2008', 'Subestação Auxiliar'],
  ['VNT-001', 'Ventilador industrial axial', 'Otam', 'AXN 900', '30 cv', '1170', '380 V', '2017', 'Exaustão Galpão 3'],
  ['RED-001', 'Redutor de velocidade', 'SEW', 'R107', '—', '—', '—', '2014', 'Transportador TC-05'],
  ['GER-001', 'Grupo gerador diesel standby', 'Stemac', 'ST 250', '250 kVA', '1800', '380 V', '2013', 'Casa de Força'],
];

const ws = xlsx.utils.aoa_to_sheet(rows);
ws['!cols'] = [{ wch: 10 }, { wch: 38 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 7 }, { wch: 28 }];
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Ativos Esperados');

const out = join(__dirname, '..', 'data', 'ativos_exemplo.xlsx');
xlsx.writeFile(wb, out);
console.log('Planilha de exemplo criada:', out);
