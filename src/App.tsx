import { useState, useEffect, useCallback } from 'react';
import { Todo, Priority, PRIORITIES, getPriorityInfo } from './types/todo';
import { getTodos, addTodo, updateTodo, deleteTodo, toggleTodo, reorderTodo } from './utils/api';
import { TodoItem } from './components/TodoItem';
import { TodoForm } from './components/TodoForm';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { formatReminderTime } from './utils/time';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

type ViewMode = 'list' | 'quadrant';
type FilterType = 'all' | 'active' | 'completed';
type ThemeMode = 'light' | 'dark';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<FilterType>(() => {
    const saved = localStorage.getItem('filter');
    if (saved === 'active' || saved === 'completed' || saved === 'all') return saved;
    return 'active';
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    if (saved === 'list' || saved === 'quadrant') return saved;
    return 'quadrant';
  });
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [addingToPriority, setAddingToPriority] = useState<Priority | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const loadTodos = useCallback(async () => {
    try {
      console.log('loadTodos: fetching...');
      const data = await getTodos();
      console.log('loadTodos: got', data.length, 'todos');
      setTodos(data);
      console.log('loadTodos: setTodos called with', data.length, 'items');
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    const checkReminders = async () => {
      const permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        if (permission !== 'granted') return;
      }

      const notifiedIds = new Set<string>();
      const checkInterval = setInterval(() => {
        const now = new Date();
        todos.forEach(todo => {
          if (todo.reminderTime && !todo.completed && !notifiedIds.has(todo.id)) {
            const reminder = new Date(todo.reminderTime);
            const diff = reminder.getTime() - now.getTime();
            if (diff <= 0) {
              const priorityInfo = getPriorityInfo(todo.priority);
              const desc = todo.description ? `\n${todo.description}` : '';
              const body = `${priorityInfo.label}${desc}`;
              console.log('Sending notification for:', todo.title);
              sendNotification({
                title: `🔔 ${todo.title}`,
                body: body
              });
              notifiedIds.add(todo.id);
            }
          }
        });
      }, 10000);

      return () => clearInterval(checkInterval);
    };

    if (todos.length > 0) {
      checkReminders();
    }
  }, [todos]);

  const handleAdd = async (data: { title: string; description: string; priority: Priority; reminderTime: string | null }) => {
    console.log('handleAdd called with:', data);
    try {
      console.log('About to call addTodo API...');
      await addTodo(data.title, data.description, data.priority, data.reminderTime);
      console.log('addTodo API completed');
      await loadTodos();
      setShowForm(false);
      setAddingToPriority(null);
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleUpdate = async (data: { title: string; description: string; priority: Priority; reminderTime: string | null }) => {
    if (!editingTodo) return;
    try {
      await updateTodo(editingTodo.id, data.title, data.description, data.priority, data.reminderTime, editingTodo.completed);
      await loadTodos();
      setEditingTodo(null);
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleTodo(id);
      await loadTodos();
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleDelete = async (id: string) => {
    console.log('handleDelete called:', id);
    try {
      console.log('Calling deleteTodo API...');
      await deleteTodo(id);
      console.log('deleteTodo success, reloading...');
      await loadTodos();
      console.log('loadTodos done');
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      console.log('Dropped outside any target');
      return;
    }

    const activeTodo = todos.find(t => t.id === active.id);
    if (!activeTodo) {
      console.log('Active todo not found');
      return;
    }

    const overId = over.id as string;
    console.log('Drag end:', active.id, '->', overId);

    if (viewMode === 'list') {
      const overTodo = todos.find(t => t.id === overId);
      if (overTodo && activeTodo.id !== overTodo.id) {
        try {
          await reorderTodo(activeTodo.id, overTodo.sortOrder);
          await loadTodos();
        } catch (error) {
          console.error('Failed to reorder todo:', error);
        }
      }
    } else {
      if (overId.startsWith('quadrant-')) {
        const newPriority = overId.replace('quadrant-', '') as Priority;
        console.log('Dropped on quadrant:', newPriority);
        if (activeTodo.priority !== newPriority) {
          try {
            await updateTodo(
              activeTodo.id,
              activeTodo.title,
              activeTodo.description,
              newPriority,
              activeTodo.reminderTime,
              activeTodo.completed
            );
            await loadTodos();
          } catch (error) {
            console.error('Failed to update todo priority:', error);
          }
        }
      } else {
        const overTodo = todos.find(t => t.id === overId);
        if (overTodo) {
          if (activeTodo.priority !== overTodo.priority) {
            try {
              await updateTodo(
                activeTodo.id,
                activeTodo.title,
                activeTodo.description,
                overTodo.priority,
                activeTodo.reminderTime,
                activeTodo.completed
              );
              await loadTodos();
            } catch (error) {
              console.error('Failed to update todo priority:', error);
            }
          } else {
            try {
              await reorderTodo(activeTodo.id, overTodo.sortOrder);
              await loadTodos();
            } catch (error) {
              console.error('Failed to reorder todo:', error);
            }
          }
        }
      }
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'all') return true;
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return false;
  });

  const activeTodos = filteredTodos.filter(t => !t.completed);
  const completedTodos = filteredTodos.filter(t => t.completed);

  const getTodosByPriority = (priority: Priority) => {
    return filteredTodos.filter(t => t.priority === priority);
  };

  if (loading) {
    return <div className="app loading">加载中...</div>;
  }

  const quadrantData = [
    { priority: 'p0' as Priority, title: '紧急且重要' },
    { priority: 'p1' as Priority, title: '紧急不重要' },
    { priority: 'p2' as Priority, title: '重要不紧急' },
    { priority: 'p3' as Priority, title: '不重要不紧急' },
  ];

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '未完成' },
    { key: 'completed', label: '已完成' },
  ];

  const activeTodo = activeId ? todos.find(t => t.id === activeId) : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>待办事项</h1>
        <div className="header-actions">
          <div className="filter-tabs">
            {filters.map(f => (
              <button
                key={f.key}
                className={`filter-tab ${filter === f.key ? 'active' : ''}`}
                onClick={() => { setFilter(f.key); localStorage.setItem('filter', f.key); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            className="theme-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => { setViewMode('list'); localStorage.setItem('viewMode', 'list'); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="1"/>
                <rect x="1" y="7" width="14" height="2" rx="1"/>
                <rect x="1" y="12" width="14" height="2" rx="1"/>
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'quadrant' ? 'active' : ''}`}
              onClick={() => { setViewMode('quadrant'); localStorage.setItem('viewMode', 'quadrant'); }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1"/>
                <rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/>
                <rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
            </button>
          </div>
          </div>
      </header>

      <main className="app-main">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {viewMode === 'list' ? (
          <>
            {activeTodos.length > 0 && (
              <section className="todo-section">
                <h2>待办 ({activeTodos.length})</h2>
                <SortableContext
                  items={activeTodos.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="todo-list">
                    {activeTodos.map(todo => (
                      <SortableTodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={handleToggle}
                        onEdit={setEditingTodo}
                        onDelete={handleDelete}
                        variant="list"
                      />
                    ))}
                  </div>
                </SortableContext>
              </section>
            )}

            {filter !== 'active' && completedTodos.length > 0 && (
              <section className="todo-section completed-section">
                <h2>已完成 ({completedTodos.length})</h2>
                <div className="todo-list">
                  {completedTodos.map(todo => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={handleToggle}
                      onEdit={setEditingTodo}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="list-add-btn-wrapper">
              <button
                className="list-add-btn"
                onClick={() => setShowForm(true)}
                disabled={filter === 'completed'}
                title="新增待办"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="10" y1="3" x2="10" y2="17"/>
                  <line x1="3" y1="10" x2="17" y2="10"/>
                </svg>
              </button>
            </div>

            
          </>
        ) : (
          <div className="quadrant-view">
            <div className="quadrant-grid">
              {quadrantData.map((q) => {
                const quadrantTodos = getTodosByPriority(q.priority);
                const priorityInfo = PRIORITIES.find(p => p.key === q.priority);

                return (
                  <div key={q.priority} className={`quadrant quadrant-${q.priority}`}>
                    <div className="quadrant-header" style={{ borderTopColor: priorityInfo?.bgColor }}>
                      <span className="quadrant-title">{q.title}</span>
                    </div>
                    <QuadrantDroppable id={`quadrant-${q.priority}`}>
                      <SortableContext
                        items={quadrantTodos.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {quadrantTodos.length > 0 ? (
                          quadrantTodos.map(todo => (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              onToggle={handleToggle}
                              onEdit={setEditingTodo}
                              onDelete={handleDelete}
                            />
                          ))
                        ) : (
                          <div className="quadrant-empty">拖拽待办到此处</div>
                        )}
                      </SortableContext>
                    </QuadrantDroppable>
                    <button
                      className="quadrant-add-btn"
                      onClick={() => setAddingToPriority(q.priority)}
                      disabled={filter === 'completed'}
                      title={`添加`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="7" y1="1" x2="7" y2="13"/>
                        <line x1="1" y1="7" x2="13" y2="7"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <DragOverlay>
          {activeTodo ? (
            <div className={`quadrant-todo dragging ${activeTodo.priority}`}>
              <div className="quadrant-todo-grip">
                <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/>
                  <circle cx="6" cy="2" r="1.5"/>
                  <circle cx="2" cy="7" r="1.5"/>
                  <circle cx="6" cy="7" r="1.5"/>
                  <circle cx="2" cy="12" r="1.5"/>
                  <circle cx="6" cy="12" r="1.5"/>
                </svg>
              </div>
              <div className="quadrant-todo-checkbox">
                {activeTodo.completed ? '✓' : ''}
              </div>
              <span className="quadrant-todo-title">{activeTodo.title}</span>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      </main>

      {showForm && !addingToPriority && (
        <TodoForm
          onSubmit={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {addingToPriority && (
        <TodoForm
          onSubmit={handleAdd}
          onCancel={() => setAddingToPriority(null)}
          defaultPriority={addingToPriority}
        />
      )}

      {editingTodo && (
        <TodoForm
          todo={editingTodo}
          onSubmit={handleUpdate}
          onCancel={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}

interface SortableTodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  variant?: 'list' | 'quadrant';
}

function QuadrantDroppable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  console.log('QuadrantDroppable render:', id, 'isOver:', isOver);
  return (
    <div ref={setNodeRef} className={`quadrant-content ${isOver ? 'drag-over' : ''}`} data-quadrant={id.replace('quadrant-', '')} onClick={() => console.log('QuadrantDroppable clicked:', id)}>
      {children}
    </div>
  );
}

function SortableTodoItem({ todo, onToggle, onEdit, onDelete, variant = 'quadrant' }: SortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${variant === 'list' ? 'todo-item' : 'quadrant-todo'} ${todo.priority} ${todo.completed ? 'completed' : ''}`}
    >
      {variant === 'list' ? (
        <>
          <div className="todo-grip" {...attributes} {...listeners}>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
              <circle cx="2" cy="2" r="1.5"/>
              <circle cx="6" cy="2" r="1.5"/>
              <circle cx="2" cy="7" r="1.5"/>
              <circle cx="6" cy="7" r="1.5"/>
              <circle cx="2" cy="12" r="1.5"/>
              <circle cx="6" cy="12" r="1.5"/>
            </svg>
          </div>
          <div className="todo-checkbox" onClick={() => onToggle(todo.id)}>
            {todo.completed ? '✓' : ''}
          </div>
          <div className="todo-content" onClick={() => onEdit(todo)}>
            <div className="todo-title">{todo.title}</div>
            {todo.description && <div className="todo-description">{todo.description}</div>}
            {todo.reminderTime && <div className="todo-reminder">{formatReminderTime(todo.reminderTime)}</div>}
          </div>
          <div className="todo-actions">
            <span className={`priority-badge ${todo.priority}`}>{getPriorityInfo(todo.priority).label}</span>
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); console.log('Delete button clicked, id:', todo.id); onDelete(todo.id); }}>×</button>
          </div>
        </>
      ) : (
        <>
          <div className="quadrant-todo-grip" {...attributes} {...listeners}>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
              <circle cx="2" cy="2" r="1.5"/>
              <circle cx="6" cy="2" r="1.5"/>
              <circle cx="2" cy="7" r="1.5"/>
              <circle cx="6" cy="7" r="1.5"/>
              <circle cx="2" cy="12" r="1.5"/>
              <circle cx="6" cy="12" r="1.5"/>
            </svg>
          </div>
          <div className="quadrant-todo-checkbox" onClick={(e) => { e.stopPropagation(); onToggle(todo.id); }}>
            {todo.completed ? '✓' : ''}
          </div>
          <div className="quadrant-todo-info" onClick={() => onEdit(todo)}>
            <span className="quadrant-todo-title">{todo.title}</span>
            {todo.reminderTime && <span className="quadrant-todo-reminder">{formatReminderTime(todo.reminderTime)}</span>}
          </div>
          <button className="quadrant-todo-delete" onClick={(e) => { e.stopPropagation(); console.log('Quadrant delete button clicked, id:', todo.id); onDelete(todo.id); }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l8 8M10 2l-8 8"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

export default App;
