import { invoke } from '@tauri-apps/api/core';
import { Todo, Priority } from '../types/todo';

export async function getTodos(): Promise<Todo[]> {
  return invoke('get_todos');
}

export async function addTodo(
  title: string,
  description: string,
  priority: Priority,
  reminderTime: string | null
): Promise<Todo> {
  console.log('api.addTodo called:', { title, description, priority, reminderTime });
  return invoke('add_todo', { title, description, priority, reminderTime });
}

export async function updateTodo(
  id: string,
  title: string,
  description: string,
  priority: Priority,
  reminderTime: string | null,
  completed: boolean
): Promise<Todo> {
  return invoke('update_todo', { id, title, description, priority, reminderTime, completed });
}

export async function deleteTodo(id: string): Promise<void> {
  return invoke('delete_todo', { id });
}

export async function toggleTodo(id: string): Promise<Todo> {
  return invoke('toggle_todo', { id });
}

export async function reorderTodo(id: string, newOrder: number): Promise<void> {
  return invoke('reorder_todo', { id, newOrder });
}
