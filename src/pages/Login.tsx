// 登录页面 - 深色主题美化版
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!username.trim() || !password.trim()) return;
    const success = await login(username, password);
    if (success) navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '0.5s'}}></div>
      </div>

      {/* 登录卡片 */}
      <div className="relative bg-slate-800/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl w-[420px] border border-white/10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-2xl shadow-purple-500/40 hover:scale-110 transition-transform cursor-pointer">
            <span className="text-5xl">📚</span>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">考研学习规划助手</h1>
          <p className="text-slate-400 mt-2">登录以开始你的学习之旅 ✨</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-5 p-4 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400 text-sm flex items-center gap-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}


        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">👤 用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-4 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white text-lg placeholder-slate-500 transition-all hover:bg-slate-700/70"
              placeholder="请输入用户名" disabled={isLoading} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">🔒 密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white text-lg placeholder-slate-500 transition-all hover:bg-slate-700/70"
              placeholder="请输入密码" disabled={isLoading} />
          </div>

          <button type="submit" disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold text-lg rounded-2xl transition-all duration-300 flex items-center justify-center shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:-translate-y-1 disabled:shadow-none disabled:translate-y-0">
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                登录中...
              </>
            ) : (
              <>🚀 开始学习</>
            )}
          </button>
        </form>

        {/* 底部装饰 */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">考研加油，你一定行！💪</p>
        </div>
      </div>
    </div>
  );
}
