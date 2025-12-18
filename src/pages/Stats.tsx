// 统计页面 - 支持主题切换、学习目标、成就系统、数据导出
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

interface SubjectStudyTime { subject_id: number; subject_name: string; subject_color: string; total_minutes: number; }
interface DailyCompletion { date: string; total_tasks: number; completed_tasks: number; completion_rate: number; }
interface Statistics { total_study_minutes: number; total_tasks: number; completed_tasks: number; completion_rate: number; subject_distribution: SubjectStudyTime[]; daily_trend: DailyCompletion[]; }

// 学习目标
interface StudyGoal { dailyMinutes: number; weeklyMinutes: number; dailyTasks: number; }
const getStoredGoals = (): StudyGoal => {
  try { return JSON.parse(localStorage.getItem('study-goals') || '{}'); } catch { return { dailyMinutes: 120, weeklyMinutes: 600, dailyTasks: 5 }; }
};
const saveGoals = (goals: StudyGoal) => localStorage.setItem('study-goals', JSON.stringify(goals));

// 成就定义
const ACHIEVEMENTS = [
  { id: 'first_task', name: '初出茅庐', desc: '完成第一个任务', icon: '🌱', check: (s: Statistics) => s.completed_tasks >= 1 },
  { id: 'task_10', name: '小有成就', desc: '完成10个任务', icon: '⭐', check: (s: Statistics) => s.completed_tasks >= 10 },
  { id: 'task_50', name: '勤奋学者', desc: '完成50个任务', icon: '🏆', check: (s: Statistics) => s.completed_tasks >= 50 },
  { id: 'task_100', name: '学霸之路', desc: '完成100个任务', icon: '👑', check: (s: Statistics) => s.completed_tasks >= 100 },
  { id: 'hour_1', name: '初次专注', desc: '累计学习1小时', icon: '⏰', check: (s: Statistics) => s.total_study_minutes >= 60 },
  { id: 'hour_10', name: '持之以恒', desc: '累计学习10小时', icon: '🔥', check: (s: Statistics) => s.total_study_minutes >= 600 },
  { id: 'hour_50', name: '学习达人', desc: '累计学习50小时', icon: '💪', check: (s: Statistics) => s.total_study_minutes >= 3000 },
  { id: 'hour_100', name: '百小时俱乐部', desc: '累计学习100小时', icon: '🎯', check: (s: Statistics) => s.total_study_minutes >= 6000 },
  { id: 'rate_80', name: '高效执行', desc: '完成率达到80%', icon: '📈', check: (s: Statistics) => s.completion_rate >= 80 },
  { id: 'rate_100', name: '完美主义', desc: '完成率达到100%', icon: '💯', check: (s: Statistics) => s.completion_rate >= 100 },
];

const TIME_RANGES = [{ label: '7天', days: 7 }, { label: '14天', days: 14 }, { label: '30天', days: 30 }];

