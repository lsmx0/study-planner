// 番茄钟页面 - 支持主题切换、白噪音、快捷键
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';
import SubjectSelect from '../components/SubjectSelect';

interface PomodoroResponse {
  id: number;
  subject_id: number | null;
  subject_name: string | null;
  start_time: string;
  duration_minutes: number;
  status: string;
}

type TimerMode = 'work' | 'break';
type TimerState = 'idle' | 'running' | 'paused';

const WORK_PRESETS = [15, 25, 30, 45, 60];
const BREAK_PRESETS = [5, 10, 15, 20];

// 白噪音音效 - 使用 freesound.org 和其他可靠免费音效源
const WHITE_NOISE_SOUNDS = [
  { id: 'none', name: '无', icon: '🔇', url: '' },
  { id: 'rain', name: '雨声', icon: '🌧️', url: 'https://soundbible.com/mp3/Rain-SoundBible.com-2065240612.mp3' },
  { id: 'forest', name: '森林', icon: '🌲', url: 'https://soundbible.com/mp3/meadowlark_daniel-simion.mp3' },
  { id: 'ocean', name: '海浪', icon: '🌊', url: 'https://soundbible.com/mp3/Ocean_Waves-Mike_Koenig-980635527.mp3' },
  { id: 'fire', name: '篝火', icon: '🔥', url: 'https://soundbible.com/mp3/Campfire-SoundBible.com-1933587658.mp3' },
  { id: 'wind', name: '微风', icon: '🍃', url: 'https://soundbible.com/mp3/Wind-Mark_DiAngelo-1940285615.mp3' },
  { id: 'stream', name: '溪流', icon: '💧', url: 'https://soundbible.com/mp3/Small_Waterfall-Stephan_Schutze-1811758364.mp3' },
  { id: 'thunder', name: '雷雨', icon: '⛈️', url: 'https://soundbible.com/mp3/Thunder_Crack-Stickinthemud-1910420960.mp3' },
];

