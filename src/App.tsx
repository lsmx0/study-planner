// 主应用组件 - 统一深色主题 + 侧边栏导航
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from './stores/authStore';
import { useThemeStore, THEMES, ThemeType } from './stores/themeStore';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import Subjects from './pages/Subjects';
import Countdown from './pages/Countdown';
import StudyPlan from './pages/StudyPlan';
import Pomodoro from './pages/Pomodoro';
import Stats from './pages/Stats';
import Review from './pages/Review';
import AIChat from './pages/AIChat';
import WrongNotes from './pages/WrongNotes';

// 类型定义
interface CountdownResponse {
  id: number;
  name: string;
  target_time: string;
  remaining_days: number;
  is_expired: boolean;
}

interface UserResponse {
  id: number;
  username: string;
  display_name: string;
  role: string;
  role_label: string;
  created_at: string;
}

interface TaskResponse {
  id: number;
  status: string;
}

interface StatsResponse {
  total_study_minutes: number;
  total_pomodoros: number;
}

// 励志语录
const QUOTES = [
  { text: '每一个不曾起舞的日子，都是对生命的辜负。', author: '尼采' },
  { text: '成功的秘诀在于坚持自己的目标和信念。', author: '爱迪生' },
  { text: '学习这件事，不是缺乏时间，而是缺乏努力。', author: '韩愈' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '不积跬步，无以至千里。', author: '荀子' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '古语' },
  { text: '千里之行，始于足下。', author: '老子' },
];

// 导航菜单配置
const NAV_ITEMS = [
  { path: '/', icon: '🏠', label: '主页', color: 'from-violet-500 to-purple-500' },
  { path: '/plan', icon: '📋', label: '学习规划', color: 'from-indigo-500 to-blue-500' },
  { path: '/pomodoro', icon: '🍅', label: '番茄钟', color: 'from-rose-500 to-orange-500' },
  { path: '/ai-chat', icon: '🤖', label: 'AI答疑', color: 'from-cyan-500 to-teal-500' },
  { path: '/wrong-notes', icon: '❌', label: '错题本', color: 'from-red-500 to-pink-500' },
  { path: '/stats', icon: '📊', label: '学习统计', color: 'from-emerald-500 to-green-500' },
  { path: '/review', icon: '📝', label: '每日复盘', color: 'from-amber-500 to-yellow-500' },
  { path: '/countdown', icon: '⏱️', label: '倒计时', color: 'from-pink-500 to-rose-500' },
];

