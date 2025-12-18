// 用户管理页面 - 支持主题切换
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';

interface User { id: number; username: string; display_name: string; role: string; role_label: string; created_at: string; }

export default function UserManagement() {
  const { sessionToken, user: currentUser } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const loadUsers = async () => {
    if (!sessionToken) return;
    setIsLoading(true); setError(null);
    try { const result = await invoke<User[]>('get_all_users', { sessionToken }); setUsers(result); }
    catch (e) { setError(e as string); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [sessionToken]);

  const handleCreate = async () => {
    if (!sessionToken || !newUsername.trim() || !newPassword || !newDisplayName.trim()) return;
    setIsCreating(true);
    try {
      await invoke('create_user', { sessionToken, username: newUsername.trim(), password: newPassword, displayName: newDisplayName.trim(), role: newRole });
      setShowCreateDialog(false); setNewUsername(''); setNewPassword(''); setNewDisplayName(''); setNewRole('user'); await loadUsers();
    } catch (e) { setError(e as string); }
    finally { setIsCreating(false); }
  };

  const handleDelete = async () => {
    if (!sessionToken || !deleteUser) return;
    setIsDeleting(true);
    try { await invoke('delete_user', { sessionToken, userId: deleteUser.id }); setDeleteUser(null); await loadUsers(); }
    catch (e) { setError(e as string); }
    finally { setIsDeleting(false); }
  };

  const handleResetPassword = async () => {
    if (!sessionToken || !resetUser || !resetPassword) return;
    setIsResetting(true);
    try { await invoke('reset_user_password', { sessionToken, userId: resetUser.id, newPassword: resetPassword }); setResetUser(null); setResetPassword(''); }
    catch (e) { setError(e as string); }
    finally { setIsResetting(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text}`}>👥 用户管理</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>管理系统用户</p>
        </div>
        <button onClick={() => setShowCreateDialog(true)}
          className={`px-4 py-2 bg-gradient-to-r ${themeConfig.accent} text-white rounded-lg font-medium hover:shadow-lg transition-all`}>
          + 添加用户
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
        ) : (
          <div className={`${themeConfig.bgSecondary} rounded-xl border ${themeConfig.border} overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${themeConfig.border}`}>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${themeConfig.textSecondary}`}>用户</th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${themeConfig.textSecondary}`}>账号</th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${themeConfig.textSecondary}`}>角色</th>
                  <th className={`px-4 py-3 text-left text-sm font-medium ${themeConfig.textSecondary}`}>创建时间</th>
                  <th className={`px-4 py-3 text-right text-sm font-medium ${themeConfig.textSecondary}`}>操作</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${themeConfig.border}`}>
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 bg-gradient-to-br ${themeConfig.accent} rounded-full flex items-center justify-center text-white text-sm font-bold`}>{user.display_name.charAt(0)}</div>
                        <span className={`${themeConfig.text} font-medium`}>{user.display_name}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${themeConfig.textSecondary} font-mono text-sm`}>{user.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : `${themeConfig.bgSecondary} ${themeConfig.textSecondary}`}`}>{user.role_label}</span>
                    </td>
                    <td className={`px-4 py-3 ${themeConfig.textSecondary} text-sm`}>{new Date(user.created_at).toLocaleDateString('zh-CN')}</td>
                    <td className="px-4 py-3 text-right">
                      {user.id !== currentUser?.id && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setResetUser(user)} className={`px-2 py-1 text-xs ${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/10 rounded transition-all`}>重置密码</button>
                          <button onClick={() => setDeleteUser(user)} className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-all">删除</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建用户对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">👤 添加用户</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">用户名</label><input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="登录用户名" /></div>
              <div><label className="block text-sm text-slate-400 mb-2">密码</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="登录密码" /></div>
              <div><label className="block text-sm text-slate-400 mb-2">昵称</label><input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="显示名称" /></div>
              <div><label className="block text-sm text-slate-400 mb-2">角色</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white">
                  <option value="user">普通用户</option><option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowCreateDialog(false); setNewUsername(''); setNewPassword(''); setNewDisplayName(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleCreate} disabled={isCreating || !newUsername.trim() || !newPassword || !newDisplayName.trim()} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isCreating ? '添加中...' : '添加'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-rose-400 mb-4">⚠️ 确认删除</h3>
            <p className="text-slate-300">确定删除用户 <span className="text-white font-medium">"{deleteUser.display_name}"</span>？该用户的所有数据将被删除。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-rose-500 text-white rounded-lg disabled:opacity-50">{isDeleting ? '删除中...' : '删除'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码 */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">🔑 重置密码</h3>
            <p className="text-slate-400 text-sm mb-4">为用户 <span className="text-white">{resetUser.display_name}</span> 设置新密码</p>
            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="输入新密码" />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setResetUser(null); setResetPassword(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleResetPassword} disabled={isResetting || !resetPassword} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isResetting ? '重置中...' : '重置'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