export default function Pomodoro() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [customWorkTime, setCustomWorkTime] = useState('');
  const [customBreakTime, setCustomBreakTime] = useState('');
  const [mode, setMode] = useState<TimerMode>('work');
  const [state, setState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [currentPomodoroId, setCurrentPomodoroId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [history, setHistory] = useState<PomodoroResponse[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  // 白噪音
  const [currentSound, setCurrentSound] = useState('none');
  const [soundVolume, setSoundVolume] = useState(50);
  const [showSoundPanel, setShowSoundPanel] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadHistory = async () => {
    if (!sessionToken) return;
    setIsLoadingHistory(true);
    try {
      const result = await invoke<PomodoroResponse[]>('get_pomodoro_history', { sessionToken, limit: 20 });
      setHistory(result);
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = result.filter(r => r.status === 'completed' && r.start_time.startsWith(today));
      setTodayCount(todayRecords.length);
      setTodayMinutes(todayRecords.reduce((sum, r) => sum + r.duration_minutes, 0));
    } catch (e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  };

  useEffect(() => { loadHistory(); }, [sessionToken]);
  useEffect(() => { if (state === 'idle') setTimeLeft(mode === 'work' ? workDuration * 60 : breakDuration * 60); }, [workDuration, breakDuration, mode, state]);

  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { handleTimerComplete(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state]);

  const handleTimerComplete = async () => {
    setState('idle');
    if (mode === 'work' && currentPomodoroId && sessionToken) {
      try { await invoke('complete_pomodoro', { sessionToken, pomodoroId: currentPomodoroId, durationMinutes: workDuration }); await loadHistory(); }
      catch (e) { setError(e as string); }
      setCurrentPomodoroId(null);
      setMode('break'); setTimeLeft(breakDuration * 60);
    } else { setMode('work'); setTimeLeft(workDuration * 60); }
  };

  const handleStart = async () => {
    if (mode === 'work' && !currentPomodoroId && sessionToken) {
      try {
        const result = await invoke<PomodoroResponse>('start_pomodoro', { sessionToken, subjectId: selectedSubjectId, taskId: null });
        setCurrentPomodoroId(result.id);
      } catch (e) { setError(e as string); return; }
    }
    setState('running');
    // 播放白噪音
    if (currentSound !== 'none') playSound(currentSound);
  };

  const handlePause = () => setState('paused');
  const handleResume = () => setState('running');

  const handleCancel = async () => {
    setState('idle');
    if (currentPomodoroId && sessionToken) {
      const totalSeconds = mode === 'work' ? workDuration * 60 : breakDuration * 60;
      const elapsedMinutes = Math.floor((totalSeconds - timeLeft) / 60);
      try { await invoke('cancel_pomodoro', { sessionToken, pomodoroId: currentPomodoroId, durationMinutes: elapsedMinutes }); await loadHistory(); }
      catch (e) { setError(e as string); }
      setCurrentPomodoroId(null);
    }
    setMode('work'); setTimeLeft(workDuration * 60);
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const totalSeconds = mode === 'work' ? workDuration * 60 : breakDuration * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  const handleSetCustomWork = () => { const t = parseInt(customWorkTime); if (t > 0 && t <= 120) { setWorkDuration(t); setCustomWorkTime(''); } };
  const handleSetCustomBreak = () => { const t = parseInt(customBreakTime); if (t > 0 && t <= 60) { setBreakDuration(t); setCustomBreakTime(''); } };

  // 白噪音加载状态
  const [soundLoading, setSoundLoading] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 白噪音控制
  const playSound = useCallback((soundId: string) => {
    const sound = WHITE_NOISE_SOUNDS.find(s => s.id === soundId);
    setSoundError(null);
    
    // 先停止当前音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    
    if (sound && sound.url) {
      setSoundLoading(true);
      const audio = new Audio();
      audio.loop = true;
      audio.volume = soundVolume / 100;
      audio.preload = 'auto';
      
      // 等待音频加载完成后再播放
      audio.oncanplaythrough = () => {
        setSoundLoading(false);
        audio.play()
          .then(() => setIsPlaying(true))
          .catch((e) => {
            // 忽略被中断的播放错误
            if (e.name !== 'AbortError') {
              setSoundError('播放失败，请重试');
            }
          });
      };
      
      audio.onerror = () => {
        setSoundLoading(false);
        setSoundError('音频加载失败，请尝试其他音效');
      };
      
      audio.src = sound.url;
      audioRef.current = audio;
    }
    setCurrentSound(soundId);
  }, [soundVolume]);

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setCurrentSound('none');
    setIsPlaying(false);
    setSoundLoading(false);
  }, []);

  // 音量变化时更新
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = soundVolume / 100;
  }, [soundVolume]);

  // 计时器停止时停止音效
  useEffect(() => {
    if (state === 'idle' && currentSound !== 'none') stopSound();
  }, [state, currentSound, stopSound]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'idle') handleStart();
        else if (state === 'running') handlePause();
        else if (state === 'paused') handleResume();
      } else if (e.code === 'Escape' && state !== 'idle') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>🍅 番茄钟</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>专注学习，高效时间管理</p>
        </div>
        <div className={`text-xs ${themeConfig.textSecondary} flex items-center gap-2`}>
          <span className="px-2 py-1 bg-slate-700/50 rounded">空格</span> 开始/暂停
          <span className="px-2 py-1 bg-slate-700/50 rounded">Esc</span> 取消
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between">
          <span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {/* 今日统计 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="text-2xl font-bold text-rose-400">{todayCount}</div><div className={`text-xs ${themeConfig.textSecondary}`}>今日番茄</div></div>
          <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="text-2xl font-bold text-orange-400">{todayMinutes}</div><div className={`text-xs ${themeConfig.textSecondary}`}>专注分钟</div></div>
          <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="text-2xl font-bold text-amber-400">{workDuration}</div><div className={`text-xs ${themeConfig.textSecondary}`}>工作时长</div></div>
          <div className={`${themeConfig.bgSecondary} rounded-xl p-4 border ${themeConfig.border}`}><div className="text-2xl font-bold text-emerald-400">{breakDuration}</div><div className={`text-xs ${themeConfig.textSecondary}`}>休息时长</div></div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 计时器 */}
          <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-6`}>
            <div className="flex justify-center gap-3 mb-6">
              <button onClick={() => { if (state === 'idle') { setMode('work'); setTimeLeft(workDuration * 60); } }}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${mode === 'work' ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary}`}`} disabled={state !== 'idle'}>
                🍅 工作 {workDuration}分钟
              </button>
              <button onClick={() => { if (state === 'idle') { setMode('break'); setTimeLeft(breakDuration * 60); } }}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${mode === 'break' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary}`}`} disabled={state !== 'idle'}>
                ☕ 休息 {breakDuration}分钟
              </button>
            </div>

            {/* 计时器显示 */}
            <div className="relative w-56 h-56 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="112" cy="112" r="100" fill="none" stroke="#334155" strokeWidth="10" />
                <circle cx="112" cy="112" r="100" fill="none" stroke={mode === 'work' ? 'url(#workGrad)' : 'url(#breakGrad)'} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 100} strokeDashoffset={2 * Math.PI * 100 * (1 - progress / 100)} className="transition-all duration-1000" />
                <defs>
                  <linearGradient id="workGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#F43F5E" /><stop offset="100%" stopColor="#F97316" /></linearGradient>
                  <linearGradient id="breakGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#14B8A6" /></linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-5xl font-bold font-mono ${mode === 'work' ? 'text-rose-400' : 'text-emerald-400'}`}>{formatTime(timeLeft)}</div>
                <div className="text-slate-500 mt-2 text-sm">{mode === 'work' ? '🎯 专注工作' : '☕ 休息一下'}</div>
                {state === 'running' && <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>进行中</div>}
              </div>
            </div>

            {mode === 'work' && state === 'idle' && (
              <div className="mb-4"><label className="block text-sm text-slate-400 mb-2">选择科目（可选）</label><SubjectSelect value={selectedSubjectId} onChange={setSelectedSubjectId} placeholder="选择科目" /></div>
            )}

            {/* 白噪音按钮 */}
            <div className="mb-4 flex justify-center">
              <button onClick={() => setShowSoundPanel(!showSoundPanel)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${currentSound !== 'none' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary} border ${themeConfig.border}`}`}>
                {WHITE_NOISE_SOUNDS.find(s => s.id === currentSound)?.icon || '🔇'} 白噪音 {currentSound !== 'none' && '▸'}
              </button>
            </div>

            {/* 白噪音面板 */}
            {showSoundPanel && (
              <div className={`mb-4 p-4 ${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-sm font-medium ${themeConfig.text}`}>🎵 选择背景音</span>
                  <button onClick={() => setShowSoundPanel(false)} className={`${themeConfig.textSecondary} hover:${themeConfig.text}`}>✕</button>
                </div>
                {soundError && (
                  <div className="mb-3 p-2 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                    ⚠️ {soundError}
                  </div>
                )}
                {soundLoading && (
                  <div className="mb-3 p-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></span>
                    加载音效中...
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {WHITE_NOISE_SOUNDS.map(sound => (
                    <button key={sound.id} onClick={() => sound.id === 'none' ? stopSound() : (state !== 'idle' ? playSound(sound.id) : setCurrentSound(sound.id))}
                      className={`p-2 rounded-lg text-center transition-all ${currentSound === sound.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary} border ${themeConfig.border} hover:border-cyan-500/30`}`}>
                      <div className="text-xl mb-1">{sound.icon}</div>
                      <div className="text-xs">{sound.name}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${themeConfig.textSecondary}`}>🔊</span>
                  <input type="range" min="0" max="100" value={soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                  <span className={`text-xs ${themeConfig.textSecondary} w-8`}>{soundVolume}%</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => currentSound !== 'none' && playSound(currentSound)} disabled={currentSound === 'none' || soundLoading} 
                    className="flex-1 px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs disabled:opacity-50 hover:bg-cyan-500/30 transition-all">
                    {soundLoading ? '⏳ 加载中...' : '▶ 试听'}
                  </button>
                  <button onClick={stopSound} disabled={!isPlaying && !soundLoading}
                    className="flex-1 px-3 py-2 bg-slate-600/50 text-slate-300 rounded-lg text-xs disabled:opacity-50 hover:bg-slate-600 transition-all">
                    ⏹ 停止
                  </button>
                </div>
                {isPlaying && (
                  <div className="mt-2 p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    正在播放: {WHITE_NOISE_SOUNDS.find(s => s.id === currentSound)?.name}
                  </div>
                )}
                <p className={`text-xs ${themeConfig.textSecondary} mt-2`}>💡 开始计时后自动播放选中的音效</p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              {state === 'idle' && (
                <button onClick={handleStart} className={`px-8 py-3 rounded-xl text-white font-bold transition-all hover:scale-105 ${mode === 'work' ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}>▶ 开始</button>
              )}
              {state === 'running' && (
                <><button onClick={handlePause} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-bold">⏸ 暂停</button>
                <button onClick={handleCancel} className="px-6 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold">✕ 取消</button></>
              )}
              {state === 'paused' && (
                <><button onClick={handleResume} className={`px-6 py-3 rounded-xl text-white font-bold ${mode === 'work' ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}>▶ 继续</button>
                <button onClick={handleCancel} className="px-6 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold">✕ 取消</button></>
              )}
            </div>
          </div>

          {/* 右侧面板 */}
          <div className="space-y-4">
            {/* 时间设置 */}
            <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
              <h3 className={`${themeConfig.text} font-bold mb-4`}>⏱️ 时间设置</h3>
              <div className="mb-4">
                <label className={`block text-sm ${themeConfig.textSecondary} mb-2`}>工作时长</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {WORK_PRESETS.map(t => (
                    <button key={t} onClick={() => state === 'idle' && setWorkDuration(t)} disabled={state !== 'idle'}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${workDuration === t ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary} disabled:opacity-50`}`}>{t}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="number" value={customWorkTime} onChange={(e) => setCustomWorkTime(e.target.value)} placeholder="自定义" disabled={state !== 'idle'}
                    className={`flex-1 px-3 py-1.5 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm disabled:opacity-50`} min="1" max="120" />
                  <button onClick={handleSetCustomWork} disabled={state !== 'idle' || !customWorkTime} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded-lg text-sm disabled:opacity-50">设置</button>
                </div>
              </div>
              <div>
                <label className={`block text-sm ${themeConfig.textSecondary} mb-2`}>休息时长</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {BREAK_PRESETS.map(t => (
                    <button key={t} onClick={() => state === 'idle' && setBreakDuration(t)} disabled={state !== 'idle'}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${breakDuration === t ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary} disabled:opacity-50`}`}>{t}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="number" value={customBreakTime} onChange={(e) => setCustomBreakTime(e.target.value)} placeholder="自定义" disabled={state !== 'idle'}
                    className={`flex-1 px-3 py-1.5 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} text-sm disabled:opacity-50`} min="1" max="60" />
                  <button onClick={handleSetCustomBreak} disabled={state !== 'idle' || !customBreakTime} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm disabled:opacity-50">设置</button>
                </div>
              </div>
            </div>

            {/* 历史记录 */}
            <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} p-4`}>
              <h3 className={`${themeConfig.text} font-bold mb-4`}>📋 最近记录</h3>
              {isLoadingHistory ? <div className={`text-center ${themeConfig.textSecondary} py-6`}>加载中...</div>
              : history.length === 0 ? <div className="text-center py-6"><div className="text-3xl mb-2">🍅</div><p className={`${themeConfig.textSecondary} text-sm`}>暂无记录</p></div>
              : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.slice(0, 10).map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg border ${item.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' : item.status === 'cancelled' ? 'border-slate-500/20 bg-slate-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${item.status === 'completed' ? 'text-emerald-400' : item.status === 'cancelled' ? 'text-slate-400' : 'text-amber-400'}`}>
                            {item.status === 'completed' ? '✓' : item.status === 'cancelled' ? '✗' : '⏳'}
                          </span>
                          <div><div className="text-sm text-white">{item.duration_minutes}分钟</div>{item.subject_name && <div className="text-xs text-slate-500">{item.subject_name}</div>}</div>
                        </div>
                        <div className="text-xs text-slate-500">{new Date(item.start_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
