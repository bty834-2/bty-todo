import { useState, useEffect } from 'react';
import { Todo, Priority, PRIORITIES, QUICK_REMINDERS } from '../types/todo';
import './TodoForm.css';

interface TodoFormProps {
  todo?: Todo | null;
  defaultPriority?: Priority | null;
  onSubmit: (data: { title: string; description: string; priority: Priority; reminderTime: string | null }) => void;
  onCancel: () => void;
}

export function TodoForm({ todo, defaultPriority, onSubmit, onCancel }: TodoFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(defaultPriority || 'p3');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [selectedQuickReminder, setSelectedQuickReminder] = useState<number | null>(null);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDescription(todo.description);
      setPriority(todo.priority);
      if (todo.reminderTime) {
        setReminderEnabled(true);
        const date = new Date(todo.reminderTime);
        setReminderDate(date.toISOString().split('T')[0]);
        setReminderTime(date.toTimeString().slice(0, 5));
        setSelectedQuickReminder(null);
      }
    }
  }, [todo]);

  const handleQuickReminder = (minutes: number) => {
    setSelectedQuickReminder(minutes);
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    setReminderDate(now.toISOString().split('T')[0]);
    setReminderTime(now.toTimeString().slice(0, 5));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted, title:', title.trim());
    if (!title.trim()) return;

    let reminderTimeStr: string | null = null;
    if (reminderEnabled) {
      if (selectedQuickReminder) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + selectedQuickReminder);
        reminderTimeStr = now.toISOString();
      } else if (reminderDate && reminderTime) {
        reminderTimeStr = new Date(`${reminderDate}T${reminderTime}`).toISOString();
      }
    }

    console.log('Calling onSubmit with:', { title: title.trim(), description: description.trim(), priority, reminderTime: reminderTimeStr });
    onSubmit({ title: title.trim(), description: description.trim(), priority, reminderTime: reminderTimeStr });
  };

  return (
    <div className="form-overlay" onClick={onCancel}>
      <div className="form-container" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h2>{todo ? '编辑待办' : '新增待办'}</h2>
          <button className="close-btn" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-body">
            <div className="form-section">
              <input
                type="text"
                className="title-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="待办标题"
                autoFocus
              />
              <textarea
                className="desc-input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="添加描述..."
                rows={1}
              />
            </div>

            <div className="form-section">
              <div className="priority-selector">
                {PRIORITIES.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`priority-btn ${priority === p.key ? 'selected' : ''}`}
                    style={{
                      '--priority-color': p.color,
                      '--priority-bg': p.bgColor,
                    } as React.CSSProperties}
                    onClick={() => setPriority(p.key)}
                  >
                    <span className="priority-name">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="section-label">提醒</div>
              <div className="reminder-row">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={e => setReminderEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">{reminderEnabled ? '已开启' : '已关闭'}</span>
                {reminderEnabled && (
                  <div className="quick-reminders">
                    {QUICK_REMINDERS.map(qr => (
                      <button
                        key={qr.minutes}
                        type="button"
                        className={`quick-btn ${selectedQuickReminder === qr.minutes ? 'selected' : ''}`}
                        onClick={() => handleQuickReminder(qr.minutes)}
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reminderEnabled && (
                <div className="time-inputs">
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={e => { setReminderDate(e.target.value); setSelectedQuickReminder(null); }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => { setReminderTime(e.target.value); setSelectedQuickReminder(null); }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn-cancel" onClick={onCancel}>取消</button>
            <button type="submit" className="btn-submit" disabled={!title.trim()}>保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}