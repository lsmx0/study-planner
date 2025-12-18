// AI 答疑页面 - 支持主题切换和 Markdown 渲染
import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIConfigResponse {
  api_key_masked: string;
  model_name: string;
  is_configured: boolean;
}

// 预设问题
const PRESET_QUESTIONS = [
  { icon: '📚', text: '考研数学怎么复习最有效？' },
  { icon: '📖', text: '英语阅读理解有什么技巧？' },
  { icon: '🎯', text: '政治选择题怎么提高正确率？' },
  { icon: '⏰', text: '如何制定合理的复习计划？' },
  { icon: '😰', text: '考研压力大怎么调节心态？' },
  { icon: '📝', text: '专业课背诵有什么好方法？' },
];

export default function AIChat() {
  const { sessionToken, user } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfigResponse | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('Qwen/Qwen2.5-7B-Instruct');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载 AI 配置
  useEffect(() => {
    const loadConfig = async () => {
      if (!sessionToken) return;
      try {
        const config = await invoke<AIConfigResponse>('get_ai_config', { sessionToken });
        setAiConfig(config);
        setModelName(config.model_name);
      } catch (e) { console.error(e); }
    };
    loadConfig();
  }, [sessionToken]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent || !sessionToken || !aiConfig?.is_configured) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await invoke<string>('ai_chat', {
        sessionToken,
        message: messageContent,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `抱歉，出现了错误：${e}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!sessionToken || !apiKey) return;
    setIsSavingConfig(true);
    try {
      await invoke('save_ai_config', { sessionToken, apiKey, modelName, apiEndpoint: null });
      const config = await invoke<AIConfigResponse>('get_ai_config', { sessionToken });
      setAiConfig(config);
      setShowConfigDialog(false);
      setApiKey('');
    } catch (e) { console.error(e); }
    finally { setIsSavingConfig(false); }
  };

  // 清空对话
  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div>
          <h1 className={`text-xl font-bold ${themeConfig.text} flex items-center gap-2`}>🤖 AI 答疑助手</h1>
          <p className={`${themeConfig.textSecondary} text-sm`}>有任何考研问题都可以问我</p>
        </div>
        <div className="flex items-center gap-2">
          {aiConfig?.is_configured && (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs">{aiConfig.model_name.split('/').pop()}</span>
          )}
          <button onClick={handleClear} className={`px-3 py-2 ${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/5 rounded-lg transition`}>清空对话</button>
          <button onClick={() => setShowConfigDialog(true)} className={`px-3 py-2 ${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/5 rounded-lg transition`}>⚙️ 配置</button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!aiConfig?.is_configured ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">🔑</div>
            <h2 className="text-xl font-bold text-white mb-2">请先配置 AI API</h2>
            <p className="text-slate-400 mb-4">需要配置硅基流动 API Key 才能使用 AI 功能</p>
            <button onClick={() => setShowConfigDialog(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
              配置 API Key
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className={`text-xl font-bold ${themeConfig.text} mb-2`}>你好，{user?.display_name}！</h2>
            <p className={`${themeConfig.textSecondary} mb-6`}>我是你的 AI 学习助手，有任何考研问题都可以问我</p>
            
            {/* 预设问题 */}
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {PRESET_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => handleSend(q.text)}
                  className={`flex items-center gap-2 px-4 py-3 ${themeConfig.bgSecondary} hover:opacity-80 border ${themeConfig.border} rounded-xl text-left transition-all text-sm`}>
                  <span className="text-xl">{q.icon}</span>
                  <span className={themeConfig.text}>{q.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? `bg-gradient-to-r ${themeConfig.accent} text-white` 
                    : `${themeConfig.bgSecondary} ${themeConfig.text} border ${themeConfig.border}`
                }`}>
                  {msg.role === 'assistant' && <div className="text-cyan-400 text-xs mb-1 font-medium">🤖 AI 助手</div>}
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:bg-slate-700 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-slate-700 [&_pre]:p-2 [&_pre]:rounded-lg [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                  )}
                  <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-white/60' : themeConfig.textSecondary}`}>
                    {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className={`${themeConfig.bgSecondary} rounded-2xl px-4 py-3 border ${themeConfig.border}`}>
                  <div className={`flex items-center gap-2 ${themeConfig.textSecondary}`}>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <span className="ml-2 text-sm">思考中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      {aiConfig?.is_configured && (
        <div className={`p-4 border-t ${themeConfig.border}`}>
          <div className="flex gap-3">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className={`flex-1 px-4 py-3 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-xl ${themeConfig.text} placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
              placeholder="输入你的问题..." disabled={isLoading} />
            <button onClick={() => handleSend()} disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 transition-all">
              发送
            </button>
          </div>
        </div>
      )}

      {/* 配置对话框 */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">🔑 配置 AI API</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white" placeholder="sk-..." />
                <p className="text-xs text-slate-500 mt-2">请在 <a href="https://siliconflow.cn" target="_blank" className="text-cyan-400 hover:underline">硅基流动</a> 获取 API Key</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">模型选择</label>
                <select value={modelName} onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white">
                  <optgroup label="🆓 免费模型">
                    <option value="Qwen/Qwen2.5-7B-Instruct">Qwen2.5-7B-Instruct</option>
                    <option value="Qwen/Qwen2.5-Coder-7B-Instruct">Qwen2.5-Coder-7B (编程)</option>
                    <option value="THUDM/glm-4-9b-chat">GLM-4-9B-Chat</option>
                    <option value="internlm/internlm2_5-7b-chat">InternLM2.5-7B-Chat</option>
                  </optgroup>
                  <optgroup label="⭐ 通义千问系列">
                    <option value="Qwen/Qwen2.5-14B-Instruct">Qwen2.5-14B-Instruct</option>
                    <option value="Qwen/Qwen2.5-32B-Instruct">Qwen2.5-32B-Instruct</option>
                    <option value="Qwen/Qwen2.5-72B-Instruct">Qwen2.5-72B-Instruct</option>
                    <option value="Qwen/Qwen2.5-Coder-32B-Instruct">Qwen2.5-Coder-32B (编程)</option>
                    <option value="Qwen/QwQ-32B-Preview">QwQ-32B-Preview (推理)</option>
                  </optgroup>
                  <optgroup label="🔥 DeepSeek 系列">
                    <option value="deepseek-ai/DeepSeek-V2.5">DeepSeek-V2.5</option>
                    <option value="deepseek-ai/DeepSeek-V3">DeepSeek-V3 (最新)</option>
                    <option value="deepseek-ai/DeepSeek-Coder-V2-Instruct">DeepSeek-Coder-V2 (编程)</option>
                  </optgroup>
                  <optgroup label="🌟 其他模型">
                    <option value="THUDM/glm-4-9b-chat">GLM-4-9B-Chat</option>
                    <option value="01-ai/Yi-1.5-34B-Chat">Yi-1.5-34B-Chat</option>
                    <option value="meta-llama/Meta-Llama-3.1-70B-Instruct">Llama-3.1-70B</option>
                    <option value="meta-llama/Meta-Llama-3.1-405B-Instruct">Llama-3.1-405B</option>
                  </optgroup>
                </select>
                <p className="text-xs text-slate-500 mt-2">💡 免费模型适合日常使用，大模型效果更好但需要付费</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowConfigDialog(false); setApiKey(''); }} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-xl">取消</button>
              <button onClick={handleSaveConfig} disabled={isSavingConfig || !apiKey}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl disabled:opacity-50">
                {isSavingConfig ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
