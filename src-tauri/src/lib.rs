use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{State, Manager};
use uuid::Uuid;
use chrono::Utc;
use log;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    P0,
    P1,
    P2,
    P3,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::P3
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "priority")]
    pub priority: Priority,
    #[serde(rename = "reminderTime")]
    pub reminder_time: Option<String>,
    pub completed: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoStore {
    pub todos: Vec<Todo>,
}

impl Default for TodoStore {
    fn default() -> Self {
        TodoStore { todos: vec![] }
    }
}

pub struct AppState {
    pub store: Mutex<TodoStore>,
    pub data_path: PathBuf,
}

fn ensure_data_dir(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_store(path: &PathBuf) -> TodoStore {
    if path.exists() {
        match fs::read_to_string(path) {
            Ok(content) => {
                match serde_json::from_str(&content) {
                    Ok(store) => return store,
                    Err(e) => log::warn!("Failed to parse store: {}", e),
                }
            }
            Err(e) => log::warn!("Failed to read store: {}", e),
        }
    }
    TodoStore::default()
}

fn save_store(store: &TodoStore, path: &PathBuf) -> Result<(), String> {
    if let Err(e) = ensure_data_dir(path) {
        log::warn!("Failed to ensure data dir: {}", e);
    }
    if let Ok(content) = serde_json::to_string_pretty(store) {
        if let Err(e) = fs::write(path, content) {
            log::warn!("Failed to write store: {}", e);
        }
    }
    Ok(())
}

#[tauri::command]
fn get_todos(state: State<AppState>) -> Result<Vec<Todo>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let mut todos = store.todos.clone();
    todos.sort_by(|a, b| a.sort_order.cmp(&b.sort_order));
    Ok(todos)
}

#[tauri::command]
fn add_todo(
    title: String,
    description: String,
    priority: Priority,
    reminder_time: Option<String>,
    state: State<AppState>,
) -> Result<Todo, String> {
    println!("add_todo called: title={}, priority={:?}", title, priority);
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let max_order = store.todos.iter().map(|t| t.sort_order).max().unwrap_or(0);
    let todo = Todo {
        id: Uuid::new_v4().to_string(),
        title,
        description,
        priority,
        reminder_time,
        completed: false,
        created_at: now.clone(),
        updated_at: now,
        sort_order: max_order + 1,
    };
    store.todos.push(todo.clone());
    save_store(&store, &state.data_path)?;
    Ok(todo)
}

#[tauri::command]
fn update_todo(
    id: String,
    title: String,
    description: String,
    priority: Priority,
    reminder_time: Option<String>,
    completed: bool,
    state: State<AppState>,
) -> Result<Todo, String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let todo = store.todos.iter_mut().find(|t| t.id == id);
    if let Some(todo) = todo {
        todo.title = title;
        todo.description = description;
        todo.priority = priority;
        todo.reminder_time = reminder_time;
        todo.completed = completed;
        todo.updated_at = Utc::now().to_rfc3339();
        let updated = todo.clone();
        save_store(&store, &state.data_path)?;
        Ok(updated)
    } else {
        Err("Todo not found".to_string())
    }
}

#[tauri::command]
fn delete_todo(id: String, state: State<AppState>) -> Result<(), String> {
    log::info!("delete_todo called: id={}", id);
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let len_before = store.todos.len();
    store.todos.retain(|t| t.id != id);
    let len_after = store.todos.len();
    log::info!("delete_todo: removed {} todos (before: {}, after: {})", len_before - len_after, len_before, len_after);
    save_store(&store, &state.data_path)
}

#[tauri::command]
fn toggle_todo(id: String, state: State<AppState>) -> Result<Todo, String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let todo = store.todos.iter_mut().find(|t| t.id == id);
    if let Some(todo) = todo {
        todo.completed = !todo.completed;
        todo.updated_at = Utc::now().to_rfc3339();
        let updated = todo.clone();
        save_store(&store, &state.data_path)?;
        Ok(updated)
    } else {
        Err("Todo not found".to_string())
    }
}

#[tauri::command]
fn reorder_todo(
    id: String,
    new_order: i32,
    state: State<AppState>,
) -> Result<(), String> {
    log::info!("reorder_todo called: id={}, new_order={}", id, new_order);
    let mut store = state.store.lock().map_err(|e| e.to_string())?;

    let todo_idx = store.todos.iter().position(|t| t.id == id);
    if let Some(idx) = todo_idx {
        let old_order = store.todos[idx].sort_order;
        log::info!("reorder_todo: old_order={}, new_order={}", old_order, new_order);

        if old_order < new_order {
            for todo in store.todos.iter_mut() {
                if todo.sort_order > old_order && todo.sort_order <= new_order {
                    todo.sort_order -= 1;
                }
            }
        } else if old_order > new_order {
            for todo in store.todos.iter_mut() {
                if todo.sort_order >= new_order && todo.sort_order < old_order {
                    todo.sort_order += 1;
                }
            }
        }

        store.todos[idx].sort_order = new_order;
        store.todos[idx].updated_at = Utc::now().to_rfc3339();
        save_store(&store, &state.data_path)?;
        log::info!("reorder_todo success");
        Ok(())
    } else {
        log::warn!("reorder_todo: todo not found");
        Err("Todo not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Starting bty-todo application");

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let data_path = app.path().app_data_dir()
                .map(|p| p.join("todos.json"))
                .unwrap_or_else(|_| {
                    let exe_path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
                    exe_path.parent().unwrap_or(&exe_path).join("todos.json")
                });
            log::info!("Data path: {:?}", data_path);

            if let Some(parent) = data_path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            let store = if data_path.exists() {
                load_store(&data_path)
            } else {
                TodoStore::default()
            };
            let app_state = AppState {
                store: Mutex::new(store),
                data_path: data_path.clone(),
            };
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_todos,
            add_todo,
            update_todo,
            delete_todo,
            toggle_todo,
            reorder_todo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
