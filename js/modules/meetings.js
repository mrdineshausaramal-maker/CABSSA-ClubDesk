/**
 * CABSSA Clubdesk — Meeting Management & Minutes of Meeting (MoM) Module
 * Create, search and inspect official committee minutes, agendas and decisions.
 */
(() => {
  'use strict';

  let currentMeetingsList = [];

  const MeetingsModule = {
    async init() {
      await this.renderMeetings();
      this.bindEvents();
    },

    bindEvents() {
      const searchInput = document.getElementById('momSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.filterMeetings(e.target.value.toLowerCase().trim());
        });
      }

      const form = document.getElementById('momForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveMoM();
        });
      }
    },

    async renderMeetings() {
      const container = document.getElementById('meetingsListContainer');
      if (!container) return;

      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 font-mono text-xs">
          Querying Minutes of Meeting (MoM) database...
        </div>
      `;

      try {
        currentMeetingsList = await window.CABSSA_API.getMeetings();
        this.displayMeetings(currentMeetingsList);
      } catch (err) {
        container.innerHTML = `<div class="py-8 text-center text-rose-400 text-xs">Error: ${escapeHtml(err.message)}</div>`;
      }
    },

    filterMeetings(query) {
      if (!query) {
        this.displayMeetings(currentMeetingsList);
        return;
      }
      const filtered = currentMeetingsList.filter(m => 
        m.title.toLowerCase().includes(query) ||
        m.agenda.toLowerCase().includes(query) ||
        m.decisions_taken.toLowerCase().includes(query)
      );
      this.displayMeetings(filtered);
    },

    displayMeetings(list) {
      const container = document.getElementById('meetingsListContainer');
      if (!container) return;

      if (list.length === 0) {
        container.innerHTML = `
          <div class="py-12 text-center text-slate-400 text-xs">
            <p class="font-semibold text-slate-300">No meeting minutes found</p>
            <p class="text-[11px] text-slate-500 mt-1">Record minutes of meeting using the "+ Record MoM" button.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = list.map(m => {
        const dateStr = new Date(m.meeting_date).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = new Date(m.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-violet-500/30 transition-all space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <span class="text-[10px] font-mono uppercase text-violet-400 font-bold">Official Executive Session</span>
                <h3 class="text-base font-bold text-white">${escapeHtml(m.title)}</h3>
                <p class="text-xs text-slate-400 font-mono">📅 ${dateStr} at ${timeStr} · Recorded by ${escapeHtml(m.creator_name)}</p>
              </div>

              <button 
                onclick="window.CABSSA_MEETINGS.openMoMReader('${m.id}')"
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 transition-colors self-start sm:self-auto"
              >
                Inspect Full MoM
              </button>
            </div>

            <!-- Summary sections -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div class="space-y-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p class="font-bold text-violet-300 uppercase text-[10px] font-mono">Session Agenda</p>
                <p class="text-slate-300 whitespace-pre-line text-[11px]">${escapeHtml(m.agenda)}</p>
              </div>

              <div class="space-y-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p class="font-bold text-emerald-400 uppercase text-[10px] font-mono">Key Decisions Taken</p>
                <p class="text-slate-300 whitespace-pre-line text-[11px]">${escapeHtml(m.decisions_taken)}</p>
              </div>
            </div>

            ${m.announcements ? `
              <div class="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200">
                <span class="font-bold font-mono text-[10px] block uppercase text-amber-400">Important Announcements:</span>
                <p class="mt-0.5">${escapeHtml(m.announcements)}</p>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    },

    async openAddMoMModal() {
      if (!window.CABSSA_AUTH.requireCoHead()) return;

      const modal = document.getElementById('momModal');
      const form = document.getElementById('momForm');
      if (form) form.reset();

      // Populate attendees checkboxes
      const attendeesContainer = document.getElementById('momAttendeesList');
      if (attendeesContainer) {
        attendeesContainer.innerHTML = '<span class="text-xs text-slate-500">Loading committee roster...</span>';
        try {
          const members = await window.CABSSA_API.getMembers({ status: 'Active' });
          attendeesContainer.innerHTML = members.map(m => `
            <label class="flex items-center space-x-2 text-xs text-slate-300 p-1 hover:bg-white/[0.04] rounded cursor-pointer">
              <input type="checkbox" name="momAttendee" value="${m.id}" class="rounded border-slate-700 text-violet-600 focus:ring-violet-500">
              <span>${escapeHtml(m.full_name)} <span class="text-[10px] text-slate-500 font-mono">(${m.prn_number})</span></span>
            </label>
          `).join('');
        } catch (e) {}
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeMoMModal() {
      const modal = document.getElementById('momModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleSaveMoM() {
      const title = document.getElementById('momFormTitle').value.trim();
      const meeting_date = document.getElementById('momFormDate').value;
      const agenda = document.getElementById('momFormAgenda').value.trim();
      const discussion_points = document.getElementById('momFormDiscussion').value.trim();
      const decisions_taken = document.getElementById('momFormDecisions').value.trim();
      const announcements = document.getElementById('momFormAnnouncements').value.trim();
      const meeting_notes = document.getElementById('momFormNotes').value.trim();

      const attendee_ids = Array.from(document.querySelectorAll('input[name="momAttendee"]:checked')).map(cb => cb.value);

      if (!title || !agenda || !discussion_points || !decisions_taken) {
        window.CABSSA_TOAST.show('Please fill in Title, Agenda, Discussion Points and Decisions.', 'error');
        return;
      }

      try {
        await window.CABSSA_API.createMeeting({
          title,
          meeting_date,
          agenda,
          discussion_points,
          decisions_taken,
          announcements,
          meeting_notes,
          attendee_ids
        });

        window.CABSSA_TOAST.show(`MoM '${title}' recorded in database.`, 'success');
        this.closeMoMModal();
        await this.renderMeetings();
      } catch (err) {
        window.CABSSA_TOAST.show('Error saving MoM: ' + err.message, 'error');
      }
    },

    openMoMReader(id) {
      const meeting = currentMeetingsList.find(m => m.id === id);
      if (!meeting) return;

      const modal = document.getElementById('momReaderModal');
      document.getElementById('momReaderTitle').textContent = meeting.title;
      document.getElementById('momReaderDate').textContent = new Date(meeting.meeting_date).toLocaleString();
      document.getElementById('momReaderCreator').textContent = meeting.creator_name || 'Admin';
      document.getElementById('momReaderAgenda').textContent = meeting.agenda;
      document.getElementById('momReaderDiscussion').textContent = meeting.discussion_points;
      document.getElementById('momReaderDecisions').textContent = meeting.decisions_taken;
      document.getElementById('momReaderAnnouncements').textContent = meeting.announcements || 'None';
      document.getElementById('momReaderNotes').textContent = meeting.meeting_notes || 'None';

      const attendeesContainer = document.getElementById('momReaderAttendees');
      if (attendeesContainer) {
        if (!meeting.attendees || meeting.attendees.length === 0) {
          attendeesContainer.innerHTML = '<span class="text-slate-500 italic text-xs">No individual attendees tagged.</span>';
        } else {
          attendeesContainer.innerHTML = meeting.attendees.map(a => `
            <span class="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/[0.08] text-slate-300">
              ${escapeHtml(a.name)} (${a.prn})
            </span>
          `).join('');
        }
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeMoMReader() {
      const modal = document.getElementById('momReaderModal');
      if (modal) modal.classList.add('hidden');
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_MEETINGS = MeetingsModule;
})();
