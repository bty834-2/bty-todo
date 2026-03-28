export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

export interface Todo {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  reminderTime: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
}

export interface PriorityInfo {
  key: Priority;
  label: string;
  shortLabel: string;
  desc: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PRIORITIES: PriorityInfo[] = [
  { key: 'p0', label: '紧急且重要', shortLabel: 'P0', desc: '立即处理', color: '#FFFFFF', bgColor: '#EF4444', borderColor: '#DC2626' },
  { key: 'p1', label: '紧急不重要', shortLabel: 'P1', desc: '尽快处理', color: '#FFFFFF', bgColor: '#F97316', borderColor: '#EA580C' },
  { key: 'p2', label: '重要不紧急', shortLabel: 'P2', desc: '计划处理', color: '#FFFFFF', bgColor: '#3B82F6', borderColor: '#2563EB' },
  { key: 'p3', label: '不重要不紧急', shortLabel: 'P3', desc: '可延后', color: '#FFFFFF', bgColor: '#9CA3AF', borderColor: '#6B7280' },
];

export const QUICK_REMINDERS = [
  { label: '30分钟后', minutes: 30 },
  { label: '1小时后', minutes: 60 },
  { label: '1天后', minutes: 1440 },
  { label: '2天后', minutes: 2880 },
  { label: '3天后', minutes: 4320 },
];

export const getPriorityInfo = (priority: Priority): PriorityInfo => {
  return PRIORITIES.find(p => p.key === priority) || PRIORITIES[3];
};
