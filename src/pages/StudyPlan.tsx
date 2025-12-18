// 学习规划页面 - 支持主题切换、任务编辑、拖拽排序、长期计划
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, THEMES } from '../stores/themeStore';
import SubjectSelect from '../components/SubjectSelect';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskResponse {
  id: number;
  subject_id: number | null;
  subject_name: string | null;
  subject_color: string | null;
  task_date: string;
  start_time: string;
  end_time: string;
  content: string;
  status: string;
  alarm_enabled: boolean;
  alarm_time: string | null;
}

interface AIConfigResponse { api_key_masked: string; model_name: string; is_configured: boolean; }
interface AIContext { exam_date: string | null; subjects: string[]; incomplete_tasks: string[]; review_content: string | null; long_term_plans?: string[]; }
interface TaskSuggestion { start_time: string; end_time: string; content: string; subject: string; }
interface Subject { id: number; name: string; color: string; }
interface StudyPreference { id: number; daily_hours: number; start_time: string; end_time: string; lunch_break_start: string; lunch_break_end: string; study_phase: string; study_phase_label: string; focus_subjects: string[]; weak_subjects: string[]; exam_date: string | null; days_until_exam: number | null; notes: string | null; }

// 长期计划类型
interface LongTermPlan {
  id: string;
  type: 'week' | 'month' | 'custom';
  title: string;
  startDate: string;
  endDate: string;
  goals: string[];
  createdAt: string;
}

