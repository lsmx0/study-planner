// 错题本页面 - 记录和管理做错的题目
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';
import SubjectSelect from '../components/SubjectSelect';

interface WrongNote {
  id: string;
  subject_id: number | null;
  subject_name: string;
  question: string;
  answer: string;
  analysis: string;
  source: string;
  difficulty: 'easy' | 'medium' | 'hard';
  review_count: number;
  last_review: string | null;
  created_at: string;
  mastered: boolean;
}

// 本地存储
const getStoredNotes = (): WrongNote[] => {
  try { return JSON.parse(localStorage.getItem('wrong-notes') || '[]'); } catch { return []; }
};
const saveNotes = (notes: WrongNote[]) => localStorage.setItem('wrong-notes', JSON.stringify(notes));

const DIFFICULTY_CONFIG = {
  easy: { label: '简单', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  medium: { label: '中等', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  hard: { label: '困难', color: 'text-rose-400', bg: 'bg-rose-500/20' },
};

export default function WrongNotes() {
  useAuthStore(); // 确保用户已登录
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [filterSubject, setFilterSubject] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterMastered, setFilterMastered] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<WrongNote | null>(null);
  const [viewingNote, setViewingNote] = useState<WrongNote | null>(null);
  
  // 表单状态
  const [formSubjectId, setFormSubjectId] = useState<number | null>(null);
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formAnalysis, setFormAnalysis] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => { setNotes(getStoredNotes()); }, []);


  // 过滤后的笔记
  const filteredNotes = notes.filter(n => {
    if (filterSubject && n.subject_id !== filterSubject) return false;
    if (filterDifficulty !== 'all' && n.difficulty !== filterDifficulty) return false;
    if (filterMastered === 'mastered' && !n.mastered) return false;
    if (filterMastered === 'unmastered' && n.mastered) return false;
    if (searchText && !n.question.toLowerCase().includes(searchText.toLowerCase()) && !n.answer.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  // 统计
  const totalNotes = notes.length;
  const masteredNotes = notes.filter(n => n.mastered).length;
  const needReviewNotes = notes.filter(n => !n.mastered && n.review_count < 3).length;

  const resetForm = () => {
    setFormSubjectId(null); setFormQuestion(''); setFormAnswer('');
    setFormAnalysis(''); setFormSource(''); setFormDifficulty('medium');
  };

  const openAddDialog = () => { resetForm(); setEditingNote(null); setShowAddDialog(true); };

  const openEditDialog = (note: WrongNote) => {
    setFormSubjectId(note.subject_id); setFormQuestion(note.question); setFormAnswer(note.answer);
    setFormAnalysis(note.analysis); setFormSource(note.source); setFormDifficulty(note.difficulty);
    setEditingNote(note); setShowAddDialog(true);
  };

  const handleSave = () => {
    if (!formQuestion.trim()) return;
    const now = new Date().toISOString();
    if (editingNote) {
      // 编辑
      const updated = notes.map(n => n.id === editingNote.id ? {
        ...n, subject_id: formSubjectId, question: formQuestion, answer: formAnswer,
        analysis: formAnalysis, source: formSource, difficulty: formDifficulty,
      } : n);
      setNotes(updated); saveNotes(updated);
    } else {
      // 新增
      const newNote: WrongNote = {
        id: Date.now().toString(), subject_id: formSubjectId, subject_name: '',
        question: formQuestion, answer: formAnswer, analysis: formAnalysis,
        source: formSource, difficulty: formDifficulty, review_count: 0,
        last_review: null, created_at: now, mastered: false,
      };
      const updated = [newNote, ...notes];
      setNotes(updated); saveNotes(updated);
    }
    setShowAddDialog(false); resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated); saveNotes(updated);
    setViewingNote(null);
  };

  const handleToggleMastered = (id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, mastered: !n.mastered } : n);
    setNotes(updated); saveNotes(updated);
  };

  const handleReview = (id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, review_count: n.review_count + 1, last_review: new Date().toISOString() } : n);
    setNotes(updated); saveNotes(updated);
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>📝 错题本</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>记录错题，反复复习，攻克难点</p>
        </div>
        <button onClick={openAddDialog} className={`px-4 py-2 bg-gradient-to-r ${themeConfig.accent} text-white rounded-lg font-medium hover:shadow-lg transition-all`}>+ 添加错题</button>
      </div>

      {/* 统计卡片 */}
      <div className="p-4 grid grid-cols-3 gap-4">
        <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}>
          <div className="text-2xl font-bold text-cyan-400">{totalNotes}</div>
          <div className={`text-xs ${themeConfig.textSecondary}`}>总错题数</div>
        </div>
        <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}>
          <div className="text-2xl font-bold text-emerald-400">{masteredNotes}</div>
          <div className={`text-xs ${themeConfig.textSecondary}`}>已掌握</div>
        </div>
        <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}>
          <div className="text-2xl font-bold text-amber-400">{needReviewNotes}</div>
          <div className={`text-xs ${themeConfig.textSecondary}`}>待复习</div>
        </div>
      </div>


      {/* 筛选栏 */}
      <div className={`px-4 pb-4 flex flex-wrap items-center gap-3`}>
        <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="🔍 搜索题目..."
          className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm w-48`} />
        <SubjectSelect value={filterSubject} onChange={setFilterSubject} placeholder="全部科目" />
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
          className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm`}>
          <option value="all">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <select value={filterMastered} onChange={(e) => setFilterMastered(e.target.value)}
          className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm`}>
          <option value="all">全部状态</option>
          <option value="unmastered">未掌握</option>
          <option value="mastered">已掌握</option>
        </select>
      </div>

      {/* 错题列表 */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {filteredNotes.length === 0 ? (
          <div className={`${themeConfig.bgSecondary} rounded-xl p-12 text-center border ${themeConfig.border}`}>
            <div className="text-5xl mb-3">📝</div>
            <p className={themeConfig.textSecondary}>{notes.length === 0 ? '还没有错题记录' : '没有符合条件的错题'}</p>
            {notes.length === 0 && <button onClick={openAddDialog} className="mt-3 text-cyan-400 hover:underline text-sm">添加第一道错题</button>}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map(note => (
              <div key={note.id} onClick={() => setViewingNote(note)}
                className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:border-cyan-500/30 transition-all ${note.mastered ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${DIFFICULTY_CONFIG[note.difficulty].bg} ${DIFFICULTY_CONFIG[note.difficulty].color}`}>
                    {DIFFICULTY_CONFIG[note.difficulty].label}
                  </span>
                  {note.mastered && <span className="text-emerald-400 text-xs">✓ 已掌握</span>}
                </div>
                <div className={`${themeConfig.text} text-sm font-medium line-clamp-2 mb-2`}>{note.question}</div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${themeConfig.textSecondary}`}>{note.source || '未知来源'}</span>
                  <span className={`text-xs ${themeConfig.textSecondary}`}>复习 {note.review_count} 次</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* 添加/编辑对话框 */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">{editingNote ? '✎ 编辑错题' : '➕ 添加错题'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-2">科目</label><SubjectSelect value={formSubjectId} onChange={setFormSubjectId} placeholder="选择科目" /></div>
                <div><label className="block text-sm text-slate-400 mb-2">难度</label>
                  <select value={formDifficulty} onChange={(e) => setFormDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white">
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm text-slate-400 mb-2">题目 *</label>
                <textarea value={formQuestion} onChange={(e) => setFormQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white resize-none" rows={3} placeholder="输入题目内容..." />
              </div>
              <div><label className="block text-sm text-slate-400 mb-2">正确答案</label>
                <textarea value={formAnswer} onChange={(e) => setFormAnswer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white resize-none" rows={2} placeholder="输入正确答案..." />
              </div>
              <div><label className="block text-sm text-slate-400 mb-2">解析/笔记</label>
                <textarea value={formAnalysis} onChange={(e) => setFormAnalysis(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white resize-none" rows={3} placeholder="记录解题思路、易错点..." />
              </div>
              <div><label className="block text-sm text-slate-400 mb-2">来源</label>
                <input type="text" value={formSource} onChange={(e) => setFormSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="如：张宇1000题 P123" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowAddDialog(false); resetForm(); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSave} disabled={!formQuestion.trim()} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 查看详情对话框 */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${DIFFICULTY_CONFIG[viewingNote.difficulty].bg} ${DIFFICULTY_CONFIG[viewingNote.difficulty].color}`}>
                  {DIFFICULTY_CONFIG[viewingNote.difficulty].label}
                </span>
                {viewingNote.mastered && <span className="text-emerald-400 text-xs">✓ 已掌握</span>}
              </div>
              <button onClick={() => setViewingNote(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">题目</div>
                <div className="text-white whitespace-pre-wrap">{viewingNote.question}</div>
              </div>
              {viewingNote.answer && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="text-xs text-emerald-400 mb-1">正确答案</div>
                  <div className="text-white whitespace-pre-wrap">{viewingNote.answer}</div>
                </div>
              )}
              {viewingNote.analysis && (
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <div className="text-xs text-cyan-400 mb-1">解析/笔记</div>
                  <div className="text-white whitespace-pre-wrap">{viewingNote.analysis}</div>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-500">
                <span>来源：{viewingNote.source || '未知'}</span>
                <span>复习 {viewingNote.review_count} 次</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => { handleReview(viewingNote.id); setViewingNote({ ...viewingNote, review_count: viewingNote.review_count + 1 }); }}
                className="flex-1 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30">📖 复习一次</button>
              <button onClick={() => { handleToggleMastered(viewingNote.id); setViewingNote({ ...viewingNote, mastered: !viewingNote.mastered }); }}
                className={`flex-1 py-2 rounded-lg text-sm ${viewingNote.mastered ? 'bg-slate-700 text-slate-400' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                {viewingNote.mastered ? '取消掌握' : '✓ 标记掌握'}
              </button>
              <button onClick={() => { openEditDialog(viewingNote); setViewingNote(null); }} className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm">✎</button>
              <button onClick={() => handleDelete(viewingNote.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm">🗑</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
