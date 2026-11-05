/**
 * CABSSA Clubdesk — Events & Duty Management Module
 * Create and manage events, assign committee responsibilities and schedule shifts.
 */
(() => {
  'use strict';

  let currentEventsList = [];
  let activeEventForDuty = null;

  const EventsModule = {
    async init() {
      await this.renderEvents();
      this.bindEvents();
    },

    bindEvents() {
      const form = document.getElementById('eventForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveEvent();
        });
      }

      const dutyForm = document.getElementById('dutyAssignmentForm');
      if (dutyForm) {
        dutyForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleAssignDuty();
        });
      }
    },

    async renderEvents() {
      const container = document.getElementById('eventsListContainer');
      if (!container) return;

      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 font-mono text-xs">
          Querying events and committee duty rosters...
        </div>
      `;

      try {
        currentEventsList = await window.CABSSA_API.getEvents();

        if (currentEventsList.length === 0) {
          container.innerHTML = `
            <div class="py-12 text-center text-slate-400 text-xs">
              <p class="font-semibold text-slate-300">No events found</p>
              <p class="text-[11px] text-slate-500 mt-1">Create an event using the "+ Create Event" button above.</p>
            </div>
          `;
          return;
        }

        const isPrivileged = window.CABSSA_AUTH.user && 
          (window.CABSSA_AUTH.user.role === 'ADMIN' || window.CABSSA_AUTH.user.role === 'CO_HEAD');

        container.innerHTML = currentEventsList.map(ev => {
          const isCompleted = ev.status === 'Completed';
          const isCancelled = ev.status === 'Cancelled';

          return `
            <div class="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-violet-500/30 transition-all space-y-5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isCompleted ? 'bg-slate-500/20 text-slate-300' : isCancelled ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">
                      ${ev.status}
                    </span>
                    <span class="text-xs text-violet-400 font-mono">${escapeHtml(ev.domain_name)}</span>
                  </div>
                  <h3 class="text-lg font-bold text-white">${escapeHtml(ev.title)}</h3>
                </div>

                <div class="flex items-center space-x-2">
                  <button 
                    onclick="window.CABSSA_ATTENDANCE.openGenerateQRModal('${ev.id}', '${escapeHtml(ev.title)}')"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 transition-colors flex items-center space-x-1.5"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                    </svg>
                    <span>Attendance QR</span>
                  </button>

                  ${isPrivileged ? `
                    <button 
                      onclick="window.CABSSA_EVENTS.openEditEventModal('${ev.id}')"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/[0.08] transition-colors"
                    >
                      Edit
                    </button>
                    <button 
                      onclick="window.CABSSA_EVENTS.openDutyModal('${ev.id}')"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
                    >
                      + Assign Duty
                    </button>

                    <button 
                      onclick="window.CABSSA_EVENTS.deleteEvent('${ev.id}')"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Event"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(ev.description || '')}</p>

              <!-- Meta specs -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono text-slate-300">
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase">Event Date</span>
                  <span class="font-semibold text-white">Date: ${ev.event_date}</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase">Shift Timings</span>
                  <span class="font-semibold text-white">Time: ${ev.start_time} - ${ev.end_time}</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase">Venue Location</span>
                  <span class="font-semibold text-white">Venue: ${escapeHtml(ev.location)}</span>
                </div>
              </div>

              <!-- Assigned duties roster -->
              <div class="space-y-2 pt-2 border-t border-white/[0.06]">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-slate-400">Assigned Committee Members (${ev.assigned_members?.length || 0})</span>
                  <span class="text-slate-400">${ev.attendance_count || 0} Attended</span>
                </div>

                ${(!ev.assigned_members || ev.assigned_members.length === 0) ? `
                  <p class="text-[11px] text-slate-500 italic">No duties assigned yet.</p>
                ` : `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${ev.assigned_members.map(m => `
                      <div class="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex items-start justify-between text-xs">
                        <div class="space-y-0.5">
                          <p class="font-bold text-white">${escapeHtml(m.member_name)} <span class="text-[10px] text-slate-400 font-mono">(${m.member_prn})</span></p>
                          <p class="text-[11px] text-slate-400">${escapeHtml(m.duty_responsibility)}</p>
                        </div>
                        ${isPrivileged ? `
                          <button 
                            onclick="window.CABSSA_EVENTS.removeDuty('${ev.id}', '${m.id}')"
                            class="text-slate-500 hover:text-red-400 ml-2 p-1"
                            title="Remove Duty Assignment"
                          >
                            ×
                          </button>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        container.innerHTML = `<div class="py-8 text-center text-rose-400 text-xs">Database error: ${escapeHtml(err.message)}</div>`;
      }
    },

    openAddEventModal() {
      if (!window.CABSSA_AUTH.requireCoHead()) return;

      const modal = document.getElementById('eventModal');
      const form = document.getElementById('eventForm');
      if (form) form.reset();

      const idInput = document.getElementById('eventFormId');
      if (idInput) idInput.value = '';

      const statusContainer = document.getElementById('eventFormStatusContainer');
      if (statusContainer) statusContainer.classList.add('hidden');

      const modalTitle = modal.querySelector('h3');
      if (modalTitle) modalTitle.textContent = 'Create Association Event';

      // Populate domain dropdown
      const sel = document.getElementById('eventFormDomain');
      if (sel) {
        sel.innerHTML = '<option value="">General Association Event</option>';
        (window.CABSSA_DOMAINS_LIST || []).forEach(d => {
          sel.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
        });
      }

      if (modal) modal.classList.remove('hidden');
    },

    openEditEventModal(eventId) {
      if (!window.CABSSA_AUTH.requireCoHead()) return;
      const ev = currentEventsList.find(e => e.id === eventId);
      if (!ev) return;

      const modal = document.getElementById('eventModal');
      const form = document.getElementById('eventForm');
      if (form) form.reset();

      const idInput = document.getElementById('eventFormId');
      if (idInput) idInput.value = ev.id;

      document.getElementById('eventFormTitle').value = ev.title || '';
      document.getElementById('eventFormDescription').value = ev.description || '';
      document.getElementById('eventFormDate').value = ev.event_date || '';
      document.getElementById('eventFormStartTime').value = ev.start_time || '';
      document.getElementById('eventFormEndTime').value = ev.end_time || '';
      document.getElementById('eventFormLocation').value = ev.location || '';

      const statusContainer = document.getElementById('eventFormStatusContainer');
      if (statusContainer) {
        statusContainer.classList.remove('hidden');
        const statusSelect = document.getElementById('eventFormStatus');
        if (statusSelect) statusSelect.value = ev.status || 'Upcoming';
      }

      const modalTitle = modal.querySelector('h3');
      if (modalTitle) modalTitle.textContent = 'Edit Association Event';

      const sel = document.getElementById('eventFormDomain');
      if (sel) {
        sel.innerHTML = '<option value="">General Association Event</option>';
        (window.CABSSA_DOMAINS_LIST || []).forEach(d => {
          const selected = ev.domain_id === d.id ? 'selected' : '';
          sel.innerHTML += `<option value="${d.id}" ${selected}>${escapeHtml(d.name)}</option>`;
        });
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeEventModal() {
      const modal = document.getElementById('eventModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleSaveEvent() {
      const id = document.getElementById('eventFormId')?.value || '';
      const title = document.getElementById('eventFormTitle').value.trim();
      const description = document.getElementById('eventFormDescription').value.trim();
      const event_date = document.getElementById('eventFormDate').value;
      const start_time = document.getElementById('eventFormStartTime').value;
      const end_time = document.getElementById('eventFormEndTime').value;
      const location = document.getElementById('eventFormLocation').value.trim();
      const domain_id = document.getElementById('eventFormDomain').value || null;
      const status = id ? (document.getElementById('eventFormStatus')?.value || 'Upcoming') : 'Upcoming';

      if (!title || !event_date || !start_time || !end_time || !location) {
        window.CABSSA_TOAST.show('Please fill in all required event details.', 'error');
        return;
      }

      const payload = {
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        domain_id,
        status
      };

      try {
        if (id) {
          await window.CABSSA_API.updateEvent(id, payload);
          window.CABSSA_TOAST.show(`Event '${title}' updated in database.`, 'success');
        } else {
          await window.CABSSA_API.createEvent(payload);
          window.CABSSA_TOAST.show(`Event '${title}' successfully created in database.`, 'success');
        }

        this.closeEventModal();
        await this.renderEvents();
      } catch (err) {
        window.CABSSA_TOAST.show('Failed to save event: ' + err.message, 'error');
      }
    },

    async openDutyModal(eventId) {
      if (!window.CABSSA_AUTH.requireCoHead()) return;
      activeEventForDuty = eventId;

      const modal = document.getElementById('dutyModal');
      const form = document.getElementById('dutyAssignmentForm');
      if (form) form.reset();

      // Populate member dropdown
      const memberSelect = document.getElementById('dutyMemberSelect');
      if (memberSelect) {
        memberSelect.innerHTML = '<option value="">Select Committee Member...</option>';
        try {
          const members = await window.CABSSA_API.getMembers({ status: 'Active' });
          members.forEach(m => {
            memberSelect.innerHTML += `<option value="${m.id}">${escapeHtml(m.full_name)} (${m.prn_number}) - ${m.designation}</option>`;
          });
        } catch (e) {}
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeDutyModal() {
      const modal = document.getElementById('dutyModal');
      if (modal) modal.classList.add('hidden');
      activeEventForDuty = null;
    },

    async handleAssignDuty() {
      const memberId = document.getElementById('dutyMemberSelect').value;
      const responsibility = document.getElementById('dutyResponsibilityText').value.trim();

      if (!activeEventForDuty || !memberId || !responsibility) {
        window.CABSSA_TOAST.show('Member and Duty Responsibility are required.', 'error');
        return;
      }

      try {
        await window.CABSSA_API.assignDuty(activeEventForDuty, memberId, responsibility);
        window.CABSSA_TOAST.show('Duty assigned and recorded in database.', 'success');
        this.closeDutyModal();
        await this.renderEvents();
      } catch (err) {
        window.CABSSA_TOAST.show('Failed to assign duty: ' + err.message, 'error');
      }
    },

    async removeDuty(eventId, dutyId) {
      if (!window.CABSSA_AUTH.requireCoHead()) return;
      if (confirm('Remove this duty assignment?')) {
        try {
          await window.CABSSA_API.removeDuty(eventId, dutyId);
          window.CABSSA_TOAST.show('Duty assignment removed.', 'info');
          await this.renderEvents();
        } catch (err) {
          window.CABSSA_TOAST.show('Error: ' + err.message, 'error');
        }
      }
    },

    async deleteEvent(eventId) {
      if (!window.CABSSA_AUTH.requireAdmin()) return;
      if (confirm('Are you sure you want to delete this event and its duty roster?')) {
        try {
          await window.CABSSA_API.deleteEvent(eventId);
          window.CABSSA_TOAST.show('Event removed from database.', 'info');
          await this.renderEvents();
        } catch (err) {
          window.CABSSA_TOAST.show('Error: ' + err.message, 'error');
        }
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_EVENTS = EventsModule;
})();
