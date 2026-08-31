import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Sparkles, BookOpen } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { VocabTag } from '../types';

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWord?: string;
}

export const AddWordModal: React.FC<AddWordModalProps> = ({ isOpen, onClose, initialWord = '' }) => {
  const { addCustomWord } = useAppStore();

  const [word, setWord] = useState(initialWord);
  const [ipa, setIpa] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('noun');
  const [meaning, setMeaning] = useState('');
  const [definitionEn, setDefinitionEn] = useState('');
  const [example, setExample] = useState('');
  const [exampleMeaning, setExampleMeaning] = useState('');
  const [tag, setTag] = useState<VocabTag>('IELTS');
  const [collocationsStr, setCollocationsStr] = useState('');

  // Cập nhật word khi initialWord thay đổi
  useEffect(() => {
    if (initialWord) {
      setWord(initialWord);
    }
  }, [initialWord, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;

    addCustomWord({
      word: word.trim(),
      ipa: ipa.trim() || '/.../',
      partOfSpeech,
      meaning: meaning.trim(),
      definitionEn: definitionEn.trim() || meaning.trim(),
      example: example.trim() || `The word "${word.trim()}" is useful.`,
      exampleMeaning: exampleMeaning.trim() || 'Ví dụ minh họa cho từ vựng.',
      tag,
      collocations: collocationsStr ? collocationsStr.split(',').map((s) => s.trim()) : [],
    });

    // Reset form
    setWord('');
    setIpa('');
    setMeaning('');
    setDefinitionEn('');
    setExample('');
    setExampleMeaning('');
    setCollocationsStr('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Thêm Từ Vựng Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Từ vựng tiếng Anh *</label>
              <input
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="vd: Innovation"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phiên âm IPA</label>
              <input
                type="text"
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
                placeholder="vd: /ˌɪn.əˈveɪ.ʃən/"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Từ loại</label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="noun">Danh từ (noun)</option>
                <option value="verb">Động từ (verb)</option>
                <option value="adjective">Tính từ (adjective)</option>
                <option value="adverb">Trạng từ (adverb)</option>
                <option value="phrase">Cụm từ (phrase)</option>
                <option value="idiom">Thành ngữ (idiom)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Chủ đề / Tag</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as VocabTag)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="IELTS">IELTS</option>
                <option value="TOEIC">TOEIC</option>
                <option value="Business">Business</option>
                <option value="Academic">Academic</option>
                <option value="Daily">Daily Oxford</option>
                <option value="Idioms">Idioms</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Định nghĩa tiếng Việt *</label>
            <input
              type="text"
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="vd: Sự đổi mới, sáng kiến cải tiến công nghệ..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Giải nghĩa tiếng Anh</label>
            <input
              type="text"
              value={definitionEn}
              onChange={(e) => setDefinitionEn(e.target.value)}
              placeholder="vd: The action or process of innovating."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Câu ví dụ tiếng Anh</label>
            <textarea
              rows={2}
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="vd: Continuous innovation is key to staying competitive in tech."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Dịch nghĩa câu ví dụ</label>
            <input
              type="text"
              value={exampleMeaning}
              onChange={(e) => setExampleMeaning(e.target.value)}
              placeholder="vd: Đổi mới liên tục là chìa khóa để duy trì vị thế cạnh tranh."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Cụm từ thường gặp (cách nhau bởi dấu phẩy)</label>
            <input
              type="text"
              value={collocationsStr}
              onChange={(e) => setCollocationsStr(e.target.value)}
              placeholder="vd: technological innovation, drive innovation, rapid innovation"
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              Lưu từ vựng (+15 XP)
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
