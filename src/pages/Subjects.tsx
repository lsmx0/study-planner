// 科目管理页面 - 支持主题切换
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';

interface Subject { id: number; name: string; color: string; is_default: boolean; }

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#78716C', '#64748B', '#475569', '#0D9488', '#059669', '#7C3AED', '#DB2777',
];

export default function Subjects() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSubjects = async () => {
    if (!sessionToken) return;
    setIsLoading(true); setError(null);
    try { const result = await invoke<Subject[]>('get_subjects', { sessionToken }); setSubjects(result); }
    catch (e) { setError(e as string); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadSubjects(); }, [sessionToken]);

  const handleCreate = async () => {
    if (!sessionToken || !newName.trim()) return;
    setIsCreating(true);
    try {
      await invoke('create_subject', { sessionToken, name: newName.trim(), color: newColor });
      setShowCreateDialog(false); setNewName(''); setNewColor(COLORS[0]); await loadSubjects();
    } catch (e) { setError(e as string); }
    finally { setIsCreating(false); }
  };

  const handleDelete = async () => {
    if (!sessionToken || !deleteSubject) return;
    setIsDeleting(true);
    try { await invoke('delete_subject', { sessionToken, subjectId: deleteSubject.id }); setDeleteSubject(null); await loadSubjects(); }
    catch (e) { setError(e as string); }
    finally { setIsDeleting(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>📚 科目管理</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>管理你的学习科目</p>
        </div>
        <button onClick={() => setShowCreateDialog(true)}
          className={`px-4 py-2 bg-gradient-to-r ${themeConfig.accent} text-white rounded-lg font-medium hover:shadow-lg transition-all`}>
          + 添加科目
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between">
          <span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-16"><div className="w-10 h-10 border-3 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-3"></div><p className="text-slate-500">加载中...</p></div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3">📚</div><p className={themeConfig.textSecondary}>暂无科目</p></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <div key={subject.id} className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border} flex items-center gap-4 hover:opacity-80 transition-all`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: subject.color }}>
                  {subject.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className={`${themeConfig.text} font-medium`}>{subject.name}</div>
                  {subject.is_default && <span className={`text-xs ${themeConfig.textSecondary}`}>默认科目</span>}
                </div>
                {!subject.is_default && (
                  <button onClick={() => setDeleteSubject(subject)} className={`w-8 h-8 ${themeConfig.textSecondary} hover:text-rose-400 transition-colors`}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📚 添加科目</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">科目名称</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="如：高等数学" /></div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">选择颜色</label>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map((color) => (
                    <button key={color} onClick={() => setNewColor(color)}
                      className={`w-8 h-8 rounded-lg transition-all ${newColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: newColor }}>{newName.charAt(0) || '?'}</div>
                <span className="text-slate-300">{newName || '预览'}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowCreateDialog(false); setNewName(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleCreate} disabled={isCreating || !newName.trim()} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isCreating ? '添加中...' : '添加'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteSubject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-rose-400 mb-4">⚠️ 确认删除</h3>
            <p className="text-slate-300">确定删除科目 <span className="text-white font-medium">"{deleteSubject.name}"</span>？相关任务的科目将被清空。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteSubject(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-rose-500 text-white rounded-lg disabled:opacity-50">{isDeleting ? '删除中...' : '删除'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
