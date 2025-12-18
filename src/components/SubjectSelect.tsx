// 科目选择组件 - 深色主题
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';

interface Subject { id: number; name: string; color: string; }

interface SubjectSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}

export default function SubjectSelect({ value, onChange, placeholder = '选择科目' }: SubjectSelectProps) {
  const { sessionToken } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!sessionToken) return;
      try { const result = await invoke<Subject[]>('get_subjects', { sessionToken }); setSubjects(result); }
      catch (e) { console.error(e); }
    };
    loadSubjects();
  }, [sessionToken]);

  const selectedSubject = subjects.find(s => s.id === value);

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-left flex items-center justify-between hover:bg-slate-700 transition-colors">
        {selectedSubject ? (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSubject.color }}></span>
            <span className="text-white">{selectedSubject.name}</span>
          </div>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <span className="text-slate-500">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <button type="button" onClick={() => { onChange(null); setIsOpen(false); }}
            className="w-full px-3 py-2 text-left text-slate-400 hover:bg-slate-700 transition-colors">
            无
          </button>
          {subjects.map(subject => (
            <button key={subject.id} type="button" onClick={() => { onChange(subject.id); setIsOpen(false); }}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-700 transition-colors ${value === subject.id ? 'bg-slate-700' : ''}`}>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }}></span>
              <span className="text-white">{subject.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