// AI 模型列表
const AI_MODELS = [
  { group: '🆓 免费模型', models: [
    { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct' },
    { value: 'Qwen/Qwen2.5-Coder-7B-Instruct', label: 'Qwen2.5-Coder-7B (编程)' },
    { value: 'THUDM/glm-4-9b-chat', label: 'GLM-4-9B-Chat' },
    { value: 'internlm/internlm2_5-7b-chat', label: 'InternLM2.5-7B-Chat' },
  ]},
  { group: '⭐ 通义千问系列', models: [
    { value: 'Qwen/Qwen2.5-14B-Instruct', label: 'Qwen2.5-14B-Instruct' },
    { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B-Instruct' },
    { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B-Instruct' },
    { value: 'Qwen/QwQ-32B-Preview', label: 'QwQ-32B-Preview (推理)' },
  ]},
  { group: '🔥 DeepSeek 系列', models: [
    { value: 'deepseek-ai/DeepSeek-V2.5', label: 'DeepSeek-V2.5' },
    { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3 (最新)' },
  ]},
];

// 本地存储长期计划
const getStoredPlans = (): LongTermPlan[] => {
  try { return JSON.parse(localStorage.getItem('long-term-plans') || '[]'); } catch { return []; }
};
const savePlans = (plans: LongTermPlan[]) => localStorage.setItem('long-term-plans', JSON.stringify(plans));

type TabType = 'plan' | 'ai' | 'check' | 'settings' | 'longterm';
const STUDY_PHASES = [
  { value: 'foundation', label: '基础阶段', desc: '3-6月，打牢基础知识' },
  { value: 'strengthen', label: '强化阶段', desc: '7-10月，强化训练做题' },
  { value: 'sprint', label: '冲刺阶段', desc: '11-12月，查漏补缺冲刺' },
];

// 可拖拽任务项组件
function SortableTaskItem({ task, getStatusDisplay, formatTime, handleToggleStatus, openEditDialog, setDeleteTask }: {
  task: TaskResponse; getStatusDisplay: (s: string) => { icon: string; color: string; bg: string };
  formatTime: (t: string) => string; handleToggleStatus: (id: number) => void;
  openEditDialog: (t: TaskResponse) => void; setDeleteTask: (t: TaskResponse) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1000 : 1 };
  const status = getStatusDisplay(task.status);
  return (
    <div ref={setNodeRef} style={style} className={`p-4 flex items-center gap-3 hover:bg-white/5 transition-colors group ${task.status === 'completed' ? 'opacity-60' : ''} ${isDragging ? 'bg-slate-700/50 rounded-lg' : ''}`}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 px-1">⋮⋮</div>
      <button onClick={() => handleToggleStatus(task.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${status.bg} ${status.color} hover:scale-110 transition-all`}>{status.icon}</button>
      <div className="w-24 text-xs font-mono text-slate-500 bg-slate-700/50 px-2 py-1 rounded">{formatTime(task.start_time)}-{formatTime(task.end_time)}</div>
      {task.subject_name && <span className="px-2 py-0.5 text-xs rounded text-white" style={{ backgroundColor: task.subject_color || '#6B7280' }}>{task.subject_name}</span>}
      <div className={`flex-1 text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.content}</div>
      {task.alarm_enabled && <span className="text-amber-400 text-sm">🔔</span>}
      <button onClick={() => openEditDialog(task)} className="w-6 h-6 text-slate-500 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all" title="编辑">✎</button>
      <button onClick={() => setDeleteTask(task)} className="w-6 h-6 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all" title="删除">✕</button>
    </div>
  );
}

export default function StudyPlan() {
  const { sessionToken } = useAuthStore();
  const { theme } = useThemeStore();
  const themeConfig = THEMES[theme];
  const [activeTab, setActiveTab] = useState<TabType>('plan');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 创建/编辑任务
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [taskSubjectId, setTaskSubjectId] = useState<number | null>(null);
  const [taskStartTime, setTaskStartTime] = useState('08:00');
  const [taskEndTime, setTaskEndTime] = useState('09:00');
  const [taskContent, setTaskContent] = useState('');
  const [taskAlarmEnabled, setTaskAlarmEnabled] = useState(false);
  const [taskAlarmTime, setTaskAlarmTime] = useState('07:55');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [deleteTask, setDeleteTask] = useState<TaskResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // AI 相关
  const [aiConfig, setAiConfig] = useState<AIConfigResponse | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIConfigDialog, setShowAIConfigDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('Qwen/Qwen2.5-7B-Instruct');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [aiUserInput, setAiUserInput] = useState('');
  const [selectedAISubjects, setSelectedAISubjects] = useState<string[]>([]);
  // AI 建议编辑
  const [editingSuggestion, setEditingSuggestion] = useState<number | null>(null);
  // AI 模型选择
  const [selectedModel, setSelectedModel] = useState('Qwen/Qwen2.5-7B-Instruct');
  // 是否参考长期计划
  const [useLongTermPlans, setUseLongTermPlans] = useState(true);
  
  // 长期计划
  const [longTermPlans, setLongTermPlans] = useState<LongTermPlan[]>(getStoredPlans());
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LongTermPlan | null>(null);
  const [planType, setPlanType] = useState<'week' | 'month' | 'custom'>('week');
  const [planTitle, setPlanTitle] = useState('');
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [planGoals, setPlanGoals] = useState<string[]>(['']);
  const [viewingPlan, setViewingPlan] = useState<LongTermPlan | null>(null);
  
  // 内容检查
  const [inputContent, setInputContent] = useState('');
  const [matchedTasks, setMatchedTasks] = useState<TaskResponse[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  // 学习偏好
  const [preference, setPreference] = useState<StudyPreference | null>(null);
  const [prefDailyHours, setPrefDailyHours] = useState(8);
  const [prefStartTime, setPrefStartTime] = useState('07:00');
  const [prefEndTime, setPrefEndTime] = useState('22:00');
  const [prefLunchStart, setPrefLunchStart] = useState('12:00');
  const [prefLunchEnd, setPrefLunchEnd] = useState('14:00');
  const [prefPhase, setPrefPhase] = useState('foundation');
  const [prefFocusSubjects, setPrefFocusSubjects] = useState<string[]>([]);
  const [prefWeakSubjects, setPrefWeakSubjects] = useState<string[]>([]);
  const [prefExamDate, setPrefExamDate] = useState('');
  const [prefNotes, setPrefNotes] = useState('');
  const [isSavingPref, setIsSavingPref] = useState(false);

  const loadTasks = async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    try { const result = await invoke<TaskResponse[]>('get_tasks_by_date', { sessionToken, date: selectedDate }); setTasks(result); }
    catch (e) { setError(e as string); }
    finally { setIsLoading(false); }
  };

  const loadAIData = async () => {
    if (!sessionToken) return;
    try {
      const [config, subjectList, pref] = await Promise.all([
        invoke<AIConfigResponse>('get_ai_config', { sessionToken }),
        invoke<Subject[]>('get_subjects', { sessionToken }),
        invoke<StudyPreference>('get_study_preference', { sessionToken }),
      ]);
      setAiConfig(config); setSubjects(subjectList); setModelName(config.model_name); setPreference(pref);
      setSelectedAISubjects(subjectList.map(s => s.name));
      if (pref.id > 0) {
        setPrefDailyHours(pref.daily_hours); setPrefStartTime(pref.start_time); setPrefEndTime(pref.end_time);
        setPrefLunchStart(pref.lunch_break_start); setPrefLunchEnd(pref.lunch_break_end); setPrefPhase(pref.study_phase);
        setPrefFocusSubjects(pref.focus_subjects); setPrefWeakSubjects(pref.weak_subjects);
        setPrefExamDate(pref.exam_date || ''); setPrefNotes(pref.notes || '');
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadTasks(); loadAIData(); }, [sessionToken, selectedDate]);

  // 打开创建对话框
  const openCreateDialog = () => {
    setEditingTask(null); setTaskSubjectId(null); setTaskStartTime('08:00'); setTaskEndTime('09:00');
    setTaskContent(''); setTaskAlarmEnabled(false); setTaskAlarmTime('07:55'); setShowTaskDialog(true);
  };

  // 打开编辑对话框
  const openEditDialog = (task: TaskResponse) => {
    setEditingTask(task); setTaskSubjectId(task.subject_id);
    setTaskStartTime(task.start_time.substring(0, 5)); setTaskEndTime(task.end_time.substring(0, 5));
    setTaskContent(task.content); setTaskAlarmEnabled(task.alarm_enabled);
    setTaskAlarmTime(task.alarm_time ? task.alarm_time.substring(0, 5) : '07:55'); setShowTaskDialog(true);
  };

  // 保存任务（创建或更新）
  const handleSaveTask = async () => {
    if (!sessionToken || !taskContent.trim()) return;
    setIsSavingTask(true);
    try {
      if (editingTask) {
        await invoke('update_task', {
          sessionToken, taskId: editingTask.id, subjectId: taskSubjectId,
          startTime: taskStartTime + ':00', endTime: taskEndTime + ':00',
          content: taskContent.trim(), alarmEnabled: taskAlarmEnabled,
          alarmTime: taskAlarmEnabled ? taskAlarmTime + ':00' : null,
        });
      } else {
        await invoke('create_task', {
          sessionToken, subjectId: taskSubjectId, taskDate: selectedDate,
          startTime: taskStartTime + ':00', endTime: taskEndTime + ':00',
          content: taskContent.trim(), alarmEnabled: taskAlarmEnabled,
          alarmTime: taskAlarmEnabled ? taskAlarmTime + ':00' : null,
        });
      }
      setShowTaskDialog(false); await loadTasks();
    } catch (e) { setError(e as string); }
    finally { setIsSavingTask(false); }
  };

  const handleToggleStatus = async (taskId: number) => {
    if (!sessionToken) return;
    try { await invoke('toggle_task_status', { sessionToken, taskId }); await loadTasks(); }
    catch (e) { setError(e as string); }
  };

  // 拖拽排序
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDelete = async () => {
    if (!sessionToken || !deleteTask) return;
    setIsDeleting(true);
    try { await invoke('delete_task', { sessionToken, taskId: deleteTask.id }); setDeleteTask(null); await loadTasks(); }
    catch (e) { setError(e as string); }
    finally { setIsDeleting(false); }
  };

  // 获取当前有效的长期计划目标
  const getActiveLongTermGoals = (): string[] => {
    const today = new Date().toISOString().split('T')[0];
    return longTermPlans
      .filter(p => p.startDate <= today && p.endDate >= today)
      .flatMap(p => p.goals.map(g => `[${p.type === 'week' ? '周计划' : p.type === 'month' ? '月计划' : '自定义'}] ${g}`));
  };

  const handleGenerate = async () => {
    if (!sessionToken || selectedAISubjects.length === 0) return;
    setIsGenerating(true); setError(null); setSuggestions([]);
    try {
      const longTermGoals = useLongTermPlans ? getActiveLongTermGoals() : [];
      const context: AIContext = { 
        exam_date: prefExamDate || null, 
        subjects: selectedAISubjects,
        incomplete_tasks: tasks.filter(t => t.status === 'pending').map(t => t.content), 
        review_content: aiUserInput || null,
        long_term_plans: longTermGoals.length > 0 ? longTermGoals : undefined,
      };
      const result = await invoke<TaskSuggestion[]>('generate_ai_plan', { sessionToken, context, modelName: selectedModel });
      setSuggestions(result);
    } catch (e) { setError(e as string); }
    finally { setIsGenerating(false); }
  };

  // 长期计划管理
  const openCreatePlanDialog = (type: 'week' | 'month' | 'custom') => {
    setEditingPlan(null);
    setPlanType(type);
    setPlanTitle(type === 'week' ? '本周计划' : type === 'month' ? '本月计划' : '');
    const today = new Date();
    if (type === 'week') {
      const dayOfWeek = today.getDay() || 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setPlanStartDate(monday.toISOString().split('T')[0]);
      setPlanEndDate(sunday.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setPlanStartDate(firstDay.toISOString().split('T')[0]);
      setPlanEndDate(lastDay.toISOString().split('T')[0]);
    } else {
      setPlanStartDate(today.toISOString().split('T')[0]);
      setPlanEndDate('');
    }
    setPlanGoals(['']);
    setShowPlanDialog(true);
  };

  const openEditPlanDialog = (plan: LongTermPlan) => {
    setEditingPlan(plan);
    setPlanType(plan.type);
    setPlanTitle(plan.title);
    setPlanStartDate(plan.startDate);
    setPlanEndDate(plan.endDate);
    setPlanGoals(plan.goals.length > 0 ? plan.goals : ['']);
    setShowPlanDialog(true);
  };

  const handleSavePlan = () => {
    const validGoals = planGoals.filter(g => g.trim());
    if (!planTitle.trim() || !planStartDate || !planEndDate || validGoals.length === 0) return;
    
    const newPlan: LongTermPlan = {
      id: editingPlan?.id || Date.now().toString(),
      type: planType,
      title: planTitle.trim(),
      startDate: planStartDate,
      endDate: planEndDate,
      goals: validGoals,
      createdAt: editingPlan?.createdAt || new Date().toISOString(),
    };
    
    let updatedPlans: LongTermPlan[];
    if (editingPlan) {
      updatedPlans = longTermPlans.map(p => p.id === editingPlan.id ? newPlan : p);
    } else {
      updatedPlans = [...longTermPlans, newPlan];
    }
    setLongTermPlans(updatedPlans);
    savePlans(updatedPlans);
    setShowPlanDialog(false);
  };

  const handleDeletePlan = (planId: string) => {
    const updatedPlans = longTermPlans.filter(p => p.id !== planId);
    setLongTermPlans(updatedPlans);
    savePlans(updatedPlans);
    setViewingPlan(null);
  };

  const addGoalInput = () => setPlanGoals([...planGoals, '']);
  const updateGoal = (index: number, value: string) => {
    setPlanGoals(planGoals.map((g, i) => i === index ? value : g));
  };
  const removeGoal = (index: number) => {
    if (planGoals.length > 1) setPlanGoals(planGoals.filter((_, i) => i !== index));
  };

  // 更新 AI 建议
  const updateSuggestion = (index: number, field: keyof TaskSuggestion, value: string) => {
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleImportTask = async (suggestion: TaskSuggestion) => {
    if (!sessionToken) return;
    const subject = subjects.find(s => s.name === suggestion.subject);
    try {
      await invoke('create_task', {
        sessionToken, subjectId: subject?.id || null, taskDate: selectedDate,
        startTime: suggestion.start_time + ':00', endTime: suggestion.end_time + ':00',
        content: suggestion.content, alarmEnabled: false, alarmTime: null,
      });
      setSuggestions(prev => prev.filter(s => s !== suggestion)); await loadTasks();
    } catch (e) { setError(e as string); }
  };

  const handleImportAll = async () => { for (const s of suggestions) await handleImportTask(s); };

  const handleSaveAIConfig = async () => {
    if (!sessionToken || !apiKey) return;
    setIsSavingConfig(true);
    try { await invoke('save_ai_config', { sessionToken, apiKey, modelName, apiEndpoint: null }); await loadAIData(); setShowAIConfigDialog(false); setApiKey(''); }
    catch (e) { setError(e as string); }
    finally { setIsSavingConfig(false); }
  };

  const handleSavePreference = async () => {
    if (!sessionToken) return;
    setIsSavingPref(true);
    try {
      await invoke('save_study_preference', { sessionToken, input: {
        daily_hours: prefDailyHours, start_time: prefStartTime, end_time: prefEndTime,
        lunch_break_start: prefLunchStart, lunch_break_end: prefLunchEnd, study_phase: prefPhase,
        focus_subjects: prefFocusSubjects, weak_subjects: prefWeakSubjects, exam_date: prefExamDate || null, notes: prefNotes || null,
      }});
      await loadAIData();
    } catch (e) { setError(e as string); }
    finally { setIsSavingPref(false); }
  };

  // 应用学习计划模板
  const applyTemplate = (template: string) => {
    switch (template) {
      case 'foundation':
        setPrefPhase('foundation');
        setPrefDailyHours(8);
        setPrefStartTime('08:00');
        setPrefEndTime('22:00');
        setPrefLunchStart('12:00');
        setPrefLunchEnd('14:00');
        setPrefNotes('基础阶段：重点打牢数学和英语基础，每天保证8小时有效学习');
        break;
      case 'strengthen':
        setPrefPhase('strengthen');
        setPrefDailyHours(10);
        setPrefStartTime('07:00');
        setPrefEndTime('23:00');
        setPrefLunchStart('12:00');
        setPrefLunchEnd('13:30');
        setPrefNotes('强化阶段：大量刷题，专业课和政治开始复习，每天10小时');
        break;
      case 'sprint':
        setPrefPhase('sprint');
        setPrefDailyHours(12);
        setPrefStartTime('06:30');
        setPrefEndTime('23:30');
        setPrefLunchStart('12:00');
        setPrefLunchEnd('13:00');
        setPrefNotes('冲刺阶段：查漏补缺，模拟考试，保持状态，每天12小时');
        break;
    }
  };

  const handleCheck = async () => {
    if (!sessionToken || !inputContent.trim()) return;
    setIsChecking(true); setError(null); setHasChecked(false);
    try { const result = await invoke<TaskResponse[]>('check_content', { sessionToken, date: selectedDate, content: inputContent.trim() }); setMatchedTasks(result); setHasChecked(true); await loadTasks(); }
    catch (e) { setError(e as string); }
    finally { setIsChecking(false); }
  };

  const toggleSubject = (name: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(name) ? list.filter(s => s !== name) : [...list, name]);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed': return { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
      case 'failed': return { icon: '✗', color: 'text-rose-400', bg: 'bg-rose-500/20' };
      default: return { icon: '○', color: 'text-slate-400', bg: 'bg-slate-500/20' };
    }
  };

  const formatTime = (time: string) => time.substring(0, 5);
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;


  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${themeConfig.border} flex justify-between items-center`}>
        <div><h1 className={`text-xl font-bold ${themeConfig.text}`}>📋 学习规划</h1><p className={`${themeConfig.textSecondary} text-sm`}>规划任务 · AI生成 · 完成检查</p></div>
        {preference && preference.days_until_exam !== null && preference.days_until_exam > 0 && (
          <div className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-lg text-sm font-bold">距考试 {preference.days_until_exam} 天</div>
        )}
      </div>

      <div className={`p-4 flex flex-wrap justify-between items-center gap-4 border-b ${themeConfig.border}`}>
        <div className="flex items-center gap-3">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`px-3 py-2 ${themeConfig.bgSecondary} border ${themeConfig.border} rounded-lg ${themeConfig.text} focus:ring-2 focus:ring-violet-500`} />
          <span className={`${themeConfig.textSecondary} text-sm`}>{new Date(selectedDate).toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${themeConfig.textSecondary} text-sm`}>完成 <span className="text-violet-400 font-bold">{completedCount}</span>/{tasks.length}</span>
          <div className={`w-24 h-2 ${themeConfig.bgSecondary} rounded-full overflow-hidden`}><div className={`h-full bg-gradient-to-r ${themeConfig.accent} transition-all`} style={{ width: `${progressPercent}%` }} /></div>
        </div>
      </div>

      <div className="p-4 flex gap-2 flex-wrap">
        {[{ key: 'plan', label: '📋 今日' }, { key: 'longterm', label: '📅 长期计划' }, { key: 'ai', label: '🤖 AI生成' }, { key: 'check', label: '✅ 检查' }, { key: 'settings', label: '⚙️ 设置' }].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.key ? `bg-gradient-to-r ${themeConfig.accent} text-white` : `${themeConfig.textSecondary} hover:${themeConfig.text} hover:bg-white/5`}`}>{tab.label}</button>
        ))}
      </div>

      {error && (<div className="mx-4 mb-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex justify-between"><span>⚠️ {error}</span><button onClick={() => setError(null)} className="hover:text-white">✕</button></div>)}

      <div className="flex-1 overflow-auto p-4">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* 任务列表 */}
          <div className="lg:col-span-2 bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-white font-bold">今日任务</h2>
              <button onClick={openCreateDialog} className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all">+ 添加</button>
            </div>
            
            {isLoading ? (<div className="p-8 text-center"><div className="w-8 h-8 border-3 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-3"></div><p className="text-slate-500">加载中...</p></div>)
            : tasks.length === 0 ? (<div className="p-8 text-center"><div className="text-4xl mb-3">📝</div><p className="text-slate-500">今天还没有任务</p></div>)
            : (<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="divide-y divide-white/5">
                    {tasks.map((task) => (
                      <SortableTaskItem key={task.id} task={task} getStatusDisplay={getStatusDisplay} formatTime={formatTime}
                        handleToggleStatus={handleToggleStatus} openEditDialog={openEditDialog} setDeleteTask={setDeleteTask} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>)}
          </div>

          {/* 右侧面板 */}
          <div className="space-y-4">
            {activeTab === 'ai' && (
              <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4">
                <h3 className="text-white font-bold mb-4">🤖 AI 智能规划</h3>
                {!aiConfig?.is_configured ? (
                  <div className="text-center py-6"><div className="text-3xl mb-2">🔑</div><p className="text-slate-400 text-sm mb-3">请先配置 AI API</p><button onClick={() => setShowAIConfigDialog(true)} className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm">配置 API</button></div>
                ) : (
                  <div className="space-y-4">
                    {/* 模型选择 */}
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">选择模型</label>
                      <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm">
                        {AI_MODELS.map(group => (
                          <optgroup key={group.group} label={group.group}>
                            {group.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    
                    {/* 参考长期计划 */}
                    {longTermPlans.length > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg">
                        <input type="checkbox" id="useLongTerm" checked={useLongTermPlans} onChange={(e) => setUseLongTermPlans(e.target.checked)} className="w-4 h-4 text-violet-500 rounded" />
                        <label htmlFor="useLongTerm" className="text-sm text-slate-300 flex-1">参考长期计划</label>
                        <span className="text-xs text-slate-500">{getActiveLongTermGoals().length} 个目标</span>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">选择科目</label>
                      <div className="flex flex-wrap gap-2">
                        {subjects.map(s => (
                          <button key={s.id} onClick={() => toggleSubject(s.name, selectedAISubjects, setSelectedAISubjects)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedAISubjects.includes(s.name) ? 'text-white shadow-md' : 'bg-slate-700/50 text-slate-400'}`}
                            style={selectedAISubjects.includes(s.name) ? { backgroundColor: s.color } : {}}>{selectedAISubjects.includes(s.name) && '✓ '}{s.name}</button>
                        ))}
                      </div>
                      {subjects.length > 0 && <div className="mt-2 flex gap-2"><button onClick={() => setSelectedAISubjects(subjects.map(s => s.name))} className="text-xs text-violet-400 hover:underline">全选</button><button onClick={() => setSelectedAISubjects([])} className="text-xs text-slate-500 hover:underline">清空</button></div>}
                    </div>
                    <div><label className="block text-sm text-slate-400 mb-2">额外说明</label><textarea value={aiUserInput} onChange={(e) => setAiUserInput(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm resize-none" rows={2} placeholder="例如：今天想多复习数学..." /></div>
                    <button onClick={handleGenerate} disabled={isGenerating || selectedAISubjects.length === 0} className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-medium disabled:opacity-50">{isGenerating ? '🤖 生成中...' : '✨ 生成计划'}</button>
                    
                    {suggestions.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">AI 建议 ({suggestions.length})</span><button onClick={handleImportAll} className="text-xs text-violet-400 hover:underline">全部导入</button></div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {suggestions.map((s, i) => (
                            <div key={i} className="p-3 bg-slate-700/30 rounded-lg border border-white/5">
                              {editingSuggestion === i ? (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <input type="time" value={s.start_time} onChange={(e) => updateSuggestion(i, 'start_time', e.target.value)} className="px-2 py-1 bg-slate-600 border border-white/10 rounded text-white text-xs w-20" />
                                    <input type="time" value={s.end_time} onChange={(e) => updateSuggestion(i, 'end_time', e.target.value)} className="px-2 py-1 bg-slate-600 border border-white/10 rounded text-white text-xs w-20" />
                                  </div>
                                  <input type="text" value={s.content} onChange={(e) => updateSuggestion(i, 'content', e.target.value)} className="w-full px-2 py-1 bg-slate-600 border border-white/10 rounded text-white text-sm" />
                                  <select value={s.subject} onChange={(e) => updateSuggestion(i, 'subject', e.target.value)} className="w-full px-2 py-1 bg-slate-600 border border-white/10 rounded text-white text-xs">
                                    {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                                  </select>
                                  <div className="flex gap-2"><button onClick={() => setEditingSuggestion(null)} className="flex-1 py-1 bg-violet-500/20 text-violet-400 rounded text-xs">完成</button><button onClick={() => setSuggestions(prev => prev.filter((_, idx) => idx !== i))} className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded text-xs">删除</button></div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 cursor-pointer" onClick={() => setEditingSuggestion(i)}>
                                    <div className="text-xs text-slate-500 font-mono">{s.start_time}-{s.end_time}</div>
                                    <div className="text-sm text-slate-200 mt-1">{s.content}</div>
                                    <div className="text-xs text-violet-400 mt-1">{s.subject}</div>
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => setEditingSuggestion(i)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">✎</button>
                                    <button onClick={() => handleImportTask(s)} className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30">导入</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'check' && (
              <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4">
                <h3 className="text-white font-bold mb-4">✅ 完成检查</h3>
                <textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm resize-none mb-3" rows={3} placeholder="输入完成的内容..." />
                <button onClick={handleCheck} disabled={isChecking || !inputContent.trim()} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium disabled:opacity-50">{isChecking ? '检查中...' : '🔍 检查匹配'}</button>
                {hasChecked && (<div className={`mt-3 p-3 rounded-lg ${matchedTasks.length > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-slate-400'}`}>{matchedTasks.length > 0 ? <div><div className="font-medium text-sm">✓ 匹配 {matchedTasks.length} 个任务</div>{matchedTasks.map(t => <div key={t.id} className="text-xs mt-1">• {t.content}</div>)}</div> : <div className="text-center text-sm">未找到匹配任务</div>}</div>)}
              </div>
            )}

            {activeTab === 'plan' && (
              <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4">
                <h3 className="text-white font-bold mb-4">⚡ 快捷操作</h3>
                <div className="space-y-2">
                  <button onClick={openCreateDialog} className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-medium">+ 添加任务</button>
                  <button onClick={() => setActiveTab('ai')} className="w-full py-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">🤖 AI 生成</button>
                  <button onClick={() => setActiveTab('longterm')} className="w-full py-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">📅 长期计划</button>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-slate-700/30 rounded-lg"><div className="text-lg font-bold text-white">{tasks.length}</div><div className="text-xs text-slate-500">总任务</div></div>
                  <div className="text-center p-2 bg-emerald-500/10 rounded-lg"><div className="text-lg font-bold text-emerald-400">{completedCount}</div><div className="text-xs text-emerald-500">已完成</div></div>
                  <div className="text-center p-2 bg-amber-500/10 rounded-lg"><div className="text-lg font-bold text-amber-400">{tasks.length - completedCount}</div><div className="text-xs text-amber-500">待完成</div></div>
                </div>
              </div>
            )}

            {activeTab === 'longterm' && (
              <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4">
                <h3 className="text-white font-bold mb-4">📅 长期计划</h3>
                <div className="space-y-2 mb-4">
                  <button onClick={() => openCreatePlanDialog('week')} className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium text-sm">+ 新建周计划</button>
                  <button onClick={() => openCreatePlanDialog('month')} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium text-sm">+ 新建月计划</button>
                  <button onClick={() => openCreatePlanDialog('custom')} className="w-full py-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 text-sm">+ 自定义计划</button>
                </div>
                
                {longTermPlans.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-slate-400 text-sm">暂无长期计划</p>
                    <p className="text-slate-500 text-xs mt-1">创建周/月计划，AI 会参考这些目标</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {longTermPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(plan => {
                      const today = new Date().toISOString().split('T')[0];
                      const isActive = plan.startDate <= today && plan.endDate >= today;
                      const isExpired = plan.endDate < today;
                      return (
                        <div key={plan.id} onClick={() => setViewingPlan(plan)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-violet-500/30 ${
                            isActive ? 'border-emerald-500/30 bg-emerald-500/5' : isExpired ? 'border-slate-500/20 bg-slate-500/5 opacity-60' : 'border-white/5 bg-slate-700/30'
                          }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              plan.type === 'week' ? 'bg-blue-500/20 text-blue-400' : plan.type === 'month' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'
                            }`}>{plan.type === 'week' ? '周' : plan.type === 'month' ? '月' : '自定义'}</span>
                            {isActive && <span className="text-xs text-emerald-400">● 进行中</span>}
                            {isExpired && <span className="text-xs text-slate-500">已结束</span>}
                          </div>
                          <div className="text-sm text-white font-medium">{plan.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{plan.startDate} ~ {plan.endDate}</div>
                          <div className="text-xs text-slate-400 mt-1">{plan.goals.length} 个目标</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                <h3 className="text-white font-bold mb-4">⚙️ 学习偏好</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm text-slate-400 mb-2">学习阶段</label>
                    <div className="space-y-2">{STUDY_PHASES.map(phase => (
                      <label key={phase.value} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${prefPhase === phase.value ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 hover:border-white/10'}`}>
                        <input type="radio" name="phase" value={phase.value} checked={prefPhase === phase.value} onChange={(e) => setPrefPhase(e.target.value)} className="sr-only" />
                        <div className="flex-1"><div className="text-white text-sm">{phase.label}</div><div className="text-xs text-slate-500">{phase.desc}</div></div>
                        {prefPhase === phase.value && <span className="text-violet-400">✓</span>}
                      </label>
                    ))}</div>
                  </div>
                  <div><label className="block text-sm text-slate-400 mb-2">考试日期</label><input type="date" value={prefExamDate} onChange={(e) => setPrefExamDate(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
                  <div><label className="block text-sm text-slate-400 mb-2">每日学习: {prefDailyHours}小时</label><input type="range" min="4" max="14" value={prefDailyHours} onChange={(e) => setPrefDailyHours(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs text-slate-500 mb-1">开始</label><input type="time" value={prefStartTime} onChange={(e) => setPrefStartTime(e.target.value)} className="w-full px-2 py-1.5 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" /></div>
                    <div><label className="block text-xs text-slate-500 mb-1">结束</label><input type="time" value={prefEndTime} onChange={(e) => setPrefEndTime(e.target.value)} className="w-full px-2 py-1.5 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs text-slate-500 mb-1">午休开始</label><input type="time" value={prefLunchStart} onChange={(e) => setPrefLunchStart(e.target.value)} className="w-full px-2 py-1.5 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" /></div>
                    <div><label className="block text-xs text-slate-500 mb-1">午休结束</label><input type="time" value={prefLunchEnd} onChange={(e) => setPrefLunchEnd(e.target.value)} className="w-full px-2 py-1.5 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" /></div>
                  </div>
                  <div><label className="block text-sm text-slate-400 mb-2">重点科目</label><div className="flex flex-wrap gap-2">{subjects.map(s => (<button key={s.id} onClick={() => toggleSubject(s.name, prefFocusSubjects, setPrefFocusSubjects)} className={`px-2 py-1 rounded text-xs transition-all ${prefFocusSubjects.includes(s.name) ? 'text-white' : 'bg-slate-700/50 text-slate-400'}`} style={prefFocusSubjects.includes(s.name) ? { backgroundColor: s.color } : {}}>{prefFocusSubjects.includes(s.name) && '✓ '}{s.name}</button>))}</div></div>
                  <div><label className="block text-sm text-slate-400 mb-2">薄弱科目</label><div className="flex flex-wrap gap-2">{subjects.map(s => (<button key={s.id} onClick={() => toggleSubject(s.name, prefWeakSubjects, setPrefWeakSubjects)} className={`px-2 py-1 rounded text-xs transition-all ${prefWeakSubjects.includes(s.name) ? 'bg-rose-500 text-white' : 'bg-slate-700/50 text-slate-400'}`}>{prefWeakSubjects.includes(s.name) && '✓ '}{s.name}</button>))}</div></div>
                  <div><label className="block text-sm text-slate-400 mb-2">备注</label><textarea value={prefNotes} onChange={(e) => setPrefNotes(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm resize-none" rows={2} placeholder="其他说明..." /></div>
                  <button onClick={handleSavePreference} disabled={isSavingPref} className="w-full py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-medium disabled:opacity-50">{isSavingPref ? '保存中...' : '💾 保存设置'}</button>
                  <button onClick={() => setShowAIConfigDialog(true)} className="w-full py-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">🔑 配置 AI API</button>
                  
                  {/* 学习计划模板 */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <h4 className="text-white font-bold mb-3">📋 学习计划模板</h4>
                    <p className="text-xs text-slate-500 mb-3">快速应用预设的学习计划模板</p>
                    <div className="space-y-2">
                      <button onClick={() => applyTemplate('foundation')} className="w-full p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg text-left transition-all border border-white/5 hover:border-violet-500/30">
                        <div className="text-sm text-white font-medium">🌱 基础阶段模板</div>
                        <div className="text-xs text-slate-500">每天8小时，重点打基础，数学+英语为主</div>
                      </button>
                      <button onClick={() => applyTemplate('strengthen')} className="w-full p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg text-left transition-all border border-white/5 hover:border-violet-500/30">
                        <div className="text-sm text-white font-medium">💪 强化阶段模板</div>
                        <div className="text-xs text-slate-500">每天10小时，大量刷题，专业课+政治加入</div>
                      </button>
                      <button onClick={() => applyTemplate('sprint')} className="w-full p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg text-left transition-all border border-white/5 hover:border-violet-500/30">
                        <div className="text-sm text-white font-medium">🚀 冲刺阶段模板</div>
                        <div className="text-xs text-slate-500">每天12小时，查漏补缺，模拟考试</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务对话框（创建/编辑） */}
      {showTaskDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">{editingTask ? '✎ 编辑任务' : '✨ 添加任务'}</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">科目</label><SubjectSelect value={taskSubjectId} onChange={setTaskSubjectId} placeholder="选择科目（可选）" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-slate-400 mb-2">开始</label><input type="time" value={taskStartTime} onChange={(e) => setTaskStartTime(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
                <div><label className="block text-sm text-slate-400 mb-2">结束</label><input type="time" value={taskEndTime} onChange={(e) => setTaskEndTime(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" /></div>
              </div>
              <div><label className="block text-sm text-slate-400 mb-2">内容</label><input type="text" value={taskContent} onChange={(e) => setTaskContent(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="如：复习高数第三章" /></div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="alarm" checked={taskAlarmEnabled} onChange={(e) => setTaskAlarmEnabled(e.target.checked)} className="w-4 h-4 text-violet-500 rounded" />
                <label htmlFor="alarm" className="text-sm text-slate-400">设置闹钟</label>
                {taskAlarmEnabled && <input type="time" value={taskAlarmTime} onChange={(e) => setTaskAlarmTime(e.target.value)} className="px-2 py-1 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm" />}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowTaskDialog(false)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSaveTask} disabled={isSavingTask || !taskContent.trim()} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isSavingTask ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-rose-400 mb-4">⚠️ 确认删除</h3>
            <p className="text-slate-300">确定删除 <span className="text-white font-medium">"{deleteTask.content}"</span>？</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteTask(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-rose-500 text-white rounded-lg disabled:opacity-50">{isDeleting ? '删除中...' : '删除'}</button>
            </div>
          </div>
        </div>
      )}

      {/* AI 配置对话框 */}
      {showAIConfigDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 m-4 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">🔑 配置 AI API</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-2">API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" placeholder="sk-..." /><p className="text-xs text-slate-500 mt-1">在 <a href="https://siliconflow.cn" target="_blank" className="text-violet-400 hover:underline">硅基流动</a> 获取</p></div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">默认模型</label>
                <select value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white">
                  {AI_MODELS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowAIConfigDialog(false); setApiKey(''); }} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSaveAIConfig} disabled={isSavingConfig || !apiKey} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">{isSavingConfig ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 长期计划对话框（创建/编辑） */}
      {showPlanDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingPlan ? '✎ 编辑计划' : planType === 'week' ? '📅 新建周计划' : planType === 'month' ? '📅 新建月计划' : '📅 新建自定义计划'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">计划名称</label>
                <input type="text" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white"
                  placeholder={planType === 'week' ? '如：第15周复习计划' : planType === 'month' ? '如：12月冲刺计划' : '计划名称'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">开始日期</label>
                  <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">结束日期</label>
                  <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">目标列表</label>
                <div className="space-y-2">
                  {planGoals.map((goal, index) => (
                    <div key={index} className="flex gap-2">
                      <input type="text" value={goal} onChange={(e) => updateGoal(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white text-sm"
                        placeholder={`目标 ${index + 1}，如：完成高数第5章`} />
                      {planGoals.length > 1 && (
                        <button onClick={() => removeGoal(index)} className="px-3 py-2 text-rose-400 hover:bg-rose-500/20 rounded-lg">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addGoalInput} className="mt-2 text-sm text-violet-400 hover:underline">+ 添加目标</button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowPlanDialog(false)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button onClick={handleSavePlan} disabled={!planTitle.trim() || !planStartDate || !planEndDate || planGoals.filter(g => g.trim()).length === 0}
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg disabled:opacity-50">
                {editingPlan ? '保存修改' : '创建计划'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看长期计划详情 */}
      {viewingPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 border border-white/10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    viewingPlan.type === 'week' ? 'bg-blue-500/20 text-blue-400' : viewingPlan.type === 'month' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'
                  }`}>{viewingPlan.type === 'week' ? '周计划' : viewingPlan.type === 'month' ? '月计划' : '自定义计划'}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{viewingPlan.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{viewingPlan.startDate} ~ {viewingPlan.endDate}</p>
              </div>
              <button onClick={() => setViewingPlan(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm text-slate-400 mb-2">目标列表</h4>
              <div className="space-y-2">
                {viewingPlan.goals.map((goal, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                    <span className="text-violet-400">•</span>
                    <span className="text-white text-sm">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => { openEditPlanDialog(viewingPlan); setViewingPlan(null); }}
                className="flex-1 py-2.5 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700">✎ 编辑</button>
              <button onClick={() => handleDeletePlan(viewingPlan.id)}
                className="px-4 py-2.5 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