export default function Stats() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [selectedRange, setSelectedRange] = useState(7);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 学习目标
  const [goals, setGoals] = useState<StudyGoal>(getStoredGoals());
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [editGoals, setEditGoals] = useState<StudyGoal>(goals);
  // 成就
  const [showAchievements, setShowAchievements] = useState(false);
  // 导出
  const [isExporting, setIsExporting] = useState(false);


  const handleRangeSelect = (days: number) => {
    setSelectedRange(days);
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]); setEndDate(end.toISOString().split('T')[0]);
  };

  const loadStats = async () => {
    if (!sessionToken) return;
    setIsLoading(true); setError(null);
    try { const result = await invoke<Statistics>('get_stats', { sessionToken, startDate, endDate }); setStats(result); }
    catch (e) { setError(e as string); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadStats(); }, [sessionToken, startDate, endDate]);

  const formatDuration = (m: number) => { const h = Math.floor(m / 60); return h > 0 ? `${h}h${m % 60}m` : `${m}m`; };
  const formatDurationLong = (m: number) => { const h = Math.floor(m / 60); return h > 0 ? `${h}小时${m % 60}分钟` : `${m}分钟`; };

  // 保存目标
  const handleSaveGoals = () => {
    setGoals(editGoals);
    saveGoals(editGoals);
    setShowGoalDialog(false);
  };

  // 计算今日进度
  const todayStats = stats?.daily_trend.find(d => d.date === new Date().toISOString().split('T')[0]);
  const todayMinutes = todayStats ? Math.round((todayStats.completed_tasks / Math.max(todayStats.total_tasks, 1)) * goals.dailyMinutes) : 0;
  const weekMinutes = stats?.total_study_minutes || 0;

  // 导出数据为CSV
  const handleExport = async () => {
    if (!stats) return;
    setIsExporting(true);
    try {
      // 生成CSV内容
      let csv = '日期,总任务,完成任务,完成率\n';
      stats.daily_trend.forEach(d => {
        csv += `${d.date},${d.total_tasks},${d.completed_tasks},${d.completion_rate.toFixed(1)}%\n`;
      });
      csv += '\n科目,学习时长(分钟)\n';
      stats.subject_distribution.forEach(s => {
        csv += `${s.subject_name},${s.total_minutes}\n`;
      });
      csv += `\n总计,${stats.total_study_minutes}\n`;
      
      // 下载文件
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `学习统计_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e as string); }
    finally { setIsExporting(false); }
  };

  // 获取已解锁成就
  const unlockedAchievements = stats ? ACHIEVEMENTS.filter(a => a.check(stats)) : [];

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>📊 学习统计</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>数据分析，了解学习情况</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAchievements(true)} className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm hover:opacity-80 flex items-center gap-1`}>
            🏆 成就 <span className="text-amber-400">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</span>
          </button>
          <button onClick={() => { setEditGoals(goals); setShowGoalDialog(true); }} className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm hover:opacity-80`}>🎯 目标</button>
          <button onClick={handleExport} disabled={isExporting || !stats} className={`px-3 py-2 bg-gradient-to-r ${themeConfig.accent} text-white rounded-lg text-sm hover:opacity-80 disabled:opacity-50`}>
            {isExporting ? '导出中...' : '📥 导出'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between">
          <span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button>
        </div>
      )}


      {/* 学习目标进度条 */}
      <div className={`mx-4 mt-4 p-4 ${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border}`}>
        <div className="flex justify-between items-center mb-3">
          <span className={`font-medium ${themeConfig.text}`}>🎯 今日目标</span>
          <span className={`text-sm ${themeConfig.textSecondary}`}>{todayMinutes}/{goals.dailyMinutes} 分钟</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (todayMinutes / goals.dailyMinutes) * 100)}%` }}></div>
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className={`font-medium ${themeConfig.text}`}>📅 本周目标</span>
          <span className={`text-sm ${themeConfig.textSecondary}`}>{weekMinutes}/{goals.weeklyMinutes} 分钟</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: `${Math.min(100, (weekMinutes / goals.weeklyMinutes) * 100)}%` }}></div>
        </div>
      </div>

      <div className={`p-4 flex flex-wrap items-center gap-3 border-b ${themeConfig.border}`}>
        <div className={`flex gap-1 p-1 ${themeConfig.bgSecondary} rounded-lg`}>
          {TIME_RANGES.map((r) => (
            <button key={r.days} onClick={() => handleRangeSelect(r.days)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedRange === r.days ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' : `${themeConfig.textSecondary} hover:${themeConfig.text}`}`}>{r.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedRange(0); }}
            className={`px-2 py-1.5 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text}`} />
          <span className={themeConfig.textSecondary}>→</span>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedRange(0); }}
            className={`px-2 py-1.5 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text}`} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-16"><div className="w-10 h-10 border-3 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3"></div><p className="text-slate-500">加载中...</p></div>
        ) : stats ? (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-xl mb-3">⏱️</div><div className={`text-2xl font-bold ${themeConfig.text}`}>{formatDuration(stats.total_study_minutes)}</div><div className={`${themeConfig.textSecondary} text-sm`}>总学习时长</div></div>
              <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-xl mb-3">✓</div><div className={`text-2xl font-bold ${themeConfig.text}`}>{stats.completed_tasks}</div><div className={`${themeConfig.textSecondary} text-sm`}>完成任务</div></div>
              <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-xl mb-3">📋</div><div className={`text-2xl font-bold ${themeConfig.text}`}>{stats.total_tasks}</div><div className={`${themeConfig.textSecondary} text-sm`}>总任务数</div></div>
              <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-xl mb-3">📈</div><div className={`text-2xl font-bold ${themeConfig.text}`}>{stats.completion_rate.toFixed(0)}%</div><div className={`${themeConfig.textSecondary} text-sm`}>完成率</div></div>
            </div>


            <div className="grid lg:grid-cols-2 gap-4">
              {/* 科目分布 */}
              <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
                <h2 className={`${themeConfig.text} font-bold mb-4`}>🎯 科目学习时长</h2>
                {stats.subject_distribution.length === 0 ? (
                  <div className="text-center py-12"><div className="text-4xl mb-2">📚</div><p className="text-slate-500 text-sm">暂无数据</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={stats.subject_distribution.map(s => ({ name: s.subject_name, value: s.total_minutes, color: s.subject_color }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name }) => name}>
                        {stats.subject_distribution.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.subject_color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatDurationLong(Number(v))} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* 完成率趋势 */}
              <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
                <h2 className={`${themeConfig.text} font-bold mb-4`}>📈 完成率趋势</h2>
                {stats.daily_trend.length === 0 ? (
                  <div className="text-center py-12"><div className="text-4xl mb-2">📊</div><p className="text-slate-500 text-sm">暂无数据</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={stats.daily_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} stroke="#64748b" fontSize={11} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#64748b" fontSize={11} />
                      <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleDateString('zh-CN')} formatter={(v) => [`${Number(v).toFixed(1)}%`, '完成率']}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="completion_rate" name="完成率" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* 每日任务柱状图 */}
              {stats.daily_trend.length > 0 && (
                <div className={`lg:col-span-2 ${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
                  <h2 className={`${themeConfig.text} font-bold mb-4`}>📊 每日任务完成</h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stats.daily_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleDateString('zh-CN')} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="completed_tasks" name="已完成" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_tasks" name="总任务" fill="#334155" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>


      {/* 目标设置对话框 */}
      {showGoalDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">🎯 设置学习目标</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">每日学习目标（分钟）</label>
                <input type="number" value={editGoals.dailyMinutes} onChange={(e) => setEditGoals({ ...editGoals, dailyMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" min="30" max="480" />
                <div className="flex gap-2 mt-2">
                  {[60, 120, 180, 240].map(m => (
                    <button key={m} onClick={() => setEditGoals({ ...editGoals, dailyMinutes: m })}
                      className={`px-3 py-1 rounded text-xs ${editGoals.dailyMinutes === m ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{m}分钟</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">每周学习目标（分钟）</label>
                <input type="number" value={editGoals.weeklyMinutes} onChange={(e) => setEditGoals({ ...editGoals, weeklyMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" min="60" max="3000" />
                <div className="flex gap-2 mt-2">
                  {[300, 600, 900, 1200].map(m => (
                    <button key={m} onClick={() => setEditGoals({ ...editGoals, weeklyMinutes: m })}
                      className={`px-3 py-1 rounded text-xs ${editGoals.weeklyMinutes === m ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{m/60}小时</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">每日任务目标（个）</label>
                <input type="number" value={editGoals.dailyTasks} onChange={(e) => setEditGoals({ ...editGoals, dailyTasks: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" min="1" max="20" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowGoalDialog(false)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSaveGoals} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 成就对话框 */}
      {showAchievements && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">🏆 成就徽章</h3>
              <button onClick={() => setShowAchievements(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-slate-400 text-sm mb-4">已解锁 {unlockedAchievements.length}/{ACHIEVEMENTS.length} 个成就</p>
            <div className="grid grid-cols-2 gap-3">
              {ACHIEVEMENTS.map(a => {
                const unlocked = stats ? a.check(stats) : false;
                return (
                  <div key={a.id} className={`p-4 rounded-xl border transition-all ${unlocked ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30' : 'bg-slate-700/30 border-white/5 opacity-50'}`}>
                    <div className="text-3xl mb-2">{a.icon}</div>
                    <div className={`font-bold ${unlocked ? 'text-amber-400' : 'text-slate-500'}`}>{a.name}</div>
                    <div className="text-xs text-slate-400">{a.desc}</div>
                    {unlocked && <div className="text-xs text-emerald-400 mt-1">✓ 已解锁</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
