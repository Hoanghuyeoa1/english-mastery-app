import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Table, 
  Trash2,
  HelpCircle
} from 'lucide-react';
import { triggerCelebration } from '../utils/confettiPolicy';
import { useAppStore } from '../store/useAppStore';
import { VocabTag, VocabWord } from '../types';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedWordRow {
  word: string;
  ipa: string;
  partOfSpeech: string;
  meaning: string;
  definitionEn: string;
  example: string;
  exampleMeaning: string;
  tag: VocabTag;
  isValid: boolean;
  error?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose }) => {
  const { addBatchWords } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<'paste' | 'upload'>('paste');
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedWordRow[]>([]);
  const [defaultTag, setDefaultTag] = useState<VocabTag>('IELTS');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Parser thông minh: Phân tích các dòng CSV / TSV / Semicolon
  const parseCSVContent = (text: string, tagFallback: VocabTag): ParsedWordRow[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: ParsedWordRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Bỏ qua dòng tiêu đề nếu có
      if (i === 0 && (line.toLowerCase().startsWith('word') || line.toLowerCase().startsWith('từ vựng'))) {
        continue;
      }

      // Nhận diện delimiter: tab, semicolon, hoặc comma
      let delimiter = ',';
      if (line.includes('\t')) delimiter = '\t';
      else if (line.includes(';') && !line.includes(',')) delimiter = ';';

      // Parse line with regex to handle quotes
      const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`, 'g');
      const cells: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let cell = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        cells.push((cell || '').trim());
      }

      // Clean empty last cell if regex artifacts
      if (cells.length > 0 && cells[0] === '' && line.startsWith(delimiter)) {
        // preserve
      }

      const word = cells[0] || '';
      const ipa = cells[1] || '/.../';
      const meaning = cells[2] || '';
      const example = cells[3] || `The word "${word}" is commonly used.`;
      const exampleMeaning = cells[4] || 'Câu ví dụ minh họa.';
      const rowTag = (cells[5] as VocabTag) || tagFallback;

      const isValid = Boolean(word && meaning);

      results.push({
        word,
        ipa: ipa.startsWith('/') ? ipa : `/${ipa}/`,
        partOfSpeech: 'noun',
        meaning,
        definitionEn: meaning,
        example,
        exampleMeaning,
        tag: ['IELTS', 'TOEIC', 'Business', 'Academic', 'Daily', 'Idioms'].includes(rowTag) ? rowTag : tagFallback,
        isValid,
        error: !word ? 'Thiếu từ vựng' : !meaning ? 'Thiếu định nghĩa tiếng Việt' : undefined,
      });
    }

    return results;
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    const parsed = parseCSVContent(text, defaultTag);
    setParsedRows(parsed);
    setImportStatus(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);
      const parsed = parseCSVContent(content, defaultTag);
      setParsedRows(parsed);
      setImportStatus(null);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sampleCSV = `word,ipa,meaning,example,exampleMeaning,tag
Perseverance,/ˌpɜː.sɪˈvɪə.rəns/,Sự kiên trì bền bỉ,"Success requires perseverance and dedication.","Thành công đòi hỏi sự kiên trì và tận tâm.",IELTS
Collaborate,/kəˈlæb.ə.reɪt/,Hợp tác cùng làm việc,"The teams collaborate closely on new AI features.","Các nhóm hợp tác chặt chẽ về các tính năng AI mới.",Business
Synthesize,/ˈsɪn.θə.saɪz/,Tổng hợp thông tin,"Students must synthesize multiple research sources.","Học sinh cần tổng hợp nhiều nguồn nghiên cứu.",Academic
Procrastinate,/prəʊˈkræs.tɪ.neɪt/,Trì hoãn công việc,"Do not procrastinate on your daily study plan.","Đừng trì hoãn kế hoạch học tập hàng ngày.",Daily`;

    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_tu_vung_english.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommitImport = () => {
    const validWords = parsedRows.filter((r) => r.isValid);
    if (!validWords.length) return;

    const addedCount = addBatchWords(
      validWords.map((r) => ({
        word: r.word,
        ipa: r.ipa,
        partOfSpeech: r.partOfSpeech,
        meaning: r.meaning,
        definitionEn: r.definitionEn,
        example: r.example,
        exampleMeaning: r.exampleMeaning,
        tag: r.tag,
      }))
    );

    triggerCelebration('completion');

    setImportStatus(`Đã thêm thành công ${addedCount} từ vựng mới vào kho!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn motion-reduce:animate-none">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-scaleIn motion-reduce:animate-none"
      >
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 id="bulk-import-modal-title" className="text-xl font-bold text-white">Nhập Hàng Loạt Từ Vựng (Bulk CSV)</h3>
              <p className="text-xs text-slate-400">Thêm nhanh hàng chục hoặc hàng trăm từ vựng cùng lúc</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-850 p-2 rounded-2xl border border-slate-800">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveMode('paste')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'paste'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dán văn bản (Paste Text)
            </button>
            <button
              onClick={() => setActiveMode('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'upload'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tải file CSV
            </button>
          </div>

          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải CSV mẫu</span>
          </button>
        </div>

        {/* Mode 1: Paste CSV text */}
        {activeMode === 'paste' ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="font-semibold">Định dạng mỗi dòng:</span>
              <span className="font-mono text-emerald-400">word, ipa, meaning, example</span>
            </div>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`vd:\nPerseverance, /ˌpɜː.sɪˈvɪə.rəns/, Sự kiên trì bền bỉ, "Success requires perseverance."\nCollaborate, /kəˈlæb.ə.reɪt/, Hợp tác làm việc, "Teams collaborate closely."`}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-2xl p-4 text-xs sm:text-sm font-mono text-white placeholder-slate-600 focus:outline-none"
            />
          </div>
        ) : (
          /* Mode 2: Upload CSV File */
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-bold text-white">Bấm để chọn file .CSV hoặc .TXT từ máy tính</p>
            <p className="text-xs text-slate-500 mt-1">Hỗ trợ mã hóa UTF-8 tiếng Việt chuẩn xác</p>
          </div>
        )}

        {/* Fallback Tag Selector */}
        <div className="flex items-center gap-3 bg-slate-850 p-3 rounded-2xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-400">Chủ đề mặc định:</span>
          <select
            value={defaultTag}
            onChange={(e) => {
              const newTag = e.target.value as VocabTag;
              setDefaultTag(newTag);
              if (rawText) {
                setParsedRows(parseCSVContent(rawText, newTag));
              }
            }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="IELTS">IELTS</option>
            <option value="TOEIC">TOEIC</option>
            <option value="Business">Business</option>
            <option value="Academic">Academic</option>
            <option value="Daily">Daily Oxford</option>
            <option value="Idioms">Idioms</option>
          </select>
        </div>

        {/* Live Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Table className="w-4 h-4 text-emerald-400" />
                Xem trước dữ liệu ({validCount}/{parsedRows.length} từ hợp lệ)
              </span>
              {validCount < parsedRows.length && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {parsedRows.length - validCount} dòng lỗi
                </span>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Trạng thái</th>
                    <th className="p-2.5">Từ vựng</th>
                    <th className="p-2.5">IPA</th>
                    <th className="p-2.5">Nghĩa tiếng Việt</th>
                    <th className="p-2.5">Chủ đề</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? 'hover:bg-slate-900' : 'bg-red-500/10'}>
                      <td className="p-2.5">
                        {row.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] text-red-400 font-bold">{row.error}</span>
                        )}
                      </td>
                      <td className="p-2.5 font-bold text-white">{row.word || '—'}</td>
                      <td className="p-2.5 font-mono text-emerald-400">{row.ipa}</td>
                      <td className="p-2.5 text-slate-300 max-w-[150px] truncate">{row.meaning || '—'}</td>
                      <td className="p-2.5 text-slate-400">{row.tag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Status banner */}
        {importStatus && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 font-bold text-sm flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              setRawText('');
              setParsedRows([]);
            }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa nội dung</span>
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={validCount === 0}
              onClick={handleCommitImport}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Thêm {validCount} từ vào kho (+{Math.min(200, validCount * 10)} XP)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
