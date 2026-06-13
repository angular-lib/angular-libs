import { Component, inject, Injectable, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ALStore,
  entityPlugin,
  historyPlugin,
  persistPlugin,
  resourcePlugin
} from '@angular-libs/store';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface DemoState {
  theme: 'light' | 'dark';
  todos: Todo[];
  selectedTodoId: number | null;
  dummyDoc: string;
  todoDetails: string;
}

const initialState: DemoState = {
  theme: 'light',
  todos: [
    { id: 1, text: 'Learn Angular Signals', completed: true },
    { id: 2, text: 'Explore ALStore Functional Plugins', completed: false },
    { id: 3, text: 'Build a gorgeous demo app', completed: false },
  ],
  selectedTodoId: null,
  dummyDoc: 'Welcome to ALStore documentation editor.',
  todoDetails: 'Click a todo item to fetch its detailed description asynchronously...',
};

@Injectable({ providedIn: 'root' })
export class AppDemoStore extends ALStore<DemoState> {
  // 1. Manage Todo items collection using entityPlugin
  readonly todoList = this.registerPlugin(
    entityPlugin('todos', { idField: 'id' })
  );

  // 2. Add full time-travel capability to the Todo list modifications
  readonly todoHistory = this.registerPlugin(
    historyPlugin('todos', { limit: 10 })
  );

  // 3. Add history to the doc editor
  readonly docHistory = this.registerPlugin(
    historyPlugin('dummyDoc', { limit: 20 })
  );

  // 4. Simulated Async Resource Plugin fetching descriptions for a selected Todo
  readonly infoResource = this.registerPlugin(
    resourcePlugin('todoDetails', {
      params: () => this.getSignal('selectedTodoId')(),
      loader: async ({ params: id, abortSignal }) => {
        if (!id)
          return 'Click a todo item to fetch its detailed description asynchronously...';

        // Simulate network API delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (abortSignal.aborted) {
          throw new Error('Aborted');
        }

        const todoText = this.get('todos').find((t) => t.id === id)?.text;
        if (!todoText) return `Todo #${id} has been removed.`;
        return `Detailed Info for Todo #${id}: "${todoText}" - Resolved successfully at ${new Date().toLocaleTimeString()}!`;
      },
    })
  );

  // 5. Selectively persist the 'theme' and 'todos' across page reloads
  readonly stateSaver = this.registerPlugin(
    persistPlugin(['theme', 'todos'], { keyPrefix: 'demo-app:' })
  );

  constructor() {
    super(initialState, { syncChannel: 'store_demo_sync_channel' });
  }

  toggleTheme() {
    this.update('theme', (t) => (t === 'light' ? 'dark' : 'light'));
  }
}

