/**
 * CABSSA Clubdesk — Action Items & Task Tracking Module
 * Real-time task boards, priority filters and status progression.
 */
(() => {
  'use strict';

  let currentTasksList = [];
  let filterMyTasksOnly = false;

  const TasksModule = {
    async init() {
      await this.renderTasks();
      this.bindEvents();
    },

    bindEvents() {
      const myTasksToggle = document.getElementById('myTasksFilterToggle');
      if (myTasksToggle) {
        myTasksToggle.addEventListener('change', (e) => {
          filterMyTasksOnly = e.target.checked;
          this.renderTasks();
        });
      }

      const priorityFilter = document.getElementById('taskPriorityFilter');
      if (priorityFilter) {
        priorityFilter.addEventListener('change', () => {
          this.renderTasks();
        });
      }

      const form = document.getElementById('taskForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveTask();
        });
      }
    },

    async renderTasks() {
      const container = document.getElementById('tasksListContainer');
      const countEl = document.getElementById('tasksCountDisplay');
      if (!container) return;

      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 font-mono text-xs">
          Loading assigned sprint action items...
        </div>
      `;

      try {
        const priority = document.getElementById('taskPriorityFilter')?.value || '';
        const filters = {};
        if (priority) filters.priority = priority;

        currentTasksList = await window.CABSSA_API.getTasks(filters);

        const currentUserId = window.CABSSA_AUTH.user?.id;
        let displayList = currentTasksList;

        if (filterMyTasksOnly && currentUserId) {
          displayList = displayList.filter(t => t.assigned_to === currentUserId);
        }

        if (countEl) countEl.textContent = `${displayList.length} Action Items`;

        if (displayList.length === 0) {
          container.innerHTML = `
            <div class="py-12 text-center text-slate-400 text-xs">
              <p class="font-semibold text-slate-300">No action items found</p>
              <p class="text-[11px] text-slate-500 mt-1">Assign new tasks using "+ Assign Action Item" button.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = displayList.map(t => {
          const isDone = t.status === 'Completed';
          const isInProgress = t.status === 'In Progress';
          const isUrgent = t.priority === 'Urgent';
          const isHigh = t.priority === 'High';

          const priorityBadge = isUrgent 
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
            : isHigh 
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
            : 'bg-violet-500/20 text-violet-300 border-violet-500/30';

          return `
            <div class="p-5 rounded-2xl bg-white/[0.03] border ${isDone ? 'border-emerald-500/20 opacity-75' : 'border-white/[0.08] hover:border-violet-500/30'} transition-all space-y-3.5">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${priorityBadge} border">
                      ${t.priority} Priority
                    </span>
                    <span class="text-xs font-mono text-slate-400 font-semibold">${t.task_code}</span>
                  </div>
                  <h3 class="text-sm font-bold text-white ${isDone ? 'line-through text-slate-400' : ''}">
                    ${escapeHtml(t.title)}
                  </h3>
                </div>

                <!-- Status Button Switcher -->
                <div class="flex items-center space-x-1.5 flex-shrink-0">
                  <select 
                    onchange="window.CABSSA_TASKS.updateStatus('${t.id}', this.value)"
                    class="bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-200 rounded-lg p-1.5 focus:border-violet-500 outline-none"
                  >
                    <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                  </select>
                  <button 
                    onclick="window.CABSSA_TASKS.deleteTask('${t.id}')"
                    class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Action Item"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(t.description || 'No detailed instructions provided.')}</p>

              <!-- Footer meta -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.04] text-[11px] font-mono text-slate-400">
                <div class="flex items-center space-x-2">
                  <span class="text-slate-500">Assignee:</span>
                  <span class="text-violet-300 font-semibold">${escapeHtml(t.assignee_name)}</span>
                </div>

                <div class="flex items-center space-x-4">
                  <span>Due: <strong class="text-slate-200">${t.due_date}</strong></span>
                  ${t.completed_at ? `<span class="text-emerald-400 font-semibold">Done: ${new Date(t.completed_at).toLocaleDateString()}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        container.innerHTML = `<div class="py-8 text-center text-rose-400 text-xs">Error: ${escapeHtml(err.message)}</div>`;
      }
    },

    async updateStatus(taskId, newStatus) {
      try {
        await window.CABSSA_API.updateTaskStatus(taskId, newStatus);
        window.CABSSA_TOAST.show(`Task status updated to '${newStatus}' in database.`, 'success');
        await this.renderTasks();
      } catch (err) {
        window.CABSSA_TOAST.show('Failed to update task: ' + err.message, 'error');
        await this.renderTasks();
      }
    },

    async openAddTaskModal() {
      if (!window.CABSSA_AUTH.requireCoHead()) return;

      const modal = document.getElementById('taskModal');
      const form = document.getElementById('taskForm');
      if (form) form.reset();

      // Populate assigned_to dropdown
      const sel = document.getElementById('taskFormAssignee');
      if (sel) {
        sel.innerHTML = '<option value="">Select Assignee...</option>';
        try {
          const members = await window.CABSSA_API.getMembers({ status: 'Active' });
          members.forEach(m => {
            sel.innerHTML += `<option value="${m.id}">${escapeHtml(m.full_name)} (${m.prn_number}) - ${m.designation}</option>`;
          });
        } catch (e) {}
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeTaskModal() {
      const modal = document.getElementById('taskModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleSaveTask() {
      const title = document.getElementById('taskFormTitle').value.trim();
      const description = document.getElementById('taskFormDescription').value.trim();
      const assigned_to = document.getElementById('taskFormAssignee').value;
      const priority = document.getElementById('taskFormPriority').value;
      const due_date = document.getElementById('taskFormDueDate').value;

      if (!title || !assigned_to || !due_date) {
        window.CABSSA_TOAST.show('Please fill in Title, Assignee and Due Date.', 'error');
        return;
      }

      try {
        await window.CABSSA_API.createTask({
          title,
          description,
          assigned_to,
          priority,
          due_date
        });

        window.CABSSA_TOAST.show(`Action item '${title}' assigned and recorded in database.`, 'success');
        this.closeTaskModal();
        await this.renderTasks();
      } catch (err) {
        window.CABSSA_TOAST.show('Error saving task: ' + err.message, 'error');
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  TasksModule.deleteTask = async function(taskId) {
    if (!window.CABSSA_AUTH.requireCoHead()) return;

    if (confirm('Are you sure you want to delete this action item from database?')) {
      try {
        await window.CABSSA_API.deleteTask(taskId);
        window.CABSSA_TOAST.show('Action item removed from database.', 'info');
        await this.renderTasks();
      } catch (err) {
        window.CABSSA_TOAST.show('Failed to delete task: ' + err.message, 'error');
      }
    }
  };

  window.CABSSA_TASKS = TasksModule;
})();
