// 倒计时页面 - 支持主题切换、自定义颜色和背景图、子倒计时
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';

interface CountdownResponse { id: number; name: string; target_time: string; notify_enabled: boolean; remaining_days: number; remaining_hours: number; remaining_minutes: number; is_expired: boolean; }

// 子倒计时（本地存储）
interface SubCountdown { id: string; name: string; target_time: string; }

// 预设颜色
const PRESET_COLORS = [
  { name: '玫瑰红', gradient: 'from-rose-500 to-pink-500' },
  { name: '紫罗兰', gradient: 'from-violet-500 to-purple-500' },
  { name: '天空蓝', gradient: 'from-cyan-500 to-blue-500' },
  { name: '翡翠绿', gradient: 'from-emerald-500 to-teal-500' },
  { name: '琥珀橙', gradient: 'from-amber-500 to-orange-500' },
  { name: '靛蓝', gradient: 'from-indigo-500 to-blue-600' },
  { name: '珊瑚粉', gradient: 'from-pink-400 to-rose-400' },
  { name: '薄荷绿', gradient: 'from-green-400 to-emerald-400' },
  { name: '深紫', gradient: 'from-purple-600 to-indigo-600' },
  { name: '日落橙', gradient: 'from-orange-500 to-red-500' },
  { name: '极光绿', gradient: 'from-teal-400 to-cyan-400' },
  { name: '樱花粉', gradient: 'from-pink-300 to-rose-300' },
];