@Component({
  selector: 'app-store-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container" [class.dark-theme]="store.getSignal('theme')() === 'dark'">
      <div class="header-section">
        <h2>State Store Playground ⛃</h2>
        <p class="description">High-performance state management designed on top of Angular Signals.</p>
      </div>

      <div class="layout-grid">
        <!-- COLUMN 1: Task Manager -->
        <div class="column">
          <div class="widget-card">
            <div class="card-header-with-actions">
              <h3>📋 Task Manager</h3>
              <span class="badge">{{ store.getSignal('todos')().length }}</span>
            </div>
            <p class="sub-caption">Manage todo collection using <code>entityPlugin</code> and <code>historyPlugin</code>.</p>

            <!-- Todo History Panel -->
            <div class="history-panel">
              <span class="history-label">⏳ Todo History:</span>
              <button class="btn btn-xs btn-outline" [disabled]="!store.todoHistory.canUndo()" (click)="store.todoHistory.undo()">↩️ Undo</button>
              <button class="btn btn-xs btn-outline" [disabled]="!store.todoHistory.canRedo()" (click)="store.todoHistory.redo()">↪️ Redo</button>
            </div>

            <!-- Add Todo Form -->
            <form class="add-task-form" (submit)="addTodo($event, todoInput.value); todoInput.value = ''">
              <input #todoInput type="text" placeholder="What needs to be done? (Press Enter)" required>
              <button type="submit" class="btn btn-info">Add</button>
            </form>

            <!-- Todo List -->
            <div class="task-list">
              @for (todo of store.getSignal('todos')(); track todo.id) {
                <div class="task-item" [class.task-done]="todo.completed" [class.selected]="store.getSignal('selectedTodoId')() === todo.id" (click)="selectTodo(todo.id)">
                  <span class="checkbox-container">
                    <input type="checkbox" [checked]="todo.completed" (change)="toggleTodo(todo); $event.stopPropagation()">
                    <span class="task-name">{{ todo.text }}</span>
                  </span>
                  <button class="btn btn-danger-icon" (click)="removeTodo(todo.id); $event.stopPropagation()">🗑️</button>
                </div>
              } @empty {
                <div class="empty-list">🎉 All done! Add a new task above or click Undo to restore.</div>
              }
            </div>
          </div>
        </div>

        <!-- COLUMN 2: Document Editor & Async Loader -->
        <div class="column">
          <div class="widget-card">
            <div class="card-header-with-actions">
              <h3>📝 Documentation Writer</h3>
              <div class="btn-group">
                <button class="btn btn-xs btn-outline" [disabled]="!store.docHistory.canUndo()" (click)="store.docHistory.undo()">↩️ Undo</button>
                <button class="btn btn-xs btn-outline" [disabled]="!store.docHistory.canRedo()" (click)="store.docHistory.redo()">↪️ Redo</button>
              </div>
            </div>
            <p class="sub-caption">Safe document editing tracked by <code>historyPlugin</code>.</p>

            <textarea
              class="editor-textarea"
              [value]="store.getSignal('dummyDoc')()"
              (input)="updateDoc($event)"></textarea>
          </div>

          <div class="widget-card">
            <h3>🌩️ Async Description Loader</h3>
            <p class="sub-caption">Resolves descriptions using <code>resourcePlugin</code> asynchronously based on selection.</p>

            @if (store.infoResource.isLoading()) {
              <div class="resource-desc-loading">
                <span class="spinner"></span> Resolving from mock database...
              </div>
            } @else {
              <p class="resource-desc">💡 {{ store.infoResource.value() }}</p>
            }
          </div>

          <div class="widget-card">
            <h3>🎨 Real-time Sync & Themes</h3>
            <p class="sub-caption">Toggles themes synchronizing across multiple browser tabs via BroadcastChannel.</p>
            <div class="theme-row">
              <button class="btn btn-primary" (click)="store.toggleTheme()">
                🎨 Switch to {{ store.getSignal('theme')() === 'light' ? 'Dark Theme 🌙' : 'Light Theme ☀️' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container { padding: 24px; font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; transition: background 0.3s; }
    .demo-container.dark-theme { background-color: #0f171e; color: #cbd5e1; min-height: calc(100vh - 100px); }
    .header-section { background: linear-gradient(135deg, #1e1b4b, #4f46e5); color: white; padding: 24px; border-radius: 8px; margin-bottom: 30px; }
    .header-section h2 { margin: 0; font-size: 1.8rem; font-weight: 800; }
    .header-section .description { margin: 4px 0 0 0; color: rgba(255,255,255,0.9); font-size: 1rem; }
    .layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 768px) { .layout-grid { grid-template-columns: 1fr; } }
    .widget-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; margin-bottom: 24px; }
    .dark-theme .widget-card { background: #1e293b; border-color: #334155; color: #cbd5e1; }
    .widget-card h3 { margin: 0; color: #0f172a; font-size: 1.1rem; }
    .dark-theme .widget-card h3 { color: #f8fafc; }
    .card-header-with-actions { display: flex; justify-content: space-between; align-items: center; }
    .sub-caption { margin: 4px 0 16px 0; color: #64748b; font-size: 0.85rem; }
    .dark-theme .sub-caption { color: #94a3b8; }
    .theme-row { display: flex; align-items: center; gap: 12px; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: background 0.2s; }
    .btn-xs { padding: 4px 8px; font-size: 0.75rem; }
    .btn-outline { border: 1px solid #cbd5e1; background: white; color: #334155; }
    .btn-outline:hover:not(:disabled) { background: #f1f5f9; }
    .dark-theme .btn-outline { border-color: #475569; background: #334155; color: #f8fafc; }
    .dark-theme .btn-outline:hover:not(:disabled) { background: #475569; }
    .btn-primary { background: #4f46e5; color: white; }
    .btn-primary:hover { background: #4338ca; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-info { background: #3b82f6; color: white; }
    .btn-info:hover { background: #2563eb; }
    .btn-danger-icon { background: transparent; padding: 4px; font-size: 1rem; border: none; cursor: pointer; }
    .editor-textarea { width: 100%; height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; outline: none; resize: none; }
    .dark-theme .editor-textarea { border-color: #475569; background: #334155; color: #f8fafc; }
    .add-task-form { display: flex; gap: 8px; margin-bottom: 16px; }
    .add-task-form input { flex-grow: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
    .dark-theme .add-task-form input { border-color: #475569; background: #334155; color: #f8fafc; }
    .task-list { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
    .dark-theme .task-list { border-color: #334155; }
    .empty-list { padding: 20px; text-align: center; color: #64748b; font-style: italic; }
    .task-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; background: white; cursor: pointer; transition: background 0.15s; }
    .dark-theme .task-item { border-bottom-color: #334155; background: #1e293b; }
    .task-item:last-child { border-bottom: none; }
    .task-item.selected { background: #f0f9ff; border-left: 4px solid #3b82f6; }
    .dark-theme .task-item.selected { background: #1e3a8a; border-left-color: #3b82f6; }
    .checkbox-container { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; flex-grow: 1; }
    .task-name { font-size: 0.9rem; }
    .task-done .task-name { text-decoration: line-through; color: #94a3b8; }
    
    .badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
    .dark-theme .badge { background: #0369a1; color: #f8fafc; }
    .history-panel { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 6px 12px; border-radius: 6px; margin-bottom: 16px; border: 1px dashed #cbd5e1; }
    .dark-theme .history-panel { background: #334155; border-color: #475569; }
    .history-label { font-size: 0.8rem; color: #64748b; font-weight: 600; margin-right: auto; }
    .dark-theme .history-label { color: #cbd5e1; }
    .btn-group { display: flex; gap: 4px; }

    .resource-desc { font-size: 0.9rem; color: #475569; margin: 0; padding: 12px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; }
    .dark-theme .resource-desc { background: #14532d; color: #f8fafc; border-left-color: #22c55e; }
    .resource-desc-loading { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
    .dark-theme .resource-desc-loading { background: #1e293b; color: #94a3b8; border-color: #334155; }
    .spinner { width: 16px; height: 16px; border: 2px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class StoreDemoComponent {
  readonly store = inject(AppDemoStore);

  addTodo(event: Event, text: string) {
    event.preventDefault();
    if (!text.trim()) return;

    const newTodo: Todo = {
      id: Date.now(),
      text: text.trim(),
      completed: false,
    };

    this.store.todoList.addOne(newTodo);
  }

  toggleTodo(todo: Todo) {
    const updated = {
      ...todo,
      completed: !todo.completed,
    };
    this.store.todoList.setOne(updated);
  }

  removeTodo(id: number) {
    this.store.todoList.removeOne(id);
    if (this.store.get('selectedTodoId') === id) {
      this.store.set('selectedTodoId', null);
    }
  }

  selectTodo(id: number) {
    this.store.set('selectedTodoId', id);
  }

  updateDoc(event: Event) {
    const input = event.target as HTMLTextAreaElement;
    this.store.set('dummyDoc', input.value);
  }
}