// 统一布局组件
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, sessionToken, setUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const navigate = useNavigate();
  const location = useLocation();
  const [countdowns, setCountdowns] = useState<CountdownResponse[]>([]);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const loadCountdowns = async () => {
      if (!sessionToken) return;
      try {
        const res = await invoke<CountdownResponse[]>('get_countdowns', { sessionToken });
        setCountdowns(res.filter(c => !c.is_expired).slice(0, 2));
      } catch (e) { console.error(e); }
    };
    loadCountdowns();
  }, [sessionToken]);

  const handleSaveProfile = async () => {
    if (!sessionToken || !newDisplayName.trim()) return;
    setIsSavingProfile(true);
    try {
      const updatedUser = await invoke<UserResponse>('change_display_name', { sessionToken, newDisplayName: newDisplayName.trim() });
      setUser(updatedUser);
      setShowProfileDialog(false);
    } catch (e) { console.error(e); }
    finally { setIsSavingProfile(false); }
  };

  return (
    <div className={`min-h-screen ${themeConfig.bg} flex transition-colors duration-300`}>
      {/* 侧边栏 */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} ${themeConfig.bgSecondary} backdrop-blur-xl border-r ${themeConfig.border} flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-purple-500/30">📚</div>
            {!sidebarCollapsed && <span className="font-bold text-white">考研助手</span>}
          </div>
        </div>

        {/* 倒计时提示 */}
        {!sidebarCollapsed && countdowns.length > 0 && (
          <div className="p-3 mx-3 mt-3 bg-gradient-to-r from-rose-500/20 to-orange-500/20 rounded-xl border border-rose-500/20">
            {countdowns.map(c => (
              <div key={c.id} className="text-xs text-white/80 py-1">
                <span className="text-rose-400 font-bold">{c.remaining_days}天</span> {c.name}
              </div>
            ))}
          </div>
        )}

        {/* 导航菜单 */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  isActive ? `bg-gradient-to-r ${item.color} text-white shadow-lg` : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <span className="text-xl">{item.icon}</span>
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
          
          {user?.role === 'admin' && (
            <>
              <div className="border-t border-white/5 my-3"></div>
              <button onClick={() => navigate('/users')}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  location.pathname === '/users' ? 'bg-gradient-to-r from-slate-600 to-slate-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <span className="text-xl">👥</span>
                {!sidebarCollapsed && <span className="font-medium">用户管理</span>}
              </button>
            </>
          )}
          <button onClick={() => navigate('/subjects')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
              location.pathname === '/subjects' ? 'bg-gradient-to-r from-slate-600 to-slate-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <span className="text-xl">📚</span>
            {!sidebarCollapsed && <span className="font-medium">科目管理</span>}
          </button>
        </nav>

        {/* 底部用户信息 */}
        <div className="p-3 border-t border-white/5">
          <button onClick={() => { setNewDisplayName(user?.display_name || ''); setShowProfileDialog(true); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.display_name?.charAt(0) || '?'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 text-left">
                <div className="text-white text-sm font-medium truncate">{user?.display_name}</div>
                <div className="text-slate-500 text-xs">{user?.role_label}</div>
              </div>
            )}
          </button>
          <button onClick={() => setShowThemeDialog(true)} className={`w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 ${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/5 rounded-xl transition-all`}>
            {sidebarCollapsed ? THEMES[theme].icon : `${THEMES[theme].icon} ${THEMES[theme].name}`}
          </button>
          <button onClick={logout} className={`w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 ${themeConfig.textSecondary} hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all`}>
            {sidebarCollapsed ? '🚪' : '退出登录'}
          </button>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`w-full mt-2 flex items-center justify-center px-3 py-2 ${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/5 rounded-xl transition-all`}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">{children}</main>

      {/* 修改昵称对话框 */}
      {showProfileDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">修改昵称</h3>
            <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white mb-4" placeholder="输入新昵称" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowProfileDialog(false)} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-xl">取消</button>
              <button onClick={handleSaveProfile} disabled={isSavingProfile || !newDisplayName.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl disabled:opacity-50">
                {isSavingProfile ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主题切换对话框 */}
      {showThemeDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">🎨 选择主题</h3>
            <div className="space-y-3">
              {(Object.keys(THEMES) as ThemeType[]).map((key) => {
                const t = THEMES[key];
                return (
                  <button key={key} onClick={() => { setTheme(key); setShowThemeDialog(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${theme === key ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 hover:border-white/20'}`}>
                    <div className={`w-12 h-12 ${t.bg} rounded-xl flex items-center justify-center text-2xl`}>{t.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">{t.name}</div>
                      <div className="text-slate-400 text-sm">{key === 'dark' ? '深色背景，适合夜间使用' : key === 'light' ? '浅色背景，适合白天使用' : '绿色护眼，减少眼睛疲劳'}</div>
                    </div>
                    {theme === key && <span className="text-violet-400 text-xl">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowThemeDialog(false)} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-xl">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// 主页组件
function Dashboard() {
  const { sessionToken, user } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const navigate = useNavigate();
  const [todayTasks, setTodayTasks] = useState<TaskResponse[]>([]);
  const [todayStats, setTodayStats] = useState<StatsResponse | null>(null);
  const [countdowns, setCountdowns] = useState<CountdownResponse[]>([]);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [quickPomodoroTime, setQuickPomodoroTime] = useState(25);
  const [isStartingPomodoro, setIsStartingPomodoro] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!sessionToken) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const [tasksRes, statsRes, countdownsRes] = await Promise.all([
          invoke<TaskResponse[]>('get_tasks_by_date', { sessionToken, date: today }),
          invoke<StatsResponse>('get_stats', { sessionToken, startDate: today, endDate: today }).catch(() => null),
          invoke<CountdownResponse[]>('get_countdowns', { sessionToken }),
        ]);
        setTodayTasks(tasksRes);
        setTodayStats(statsRes);
        setCountdowns(countdownsRes.filter(c => !c.is_expired).slice(0, 3));
      } catch (e) { console.error(e); }
    };
    loadData();
  }, [sessionToken]);

  const handleQuickPomodoro = async () => {
    setIsStartingPomodoro(true);
    try {
      await invoke('start_pomodoro', { sessionToken, subjectId: null, taskId: null, durationMinutes: quickPomodoroTime });
      navigate('/pomodoro');
    } catch (e) { console.error(e); }
    finally { setIsStartingPomodoro(false); }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了，注意休息 🌙';
    if (hour < 9) return '早上好 ☀️';
    if (hour < 12) return '上午好 🌤️';
    if (hour < 14) return '中午好 🌞';
    if (hour < 18) return '下午好 ⛅';
    if (hour < 22) return '晚上好 🌆';
    return '夜深了，注意休息 🌙';
  };

  const completedTasks = todayTasks.filter(t => t.status === 'completed').length;
  const taskProgress = todayTasks.length > 0 ? Math.round((completedTasks / todayTasks.length) * 100) : 0;
  const studyHours = todayStats ? Math.floor(todayStats.total_study_minutes / 60) : 0;
  const studyMinutes = todayStats ? todayStats.total_study_minutes % 60 : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 欢迎区域 */}
      <div className="mb-6 bg-gradient-to-r from-violet-600/80 via-purple-600/80 to-fuchsia-600/80 rounded-2xl p-6 text-white border border-white/10">
        <h1 className="text-2xl font-bold mb-1">{getGreeting()}，{user?.display_name}！</h1>
        <p className="text-white/70">今天也要加油学习哦 💪</p>
        
        {/* 今日进度 */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="text-2xl font-bold">{completedTasks}/{todayTasks.length}</div>
            <div className="text-white/60 text-sm">今日任务</div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{width: `${taskProgress}%`}}></div>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="text-2xl font-bold">{studyHours}h{studyMinutes}m</div>
            <div className="text-white/60 text-sm">今日学习</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="text-2xl font-bold">{todayStats?.total_pomodoros || 0}</div>
            <div className="text-white/60 text-sm">番茄钟</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左侧：快捷操作 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 快捷功能卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <div onClick={() => navigate('/plan')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">📋</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>学习规划</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>规划任务</p>
            </div>
            <div onClick={() => navigate('/ai-chat')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">🤖</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>AI 答疑</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>随时问</p>
            </div>
            <div onClick={() => navigate('/wrong-notes')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">❌</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>错题本</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>记录错题</p>
            </div>
            <div onClick={() => navigate('/stats')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">📊</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>学习统计</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>数据分析</p>
            </div>
            <div onClick={() => navigate('/review')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">📝</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>每日复盘</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>总结反思</p>
            </div>
            <div onClick={() => navigate('/countdown')} className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-4 border ${themeConfig.border} cursor-pointer hover:opacity-80 transition-all group`}>
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">⏱️</div>
              <h3 className={`${themeConfig.text} font-bold text-sm`}>倒计时</h3>
              <p className={`${themeConfig.textSecondary} text-xs mt-1`}>考试提醒</p>
            </div>
          </div>

          {/* 倒计时 */}
          {countdowns.length > 0 && (
            <div className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-5 border ${themeConfig.border}`}>
              <h3 className={`${themeConfig.text} font-bold mb-4 flex items-center gap-2`}>⏱️ 考试倒计时</h3>
              <div className="grid grid-cols-3 gap-3">
                {countdowns.map((c, i) => {
                  const colors = ['from-rose-500 to-pink-500', 'from-indigo-500 to-purple-500', 'from-cyan-500 to-blue-500'];
                  return (
                    <div key={c.id} className={`bg-gradient-to-br ${colors[i % 3]} rounded-xl p-4 text-white`}>
                      <div className="text-xs text-white/70 truncate">{c.name}</div>
                      <div className="text-2xl font-bold">{c.remaining_days}天</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：快捷番茄钟 + 励志语录 */}
        <div className="space-y-6">
          {/* 快捷番茄钟 */}
          <div className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-5 border ${themeConfig.border}`}>
            <h3 className={`${themeConfig.text} font-bold mb-4 flex items-center gap-2`}>🍅 快捷番茄钟</h3>
            <div className="flex gap-2 mb-4">
              {[15, 25, 45].map(t => (
                <button key={t} onClick={() => setQuickPomodoroTime(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${quickPomodoroTime === t ? 'bg-rose-500 text-white' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary} hover:opacity-80`}`}>
                  {t}分钟
                </button>
              ))}
            </div>
            <button onClick={handleQuickPomodoro} disabled={isStartingPomodoro}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all">
              {isStartingPomodoro ? '启动中...' : '🚀 开始专注'}
            </button>
          </div>

          {/* 励志语录 */}
          <div className={`${themeConfig.bgSecondary} backdrop-blur rounded-xl p-5 border ${themeConfig.border}`}>
            <div className="text-3xl mb-3">💡</div>
            <p className={`${themeConfig.text} text-sm leading-relaxed`}>"{quote.text}"</p>
            <p className={`${themeConfig.textSecondary} text-xs mt-2`}>—— {quote.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { sessionToken, checkSession } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (sessionToken) {
        const valid = await checkSession();
        setIsValid(valid);
      }
      setIsChecking(false);
    };
    verify();
  }, [sessionToken, checkSession]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isValid) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><Subjects /></ProtectedRoute>} />
      <Route path="/countdown" element={<ProtectedRoute><Countdown /></ProtectedRoute>} />
      <Route path="/plan" element={<ProtectedRoute><StudyPlan /></ProtectedRoute>} />
      <Route path="/pomodoro" element={<ProtectedRoute><Pomodoro /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
      <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
      <Route path="/wrong-notes" element={<ProtectedRoute><WrongNotes /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