// 预设背景图 - 更多选择
const PRESET_BACKGROUNDS = [
  { name: '无背景', url: '', category: '纯色' },
  { name: '星空', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=400&fit=crop', category: '自然' },
  { name: '银河', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=400&fit=crop', category: '自然' },
  { name: '极光', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=400&fit=crop', category: '自然' },
  { name: '山峰', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=400&fit=crop', category: '自然' },
  { name: '雪山', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=400&fit=crop', category: '自然' },
  { name: '海洋', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop', category: '自然' },
  { name: '日落海滩', url: 'https://images.unsplash.com/photo-1495344517868-8ebaf0a2044a?w=600&h=400&fit=crop', category: '自然' },
  { name: '森林', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=400&fit=crop', category: '自然' },
  { name: '樱花', url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=600&h=400&fit=crop', category: '自然' },
  { name: '图书馆', url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=400&fit=crop', category: '学习' },
  { name: '书桌', url: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=600&h=400&fit=crop', category: '学习' },
  { name: '咖啡厅', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=400&fit=crop', category: '学习' },
  { name: '城市夜景', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&h=400&fit=crop', category: '城市' },
  { name: '东京塔', url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop', category: '城市' },
];

// 本地存储倒计时样式
interface CountdownStyle { color: string; bgImage: string; subCountdowns?: SubCountdown[]; }
const getStoredStyles = (): Record<number, CountdownStyle> => {
  try { return JSON.parse(localStorage.getItem('countdown-styles') || '{}'); } catch { return {}; }
};
const saveStyles = (styles: Record<number, CountdownStyle>) => {
  localStorage.setItem('countdown-styles', JSON.stringify(styles));
};

// 计算子倒计时剩余时间
const calcSubRemaining = (targetTime: string) => {
  const diff = new Date(targetTime).getTime() - Date.now();
  if (diff <= 0) return { text: '已到期', expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return { text: `${days}天${hours}时`, expired: false };
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { text: `${hours}时${mins}分`, expired: false };
};

export default function Countdown() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [countdowns, setCountdowns] = useState<CountdownResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newTargetTime, setNewTargetTime] = useState('00:00');
  const [newNotifyEnabled, setNewNotifyEnabled] = useState(true);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].gradient);
  const [newBgImage, setNewBgImage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState<CountdownResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // 编辑样式
  const [editStyleCountdown, setEditStyleCountdown] = useState<CountdownResponse | null>(null);
  const [editColor, setEditColor] = useState('');
  const [editBgImage, setEditBgImage] = useState('');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [styles, setStyles] = useState<Record<number, CountdownStyle>>({});
  // 子倒计时
  const [showSubDialog, setShowSubDialog] = useState<CountdownResponse | null>(null);
  const [subName, setSubName] = useState('');
  const [subDate, setSubDate] = useState('');
  const [subTime, setSubTime] = useState('00:00');
  // 展开的倒计时
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => { setStyles(getStoredStyles()); }, []);

  const loadCountdowns = async () => {
    if (!sessionToken) return;
    setIsLoading(true); setError(null);
    try { const result = await invoke<CountdownResponse[]>('get_countdowns', { sessionToken }); setCountdowns(result); }
    catch (e) { setError(e as string); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadCountdowns(); const interval = setInterval(loadCountdowns, 60000); return () => clearInterval(interval); }, [sessionToken]);

  const handleCreate = async () => {
    if (!sessionToken || !newName.trim() || !newTargetDate) return;
    setIsCreating(true);
    try {
      const targetTime = new Date(`${newTargetDate}T${newTargetTime}:00`).toISOString();
      await invoke('create_countdown', { sessionToken, name: newName.trim(), targetTime, notifyEnabled: newNotifyEnabled });
      // 保存样式到本地
      const result = await invoke<CountdownResponse[]>('get_countdowns', { sessionToken });
      const newCountdown = result.find(c => c.name === newName.trim());
      if (newCountdown) {
        const newStyles = { ...styles, [newCountdown.id]: { color: newColor, bgImage: newBgImage } };
        setStyles(newStyles); saveStyles(newStyles);
      }
      setShowCreateDialog(false); setNewName(''); setNewTargetDate(''); setNewTargetTime('00:00'); setNewNotifyEnabled(true);
      setNewColor(PRESET_COLORS[0].gradient); setNewBgImage('');
      await loadCountdowns();
    } catch (e) { setError(e as string); }
    finally { setIsCreating(false); }
  };

  const handleDelete = async () => {
    if (!sessionToken || !deleteCountdown) return;
    setIsDeleting(true);
    try {
      await invoke('delete_countdown', { sessionToken, countdownId: deleteCountdown.id });
      // 删除样式
      const newStyles = { ...styles }; delete newStyles[deleteCountdown.id];
      setStyles(newStyles); saveStyles(newStyles);
      setDeleteCountdown(null); await loadCountdowns();
    } catch (e) { setError(e as string); }
    finally { setIsDeleting(false); }
  };

  const handleSaveStyle = () => {
    if (!editStyleCountdown) return;
    const finalBgImage = customBgUrl.trim() || editBgImage;
    const existing = styles[editStyleCountdown.id] || {};
    const newStyles = { ...styles, [editStyleCountdown.id]: { ...existing, color: editColor, bgImage: finalBgImage } };
    setStyles(newStyles); saveStyles(newStyles);
    setEditStyleCountdown(null); setCustomBgUrl('');
  };

  const openEditStyle = (c: CountdownResponse) => {
    const style = styles[c.id] || { color: PRESET_COLORS[0].gradient, bgImage: '' };
    setEditColor(style.color); setEditBgImage(style.bgImage); setCustomBgUrl('');
    setEditStyleCountdown(c);
  };

  // 添加子倒计时
  const handleAddSub = () => {
    if (!showSubDialog || !subName.trim() || !subDate) return;
    const targetTime = `${subDate}T${subTime}:00`;
    const newSub: SubCountdown = { id: Date.now().toString(), name: subName.trim(), target_time: targetTime };
    const existing = styles[showSubDialog.id] || { color: PRESET_COLORS[0].gradient, bgImage: '' };
    const subs = existing.subCountdowns || [];
    const newStyles = { ...styles, [showSubDialog.id]: { ...existing, subCountdowns: [...subs, newSub] } };
    setStyles(newStyles); saveStyles(newStyles);
    setSubName(''); setSubDate(''); setSubTime('00:00'); setShowSubDialog(null);
  };

  // 删除子倒计时
  const handleDeleteSub = (parentId: number, subId: string) => {
    const existing = styles[parentId];
    if (!existing) return;
    const subs = (existing.subCountdowns || []).filter(s => s.id !== subId);
    const newStyles = { ...styles, [parentId]: { ...existing, subCountdowns: subs } };
    setStyles(newStyles); saveStyles(newStyles);
  };

  const formatRemaining = (c: CountdownResponse) => {
    if (c.is_expired) return '已到期';
    if (c.remaining_days > 0) return `${c.remaining_days} 天`;
    if (c.remaining_hours > 0) return `${c.remaining_hours} 小时`;
    return `${c.remaining_minutes} 分钟`;
  };

  const getStyle = (c: CountdownResponse, i: number) => {
    if (c.is_expired) return { color: 'from-slate-600 to-slate-700', bgImage: '' };
    const stored = styles[c.id];
    if (stored) return stored;
    return { color: PRESET_COLORS[i % PRESET_COLORS.length].gradient, bgImage: '' };
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>⏱️ 考试倒计时</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>每一天都在靠近目标</p>
        </div>
        <button onClick={() => setShowCreateDialog(true)} className={`px-4 py-2 bg-gradient-to-r ${themeConfig.accent} text-white rounded-lg font-medium hover:shadow-lg transition-all`}>+ 添加</button>
      </div>

      {error && (<div className="mx-4 mt-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between"><span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button></div>)}

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-16"><div className="w-10 h-10 border-3 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-3"></div><p className={themeConfig.textSecondary}>加载中...</p></div>
        ) : countdowns.length === 0 ? (
          <div onClick={() => setShowCreateDialog(true)} className={`${themeConfig.bgSecondary} rounded-xl p-12 text-center cursor-pointer hover:opacity-80 transition-all border-2 border-dashed ${themeConfig.border} hover:border-violet-500`}>
            <div className="text-5xl mb-3">⏱️</div>
            <p className={`${themeConfig.textSecondary} text-lg`}>暂无倒计时</p>
            <p className={`${themeConfig.textSecondary} text-sm mt-1`}>点击添加考试倒计时</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {countdowns.map((c, i) => {
              const style = getStyle(c, i);
              const subs = styles[c.id]?.subCountdowns || [];
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className={`rounded-xl text-white relative overflow-hidden group transition-all ${!style.bgImage ? `bg-gradient-to-br ${style.color}` : ''}`}
                  style={style.bgImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${style.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="relative p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold">{c.name}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => setShowSubDialog(c)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm" title="添加子倒计时">➕</button>
                        <button onClick={() => openEditStyle(c)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm" title="编辑样式">🎨</button>
                        <button onClick={() => setDeleteCountdown(c)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm">✕</button>
                      </div>
                    </div>
                    <div className="text-5xl font-black mb-3 group-hover:scale-105 transition-transform">{formatRemaining(c)}</div>
                    <div className="text-white/70 text-sm flex items-center gap-1">📅 {new Date(c.target_time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    {c.notify_enabled && !c.is_expired && <div className="mt-2 text-xs text-white/60">🔔 到期提醒已开启</div>}
                    {/* 子倒计时预览 */}
                    {subs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/20">
                        <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                          📋 {subs.length} 个阶段目标 {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    )}
                  </div>
                  {/* 展开的子倒计时列表 */}
                  {isExpanded && subs.length > 0 && (
                    <div className="px-6 pb-4 space-y-2">
                      {subs.map(sub => {
                        const remaining = calcSubRemaining(sub.target_time);
                        return (
                          <div key={sub.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                            <div>
                              <div className="text-sm font-medium">{sub.name}</div>
                              <div className="text-xs text-white/60">{new Date(sub.target_time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${remaining.expired ? 'text-white/50' : ''}`}>{remaining.text}</span>
                              <button onClick={() => handleDeleteSub(c.id, sub.id)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-xs">✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* 创建对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">⏱️ 添加倒计时</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">名称</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="如：考研初试" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-2">日期</label><input type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
                <div><label className="block text-sm text-slate-400 mb-2">时间</label><input type="time" value={newTargetTime} onChange={(e) => setNewTargetTime(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">🎨 选择颜色</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button key={c.gradient} onClick={() => setNewColor(c.gradient)} className={`h-10 rounded-lg bg-gradient-to-r ${c.gradient} transition-all ${newColor === c.gradient ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105' : 'hover:scale-105'}`} title={c.name} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">🖼️ 选择背景图</label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_BACKGROUNDS.map((bg) => (
                    <button key={bg.name} onClick={() => setNewBgImage(bg.url)} className={`h-16 rounded-lg overflow-hidden transition-all ${newBgImage === bg.url ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105' : 'hover:scale-105'} ${!bg.url ? 'bg-slate-700 flex items-center justify-center text-slate-400 text-xs' : ''}`}>
                      {bg.url ? <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" /> : '无'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                <input type="checkbox" id="notify" checked={newNotifyEnabled} onChange={(e) => setNewNotifyEnabled(e.target.checked)} className="w-4 h-4 text-violet-500 rounded" />
                <label htmlFor="notify" className="text-sm text-slate-300">🔔 到期时发送通知</label>
              </div>
              {/* 预览 */}
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">预览</div>
                <div className={`rounded-xl p-4 text-white ${!newBgImage ? `bg-gradient-to-r ${newColor}` : ''}`}
                  style={newBgImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${newBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  <div className="text-sm font-bold">{newName || '倒计时名称'}</div>
                  <div className="text-2xl font-black">XX 天</div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowCreateDialog(false); setNewName(''); setNewTargetDate(''); setNewColor(PRESET_COLORS[0].gradient); setNewBgImage(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleCreate} disabled={isCreating || !newName.trim() || !newTargetDate} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isCreating ? '添加中...' : '添加'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑样式对话框 */}
      {editStyleCountdown && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 m-4 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">🎨 编辑样式 - {editStyleCountdown.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">选择颜色</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button key={c.gradient} onClick={() => { setEditColor(c.gradient); setEditBgImage(''); setCustomBgUrl(''); }} className={`h-10 rounded-lg bg-gradient-to-r ${c.gradient} transition-all ${editColor === c.gradient && !editBgImage && !customBgUrl ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105' : 'hover:scale-105'}`} title={c.name} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">选择背景图</label>
                <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                  {PRESET_BACKGROUNDS.map((bg) => (
                    <button key={bg.name} onClick={() => { setEditBgImage(bg.url); setCustomBgUrl(''); }} className={`h-16 rounded-lg overflow-hidden transition-all ${editBgImage === bg.url && !customBgUrl ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105' : 'hover:scale-105'} ${!bg.url ? 'bg-slate-700 flex items-center justify-center text-slate-400 text-xs' : ''}`} title={bg.name}>
                      {bg.url ? <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" /> : '无'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">🔗 自定义背景图 URL</label>
                <input type="url" value={customBgUrl} onChange={(e) => setCustomBgUrl(e.target.value)} placeholder="粘贴图片链接..." className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" />
                <p className="text-xs text-slate-500 mt-1">支持任意图片链接，推荐使用 Unsplash 等图床</p>
              </div>
              {/* 预览 */}
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">预览</div>
                <div className={`rounded-xl p-4 text-white ${!(customBgUrl || editBgImage) ? `bg-gradient-to-r ${editColor}` : ''}`}
                  style={(customBgUrl || editBgImage) ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${customBgUrl || editBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  <div className="text-sm font-bold">{editStyleCountdown.name}</div>
                  <div className="text-2xl font-black">{formatRemaining(editStyleCountdown)}</div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setEditStyleCountdown(null); setCustomBgUrl(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSaveStyle} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加子倒计时对话框 */}
      {showSubDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">➕ 添加阶段目标 - {showSubDialog.name}</h3>
            <p className="text-sm text-slate-400 mb-4">在主倒计时内设置阶段性小目标，如：报名截止、准考证打印等</p>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">目标名称</label><input type="text" value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="如：报名截止" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-2">日期</label><input type="date" value={subDate} onChange={(e) => setSubDate(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
                <div><label className="block text-sm text-slate-400 mb-2">时间</label><input type="time" value={subTime} onChange={(e) => setSubTime(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowSubDialog(null); setSubName(''); setSubDate(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleAddSub} disabled={!subName.trim() || !subDate} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteCountdown && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-rose-400 mb-4">⚠️ 确认删除</h3>
            <p className="text-slate-300">确定删除 <span className="text-white font-medium">"{deleteCountdown.name}"</span>？</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteCountdown(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-rose-500 text-white rounded-lg disabled:opacity-50">{isDeleting ? '删除中...' : '删除'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
