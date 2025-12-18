// 每日复盘页面 - 支持主题切换
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';

interface DailyReview { id: number; review_date: string; feelings: string | null; difficulties: string | null; ai_suggestions: string | null; }
interface TaskResponse { id: number; subject_name: string | null; subject_color: string | null; start_time: string; end_time: string; content: string; status: string; }

export default function Review() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [, setReview] = useState<DailyReview | null>(null);
  const [feelings, setFeelings] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [history, setHistory] = useState<DailyReview[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async () => {
    if (!sessionToken) return;
    setIsLoadingTasks(true);
    try { const result = await invoke<TaskResponse[]>('get_tasks_by_date', { sessionToken, date: selectedDate }); setTasks(result); }
    catch (e) { console.error(e); }
    finally { setIsLoadingTasks(false); }
  };

  const loadReview = async () => {
    if (!sessionToken) return;
    try {
      const result = await invoke<DailyReview | null>('get_review_by_date', { sessionToken, date: selectedDate });
      setReview(result); setFeelings(result?.feelings || ''); setDifficulties(result?.difficulties || '');
    } catch (e) { console.error(e); }
  };

  const loadHistory = async () => {
    if (!sessionToken) return;
    setIsLoadingHistory(true);
    try { const result = await invoke<DailyReview[]>('get_review_history', { sessionToken, limit: 10 }); setHistory(result); }
    catch (e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  };

  useEffect(() => { loadTasks(); loadReview(); }, [sessionToken, selectedDate]);
  useEffect(() => { loadHistory(); }, [sessionToken]);

  const handleSave = async () => {
    if (!sessionToken) return;
    setIsSaving(true); setError(null); setSaveSuccess(false);
    try {
      await invoke('save_review', { sessionToken, reviewDate: selectedDate, feelings: feelings || null, difficulties: difficulties || null });
      await loadReview(); await loadHistory(); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { setError(e as string); }
    finally { setIsSaving(false); }
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const formatTime = (time: string) => time.substring(0, 5);

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border}`}>
        <h1 className={`text-xl font-bold ${themeConfig.text}`}>📝 每日复盘</h1>
        <p className={`${themeConfig.textSecondary} text-sm`}>记录心得，持续进步</p>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between">
          <span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button>
        </div>
      )}
      {saveSuccess && <div className="mx-4 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">✓ 保存成功！</div>}

      <div className="flex-1 overflow-auto p-4">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* 左侧 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 日期和统计 */}
            <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text}`} />
                  <span className={`${themeConfig.textSecondary} text-sm`}>{new Date(selectedDate).toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#334155" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - completionRate / 100)} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs font-bold text-emerald-400">{completionRate}%</span></div>
                  </div>
                  <span className="text-slate-500 text-sm">完成率</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-emerald-500/10 rounded-lg"><div className="text-2xl font-bold text-emerald-400">{completedCount}</div><div className="text-xs text-emerald-500">已完成</div></div>
                <div className="text-center p-3 bg-rose-500/10 rounded-lg"><div className="text-2xl font-bold text-rose-400">{failedCount}</div><div className="text-xs text-rose-500">未完成</div></div>
                <div className="text-center p-3 bg-slate-700/30 rounded-lg"><div className="text-2xl font-bold text-slate-400">{pendingCount}</div><div className="text-xs text-slate-500">待处理</div></div>
              </div>
            </div>

            {/* 当日任务 */}
            <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
              <h2 className={`${themeConfig.text} font-bold mb-3`}>📋 当日任务</h2>
              {isLoadingTasks ? <div className="text-center py-6 text-slate-500">加载中...</div>
              : tasks.length === 0 ? <div className="text-center py-6"><div className="text-3xl mb-2">📝</div><p className="text-slate-500 text-sm">当天没有任务</p></div>
              : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tasks.map((task) => (
                    <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg ${task.status === 'completed' ? 'bg-emerald-500/5' : task.status === 'failed' ? 'bg-rose-500/5' : 'bg-slate-700/30'}`}>
                      <span className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : task.status === 'failed' ? 'bg-rose-500' : 'bg-slate-500'}`}></span>
                      <span className="text-xs text-slate-500 font-mono w-24">{formatTime(task.start_time)}-{formatTime(task.end_time)}</span>
                      {task.subject_name && <span className="px-2 py-0.5 text-xs rounded text-white" style={{ backgroundColor: task.subject_color || '#6B7280' }}>{task.subject_name}</span>}
                      <span className={`flex-1 text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-300'}`}>{task.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 复盘表单 */}
            <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
              <h2 className={`${themeConfig.text} font-bold mb-4`}>✍️ 今日复盘</h2>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm ${themeConfig.textSecondary} mb-2`}>😊 今天的感受和收获</label>
                  <textarea value={feelings} onChange={(e) => setFeelings(e.target.value)}
                    className={`w-full px-3 py-3 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} resize-none`} rows={3} placeholder="记录今天学习的感受、收获..." />
                </div>
                <div>
                  <label className={`block text-sm ${themeConfig.textSecondary} mb-2`}>🤔 遇到的困难和问题</label>
                  <textarea value={difficulties} onChange={(e) => setDifficulties(e.target.value)}
                    className={`w-full px-3 py-3 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} resize-none`} rows={3} placeholder="记录今天遇到的困难、问题..." />
                </div>
                <button onClick={handleSave} disabled={isSaving}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold disabled:opacity-50 hover:shadow-lg transition-all">
                  {isSaving ? '保存中...' : '💾 保存复盘'}
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：历史 */}
          <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4 h-fit`}>
            <h2 className={`${themeConfig.text} font-bold mb-4`}>📚 历史复盘</h2>
            {isLoadingHistory ? <div className="text-center py-6 text-slate-500">加载中...</div>
            : history.length === 0 ? <div className="text-center py-6"><div className="text-3xl mb-2">📖</div><p className="text-slate-500 text-sm">暂无记录</p></div>
            : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} onClick={() => setSelectedDate(item.review_date)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${item.review_date === selectedDate ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 hover:border-white/10'}`}>
                    <div className="font-medium text-white text-sm">{new Date(item.review_date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
                    {item.feelings && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.feelings}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
