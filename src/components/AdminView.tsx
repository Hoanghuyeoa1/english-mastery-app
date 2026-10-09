import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  BookOpen,
  Users,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Sparkles,
  Lock,
  ArrowRight,
  Save,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useIsAdmin } from '../utils/adminAuth';
import { useCloudSyncStore } from '../services/cloudSyncService';
import { useAppStore } from '../store/useAppStore';
import {
  fetchCloudVocabularies,
  addCloudVocabulary,
  updateCloudVocabulary,
  deleteCloudVocabulary,
  fetchRegisteredProfiles,
  resetAllUsersProgress,
  resetTargetUsersProgress,
} from '../services/adminVocabService';
import { speakWord } from '../services/speechService';
import type { CloudVocabulary, AdminUserProfile, ActiveTab, VocabTag } from '../types';

interface AdminViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onOpenAuth?: () => void;
}

const CATEGORY_OPTIONS: VocabTag[] = [
  'Daily',
  'Academic',
  'Business',
  'Tech',
  'TOEIC',
  'IELTS',
  'Idioms',
];

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const AdminView: React.FC<AdminViewProps> = ({ onNavigate, onOpenAuth }) => {
  const isAdmin = useIsAdmin();
  const { userEmail, userId: currentUserId } = useCloudSyncStore();
  const { vocabularyList, audioVoice, audioSpeed } = useAppStore();

  const [activeAdminTab, setActiveAdminTab] = useState<'add_vocab' | 'vocab_list' | 'users' | 'danger_zone'>('add_vocab');

  // Danger zone reset state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Per-user reset state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [targetResetUser, setTargetResetUser] = useState<{ id: string; name: string } | null>(null);
  const [isTargetResetModalOpen, setIsTargetResetModalOpen] = useState(false);
  const [isProcessingTargetReset, setIsProcessingTargetReset] = useState(false);

  // Cloud data state
  const [cloudVocabs, setCloudVocabs] = useState<CloudVocabulary[]>([]);
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add form state
  const [newWord, setNewWord] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newCategory, setNewCategory] = useState<VocabTag>('Daily');
  const [newLevel, setNewLevel] = useState('B1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<CloudVocabulary | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editPhonetic, setEditPhonetic] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editExample, setEditExample] = useState('');
  const [editCategory, setEditCategory] = useState('Daily');
  const [editLevel, setEditLevel] = useState('B1');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const loadData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [vocabRes, profRes] = await Promise.all([
        fetchCloudVocabularies(),
        fetchRegisteredProfiles(),
      ]);

      if (vocabRes.error) {
        console.warn('Vocab fetch error:', vocabRes.error);
      } else {
        setCloudVocabs(vocabRes.data);
      }

      if (profRes.error) {
        console.warn('Profiles fetch error:', profRes.error);
      } else {
        setProfiles(profRes.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Handle Add Form Submission
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập từ vựng và nghĩa tiếng Việt.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await addCloudVocabulary({
      word: newWord.trim(),
      phonetic: newPhonetic.trim(),
      meaning: newMeaning.trim(),
      example: newExample.trim(),
      category: newCategory,
      level: newLevel,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFeedback({ type: 'error', message: `Lỗi lưu từ vựng: ${res.error}` });
    } else {
      setFeedback({
        type: 'success',
        message: `Đã lưu thành công từ "${newWord.trim()}" vào kho từ vựng hệ thống! Tất cả học viên đã có thể tải về học.`,
      });
      // Reset form
      setNewWord('');
      setNewPhonetic('');
      setNewMeaning('');
      setNewExample('');
      // Reload list
      loadData();
    }
  };

  // Open Edit Modal
  const handleStartEdit = (item: CloudVocabulary) => {
    setEditingItem(item);
    setEditWord(item.word);
    setEditPhonetic(item.phonetic || '');
    setEditMeaning(item.meaning);
    setEditExample(item.example || '');
    setEditCategory(item.category || 'Daily');
    setEditLevel(item.level || 'B1');
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    const res = await updateCloudVocabulary(editingItem.id, {
      word: editWord.trim(),
      phonetic: editPhonetic.trim(),
      meaning: editMeaning.trim(),
      example: editExample.trim(),
      category: editCategory,
      level: editLevel,
    });
    setIsSubmitting(false);

    if (res.error) {
      alert(`Lỗi cập nhật: ${res.error}`);
    } else {
      setEditingItem(null);
      loadData();
    }
  };

  // Handle Delete
  const handleDeleteItem = async (id: string, word: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa từ vựng "${word}" khỏi kho từ vựng hệ thống?`)) {
      return;
    }

    const res = await deleteCloudVocabulary(id, word);
    if (res.error) {
      alert(`Lỗi xóa từ vựng: ${res.error}`);
    } else {
      loadData();
    }
  };

  // Danger Zone: Execute Reset All Users Progress
  const handleExecuteResetAll = async () => {
    if (resetInputText.trim() !== 'RESET ALL') return;

    setIsResetting(true);
    setFeedback(null);

    const res = await resetAllUsersProgress();
    setIsResetting(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Đã reset toàn bộ tiến trình học của tất cả tài khoản thành công! Đang làm mới dữ liệu...',
      });
      setIsResetModalOpen(false);
      setResetInputText('');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      setFeedback({
        type: 'error',
        message: `Lỗi reset dữ liệu: ${res.error}`,
      });
    }
  };

  // Per-User Reset Execution
  const handleExecuteTargetReset = async () => {
    const idsToReset = targetResetUser ? [targetResetUser.id] : selectedUserIds;
    if (idsToReset.length === 0) return;

    setIsProcessingTargetReset(true);
    setFeedback(null);

    const res = await resetTargetUsersProgress(idsToReset, currentUserId, userEmail);
    setIsProcessingTargetReset(false);
    setIsTargetResetModalOpen(false);
    setTargetResetUser(null);
    setSelectedUserIds([]);

    if (res.success) {
      if (res.isCurrentAdminReset) {
        setFeedback({
          type: 'success',
          message: 'Đã reset tiến trình của tài khoản Admin thành công! Đang tải lại trang...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setFeedback({
          type: 'success',
          message: `Đã reset tiến trình của ${idsToReset.length} tài khoản thành công!`,
        });
        loadData();
      }
    } else {
      setFeedback({
        type: 'error',
        message: `Lỗi reset tài khoản: ${res.error}`,
      });
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const displayProfiles = useMemo(() => {
    let list = [...profiles];

    if (currentUserId && !list.some((p) => p.id === currentUserId)) {
      list.unshift({
        id: currentUserId,
        display_name: userEmail ? `${userEmail} (Admin)` : 'Current Admin',
        level: useAppStore.getState().profile.level || 1,
        xp: useAppStore.getState().profile.xp || 0,
        streak: useAppStore.getState().profile.streak ?? 0,
        updated_at: new Date().toISOString(),
      });
    }

    if (userSearchTerm.trim()) {
      const q = userSearchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.display_name && p.display_name.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [profiles, userEmail, currentUserId, userSearchTerm]);

  const toggleSelectAllUsers = () => {
    if (selectedUserIds.length === displayProfiles.length && displayProfiles.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(displayProfiles.map((p) => p.id));
    }
  };

  // Filtered Vocabularies
  const filteredVocabs = useMemo(() => {
    return cloudVocabs.filter((item) => {
      const matchSearch =
        item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.meaning.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchLevel = filterLevel === 'all' || item.level === filterLevel;
      return matchSearch && matchCategory && matchLevel;
    });
  }, [cloudVocabs, searchTerm, filterCategory, filterLevel]);

  // =========================================================================
  // ACCESS CONTROL GUARD: If not logged in as Admin email
  // =========================================================================
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="p-8 bg-slate-900/90 border border-rose-500/30 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Không Có Quyền Truy Cập</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Trang quản trị hệ thống chỉ dành riêng cho tài khoản được cấp quyền Quản Trị Viên (ADMIN).
            </p>
            {userEmail && (
              <div className="text-xs text-slate-500 pt-1">
                Tài khoản hiện tại của bạn: <span className="text-slate-300 font-mono">{userEmail}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Đăng Nhập Tài Khoản Admin</span>
              </button>
            )}

            {onNavigate && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>Về Trang Tổng Quan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ADMIN DASHBOARD CONTENT
  // =========================================================================
  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-200">
      
      {/* Top Banner / Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Bảng Điều Khiển Quản Trị</span>
              <span className="text-xs px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full font-bold">
                Admin Role
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Quản trị kho từ vựng toàn hệ thống Cloud • Đang đăng nhập:{' '}
            <strong className="text-emerald-400 font-mono">{userEmail}</strong>
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-2xl border border-slate-700 text-xs sm:text-sm transition-all"
          title="Làm mới dữ liệu từ Cloud"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Làm Mới Cloud</span>
        </button>
      </div>

      {/* Quick Statistics Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Tổng Kho Từ Hệ Thống</div>
            <div className="text-2xl font-black text-white">{vocabularyList.length.toLocaleString()} từ</div>
          </div>
        </div>

        <div className="p-5 bg-slate-900/90 border border-emerald-500/30 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Từ Vựng Trên Hệ Thống Cloud</div>
            <div className="text-2xl font-black text-emerald-400">{cloudVocabs.length.toLocaleString()} từ</div>
          </div>
        </div>

        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Học Viên Đã Đăng Ký (Profiles)</div>
            <div className="text-2xl font-black text-amber-400">{profiles.length.toLocaleString()} học viên</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap p-1.5 bg-slate-900 border border-slate-800 rounded-2xl gap-1 max-w-3xl">
        <button
          onClick={() => setActiveAdminTab('add_vocab')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeAdminTab === 'add_vocab'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Thêm Từ Mới (Cloud)</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('vocab_list')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeAdminTab === 'vocab_list'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Kho Từ Hệ Thống ({cloudVocabs.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeAdminTab === 'users'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Học Viên ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('danger_zone')}
          className={`py-2.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
            activeAdminTab === 'danger_zone'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/10'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Danger Zone</span>
        </button>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ADD VOCABULARY FORM                                                */}
      {/* ========================================================================= */}
      {activeAdminTab === 'add_vocab' && (
        <div className="p-6 sm:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>Thêm Từ Vựng Mới Vào Kho Hệ Thống</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Từ vựng thêm tại đây sẽ được lưu trực tiếp vào kho từ vựng và phân phối cho toàn bộ người học.
            </p>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Word */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Từ Tiếng Anh <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="Ví dụ: Resilience"
                    className="flex-1 px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                  />
                  {newWord && (
                    <button
                      type="button"
                      onClick={() => speakWord(newWord, audioVoice, audioSpeed)}
                      title="Nghe phát âm thử"
                      className="p-3 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 rounded-2xl transition-all"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Phonetic */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Phiên Âm Chuẩn (Phonetic / IPA)
                </label>
                <input
                  type="text"
                  value={newPhonetic}
                  onChange={(e) => setNewPhonetic(e.target.value)}
                  placeholder="Ví dụ: /rɪˈzɪl.jəns/"
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Danh Mục (Category)
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as VocabTag)}
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* CEFR Level */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Cấp Độ CEFR (Level)
                </label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {LEVEL_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meaning */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nghĩa Tiếng Việt <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Sự kiên cường, khả năng phục hồi nhanh chóng sau khó khăn"
                className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            {/* Example */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Câu Ví Dụ Ngữ Cảnh (Example Sentence)
              </label>
              <textarea
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Courage and resilience are essential for overcoming life challenges."
                className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 fill-slate-950" />
              )}
              <span>Lưu Vào Cloud & Phát Hành Cho Học Viên</span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VOCABULARIES DATA TABLE WITH EDIT & DELETE                         */}
      {/* ========================================================================= */}
      {activeAdminTab === 'vocab_list' && (
        <div className="p-6 sm:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Kho Từ Vựng Trên Hệ Thống Cloud</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full">
                  {filteredVocabs.length} / {cloudVocabs.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Toàn quyền Sửa (Edit) và Xóa (Delete) các từ vựng dùng chung.
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm từ hoặc nghĩa..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="all">Tất cả danh mục</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="all">Tất cả cấp độ CEFR</option>
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    Cấp {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Từ Vựng & Phiên Âm</th>
                  <th className="p-3.5">Phân Loại / Cấp Độ</th>
                  <th className="p-3.5">Nghĩa Tiếng Việt</th>
                  <th className="p-3.5 hidden md:table-cell">Ví Dụ</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVocabs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {cloudVocabs.length === 0
                        ? 'Chưa có từ vựng nào trong kho từ vựng hệ thống. Hãy thêm từ đầu tiên!'
                        : 'Không tìm thấy từ vựng khớp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredVocabs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.word}</span>
                          <button
                            type="button"
                            onClick={() => speakWord(item.word, audioVoice, audioSpeed)}
                            className="text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {item.phonetic && (
                          <div className="text-[11px] font-mono text-emerald-400/80 mt-0.5">
                            {item.phonetic}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px] font-semibold">
                            {item.category || 'General'}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-md text-[10px] font-black border border-emerald-500/20">
                            {item.level || 'B1'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300 max-w-xs">{item.meaning}</td>

                      <td className="p-3.5 text-slate-400 text-xs hidden md:table-cell max-w-sm italic truncate">
                        {item.example || '—'}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(item)}
                            title="Chỉnh sửa từ vựng"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.word)}
                            title="Xóa từ vựng khỏi kho hệ thống"
                            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTERED LEARNERS (PROFILES)                                      */}
      {/* ========================================================================= */}
      {activeAdminTab === 'users' && (
        <div className="p-6 sm:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Quản Lý Học Viên & Tiến Trình Học (`profiles`)</span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full">
                  {displayProfiles.length} tài khoản
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Theo dõi dữ liệu và Reset tiến trình học cho từng tài khoản hoặc nhiều tài khoản cùng lúc.
              </p>
            </div>

            {selectedUserIds.length > 0 && (
              <button
                onClick={() => {
                  setTargetResetUser(null);
                  setIsTargetResetModalOpen(true);
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 active:scale-95 shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset {selectedUserIds.length} tài khoản đã chọn</span>
              </button>
            )}
          </div>

          {/* Search bar & Bulk Selection Indicator */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Tìm kiếm tài khoản theo tên hoặc email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Đã chọn: <strong className="text-white">{selectedUserIds.length}</strong> / {displayProfiles.length}</span>
              {selectedUserIds.length > 0 && (
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  Bỏ chọn
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.length > 0 && selectedUserIds.length === displayProfiles.length}
                      onChange={toggleSelectAllUsers}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      title="Chọn tất cả tài khoản"
                    />
                  </th>
                  <th className="p-3.5">Học Viên / Email</th>
                  <th className="p-3.5">Cấp Độ & XP</th>
                  <th className="p-3.5">Chuỗi Streak</th>
                  <th className="p-3.5">ID Tài Khoản</th>
                  <th className="p-3.5 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Không tìm thấy tài khoản nào khớp với từ khóa tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  displayProfiles.map((p) => {
                    const isSelected = selectedUserIds.includes(p.id);
                    const isThisAdmin =
                      p.id === currentUserId ||
                      (p.display_name && p.display_name.includes('(Admin)'));

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-rose-500/10' : 'hover:bg-slate-850/40'
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(p.id)}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        <td className="p-3.5 font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                              {(p.display_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[180px] sm:max-w-xs">{p.display_name || 'Học viên'}</span>
                                {isThisAdmin && (
                                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-md shrink-0">
                                    Admin 👑
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 font-semibold text-amber-300">
                          Cấp {p.level || 1} • {p.xp || 0} XP
                        </td>

                        <td className="p-3.5 font-bold text-orange-400">
                          {p.streak ?? 0} ngày 🔥
                        </td>

                        <td className="p-3.5 font-mono text-slate-500 text-xs truncate max-w-[120px]" title={p.id}>
                          {p.id}
                        </td>

                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setTargetResetUser({ id: p.id, name: p.display_name || p.id });
                              setIsTargetResetModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                            title={`Reset tiến trình của ${p.display_name}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Tiến Trình</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DANGER ZONE (QUẢN TRỊ DỮ LIỆU)                                     */}
      {/* ========================================================================= */}
      {activeAdminTab === 'danger_zone' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="p-6 sm:p-8 bg-slate-900/90 border border-rose-500/40 rounded-3xl space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-2xl shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>Khu Vực Nguy Hiểm (Danger Zone)</span>
                  <span className="text-[11px] px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full font-bold">
                    Quyền Admin Tối Cao
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Công cụ can thiệp trực tiếp vào cơ sở dữ liệu học tập trên máy chủ Cloud. Chỉ sử dụng khi cần bảo trì hoặc làm mới toàn bộ tiến trình hệ thống.
                </p>
              </div>
            </div>

            {/* Action Card: Reset All Users Progress */}
            <div className="p-6 bg-slate-950 border border-rose-500/30 rounded-2xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-rose-400 flex items-center gap-2">
                    <span>Reset Toàn Bộ Tiến Trình Học (Reset All Users Progress)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Xóa sạch toàn bộ tiến trình học tập của tất cả tài khoản học viên trong cơ sở dữ liệu để đưa hệ thống về trạng thái ban đầu.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setResetInputText('');
                    setIsResetModalOpen(true);
                  }}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Toàn Bộ Tiến Trình</span>
                </button>
              </div>

              {/* Chi tiết phạm vi tác động */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-850 text-xs">
                <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-2">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <span>❌ Dữ liệu sẽ bị xóa / reset:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                    <li>Toàn bộ tiến độ ôn tập <code className="text-rose-300 font-mono bg-slate-900 px-1 py-0.5 rounded border border-rose-900/40">user_srs_progress</code> của tất cả user</li>
                    <li>Toàn bộ nhật ký học tập hàng ngày <code className="text-rose-300 font-mono bg-slate-900 px-1 py-0.5 rounded border border-rose-900/40">daily_logs</code></li>
                    <li>Đưa tất cả chỉ số trong <code className="text-rose-300 font-mono bg-slate-900 px-1 py-0.5 rounded border border-rose-900/40">profiles</code> về: Level 1 (Tân thủ), XP = 0, Chuỗi Streak = 0, từ đã học = 0</li>
                    <li>Xóa sạch bộ nhớ đệm cache/LocalStorage trên trình duyệt</li>
                  </ul>
                </div>

                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>✅ Dữ liệu TUYỆT ĐỐI ĐƯỢC BẢO LƯU:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                    <li>Toàn bộ kho từ vựng gốc <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded border border-emerald-900/40">vocabularies</code> (không mất từ nào)</li>
                    <li>Tài khoản đăng nhập của người dùng (email & mật khẩu giữ nguyên)</li>
                    <li>Người dùng có thể đăng nhập bình thường và bắt đầu học lại từ đầu</li>
                  </ul>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP XÁC NHẬN NGUY HIỂM: RESET TOÀN BỘ TIẾN TRÌNH                         */}
      {/* ========================================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-rose-500/60 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-2xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Xác Nhận Nguy Hiểm
                  </h3>
                  <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">
                    Reset All Users Progress
                  </span>
                </div>
              </div>

              <button
                onClick={() => !isResetting && setIsResetModalOpen(false)}
                disabled={isResetting}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs sm:text-sm text-rose-300 space-y-2 leading-relaxed">
              <p className="font-bold text-rose-200">
                CẢNH BÁO: Thao tác này sẽ xóa vĩnh viễn dữ liệu học tập của TẤT CẢ học viên trên Cloud!
              </p>
              <p className="text-slate-300 text-xs">
                Toàn bộ tiến độ SRS, Level, XP, Streak và nhật ký hàng ngày sẽ bị xóa sạch hoặc đưa về 0. Thao tác này <strong>KHÔNG THỂ KHÔI PHỤC</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Để xác nhận, vui lòng nhập chính xác chữ: <span className="font-mono text-rose-400 select-all font-black text-sm">RESET ALL</span>
              </label>
              <input
                type="text"
                value={resetInputText}
                onChange={(e) => setResetInputText(e.target.value)}
                placeholder="Nhập RESET ALL vào đây..."
                disabled={isResetting}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl text-white font-mono text-sm tracking-wider outline-none transition-colors"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleExecuteResetAll}
                disabled={resetInputText.trim() !== 'RESET ALL' || isResetting}
                className={`px-5 py-2.5 font-black rounded-xl text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 ${
                  resetInputText.trim() === 'RESET ALL' && !isResetting
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 cursor-pointer active:scale-95'
                    : 'bg-slate-850 text-slate-500 border border-slate-750 cursor-not-allowed'
                }`}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xóa dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác Nhận Reset Toàn Bộ</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP XÁC NHẬN: RESET TIẾN TRÌNH THEO TÀI KHOẢN (TARGET USER RESET)       */}
      {/* ========================================================================= */}
      {isTargetResetModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-rose-500/60 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-2xl">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Xác Nhận Reset Tiến Trình
                  </h3>
                  <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">
                    {targetResetUser ? '1 Tài Khoản' : `${selectedUserIds.length} Tài Khoản Được Chọn`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => !isProcessingTargetReset && setIsTargetResetModalOpen(false)}
                disabled={isProcessingTargetReset}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs sm:text-sm text-rose-300 space-y-2.5 leading-relaxed">
              <p className="font-bold text-rose-200">
                Bạn có chắc chắn muốn reset toàn bộ tiến trình học của:
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-rose-500/30 font-bold text-white text-xs sm:text-sm">
                {targetResetUser ? (
                  <span className="text-rose-300">👤 {targetResetUser.name}</span>
                ) : (
                  <span className="text-rose-300">👥 {selectedUserIds.length} tài khoản đã chọn</span>
                )}
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs pl-1">
                <li><strong>4 Kỹ Năng (CEFR):</strong> Đưa cả 4 kỹ năng về mặc định <strong>Level A1 (0%)</strong>, xóa sạch lịch sử bài nghe, đọc, nói AI, viết luận</li>
                <li><strong>Danh Hiệu & Huy Hiệu:</strong> Xóa toàn bộ huy hiệu đã mở khóa, đưa danh hiệu về <strong>"Tân thủ"</strong></li>
                <li><strong>Kho Từ Vựng Cá Nhân:</strong> Xóa sạch <code className="text-rose-300 font-mono bg-slate-900 px-1 py-0.5 rounded">user_srs_progress</code>, đưa "Kho từ vựng tích lũy" về <strong>0 từ cốt lõi</strong></li>
                <li><strong>Dữ Liệu Tổng Quan:</strong> Reset về <strong>Level 1, 0 XP, 0 Streak</strong>, xóa nhật ký <code className="text-rose-300 font-mono bg-slate-900 px-1 py-0.5 rounded">daily_logs</code></li>
                <li><strong>Bảo Lưu An Toàn:</strong> Kho từ vựng chung hệ thống và tài khoản đăng nhập được giữ nguyên 100%</li>
              </ul>
              {((targetResetUser && targetResetUser.id === currentUserId) ||
                (selectedUserIds.some(id => id === currentUserId))) && (
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold">
                  ⚠️ Lưu ý: Tài khoản Admin đang đăng nhập nằm trong danh sách reset. Sau khi hoàn tất, hệ thống sẽ tự động làm sạch LocalStorage và tải lại trang.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTargetResetModalOpen(false)}
                disabled={isProcessingTargetReset}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleExecuteTargetReset}
                disabled={isProcessingTargetReset}
                className="px-5 py-2.5 font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                {isProcessingTargetReset ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang reset dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Xác Nhận Reset</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT MODAL                                                                */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <button
              onClick={() => setEditingItem(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-400" />
              <span>Chỉnh Sửa Từ Vựng Hệ Thống</span>
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Từ Tiếng Anh</label>
                  <input
                    type="text"
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Phiên Âm (IPA)</label>
                  <input
                    type="text"
                    value={editPhonetic}
                    onChange={(e) => setEditPhonetic(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Danh Mục</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cấp Độ CEFR</label>
                  <select
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    {LEVEL_OPTIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nghĩa Tiếng Việt</label>
                <textarea
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Câu Ví Dụ</label>
                <textarea
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
