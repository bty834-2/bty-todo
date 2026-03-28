import { Todo, getPriorityInfo } from '../types/todo';
import { formatReminderTime } from '../utils/time';
import './TodoItem.css';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const priorityInfo = getPriorityInfo(todo.priority);

  return (
    <div className={`todo-item ${todo.priority} ${todo.completed ? 'completed' : ''}`}>
      <div className="todo-checkbox" onClick={() => onToggle(todo.id)}>
        {todo.completed ? '✓' : ''}
      </div>
      <div className="todo-content" onClick={() => onEdit(todo)}>
        <div className="todo-title">{todo.title}</div>
        {todo.description && <div className="todo-description">{todo.description}</div>}
        {todo.reminderTime && (
          <div className="todo-reminder">{formatReminderTime(todo.reminderTime)}</div>
        )}
      </div>
      <div className="todo-actions">
        <span className={`priority-badge ${todo.priority}`}>
          {priorityInfo.label}
        </span>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(todo.id);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l8 8M11 3l-8 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
