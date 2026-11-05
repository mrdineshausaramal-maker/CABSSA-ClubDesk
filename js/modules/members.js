/**
 * CABSSA Clubdesk — Member Management Module (HIGHEST PRIORITY)
 * End-to-end database-connected Member CRUD, CSV import/export, profile drawer and photo upload.
 */
(() => {
  'use strict';

  let currentMembersList = [];
  let currentDomainsList = [];
  let activeMemberInDrawer = null;

  const MembersModule = {
    async init() {
      await this.loadDomains();
      await this.renderMembersTable();
      this.bindEvents();
    },

    async loadDomains() {
      try {
        currentDomainsList = await window.CABSSA_API.getDomains();
        this.populateDomainDropdowns();
      } catch (err) {
        console.error('Failed to load domains:', err);
      }
    },

    populateDomainDropdowns() {
      const selects = [
        document.getElementById('memberFilterDomain'),
        document.getElementById('memberFormDomain')
      ];

      selects.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        const isFilter = sel.id.includes('Filter');
        sel.innerHTML = isFilter 
          ? '<option value="">All Domains</option>' 
          : '<option value="">Select Domain Assignment</option>';

        currentDomainsList.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = d.name;
          sel.appendChild(opt);
        });

        if (currentVal) sel.value = currentVal;
      });
    },

    bindEvents() {
      // Search and Filter triggers
      const searchInput = document.getElementById('memberSearchInput');
      const domainFilter = document.getElementById('memberFilterDomain');
      const yearFilter = document.getElementById('memberFilterYear');
      const divFilter = document.getElementById('memberFilterDivision');
      const desigFilter = document.getElementById('memberFilterDesignation');
      const statusFilter = document.getElementById('memberFilterStatus');

      const applyFilters = () => {
        const filters = {
          search: searchInput ? searchInput.value : '',
          domain: domainFilter ? domainFilter.value : '',
          academic_year: yearFilter ? yearFilter.value : '',
          division: divFilter ? divFilter.value : '',
          designation: desigFilter ? desigFilter.value : '',
          status: statusFilter ? statusFilter.value : ''
        };
        this.renderMembersTable(filters);
      };

      if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
      if (domainFilter) domainFilter.addEventListener('change', applyFilters);
      if (yearFilter) yearFilter.addEventListener('change', applyFilters);
      if (divFilter) divFilter.addEventListener('change', applyFilters);
      if (desigFilter) desigFilter.addEventListener('change', applyFilters);
      if (statusFilter) statusFilter.addEventListener('change', applyFilters);

      // Add Member Form
      const memberForm = document.getElementById('memberForm');
      if (memberForm) {
        memberForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveMember();
        });
      }

      // Photo File Input Trigger
      const photoInput = document.getElementById('memberFormPhotoInput');
      if (photoInput) {
        photoInput.addEventListener('change', (e) => {
          this.handlePhotoSelected(e);
        });
      }

      // CSV Import Form
      const csvForm = document.getElementById('csvImportForm');
      if (csvForm) {
        csvForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleCsvImportSubmit();
        });
      }
    },

    async renderMembersTable(filters = {}) {
      const tbody = document.getElementById('membersTableBody');
      const countEl = document.getElementById('membersCountDisplay');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-slate-400 font-mono text-xs">
            <svg class="animate-spin h-6 w-6 text-violet-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Querying PostgreSQL Committee Members...
          </td>
        </tr>
      `;

      try {
        currentMembersList = await window.CABSSA_API.getMembers(filters);
        if (countEl) countEl.textContent = `${currentMembersList.length} Committee Members`;

        if (currentMembersList.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="8" class="text-center py-12 text-slate-400 text-xs">
                <div class="max-w-xs mx-auto space-y-2">
                  <p class="font-semibold text-slate-300">No member records found</p>
                  <p class="text-[11px] text-slate-500">No committee members matched the active search and filter criteria.</p>
                </div>
              </td>
            </tr>
          `;
          return;
        }

        const isAdmin = window.CABSSA_AUTH.user && window.CABSSA_AUTH.user.role === 'ADMIN';

        tbody.innerHTML = currentMembersList.map(member => {
          const domName = member.domain_name || 'General';
          const isInactive = member.status === 'Inactive';
          const photoUrl = member.profile_photo_url || '';

          return `
            <tr class="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
              <!-- Member & Avatar -->
              <td class="py-3.5 px-4">
                <div class="flex items-center space-x-3 cursor-pointer" onclick="window.CABSSA_MEMBERS.openProfileDrawer('${member.id}')">
                  <div class="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-violet-300 text-xs overflow-hidden flex-shrink-0">
                    ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(member.full_name)}" class="w-full h-full object-cover">` : escapeHtml(member.full_name.charAt(0))}
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-xs text-white group-hover:text-violet-300 transition-colors truncate">
                      ${escapeHtml(member.full_name)}
                    </p>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">
                      ${escapeHtml(member.member_id)}
                    </p>
                  </div>
                </div>
              </td>

              <!-- PRN & Roll -->
              <td class="py-3.5 px-4 font-mono text-xs">
                <p class="text-slate-200 font-semibold">${escapeHtml(member.prn_number)}</p>
                <p class="text-slate-500 text-[10px]">${escapeHtml(member.roll_number)}</p>
              </td>

              <!-- Academic Division -->
              <td class="py-3.5 px-4 text-xs">
                <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.08] text-slate-300">
                  ${escapeHtml(member.academic_year)} - Div ${escapeHtml(member.division)}
                </span>
              </td>

              <!-- Domain Assignment -->
              <td class="py-3.5 px-4 text-xs">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  ${escapeHtml(domName)}
                </span>
              </td>

              <!-- Designation & Role -->
              <td class="py-3.5 px-4 text-xs">
                <span class="font-medium text-slate-300">${escapeHtml(member.designation)}</span>
              </td>

              <!-- Contact & Vehicle -->
              <td class="py-3.5 px-4 text-xs font-mono">
                <p class="text-slate-300 text-[11px]">${escapeHtml(member.contact_number)}</p>
                <p class="text-[10px] ${member.personal_vehicle ? 'text-emerald-400' : 'text-slate-500'}">
                  ${member.personal_vehicle ? 'Vehicle Available' : 'No Vehicle'}
                </p>
              </td>

              <!-- Status -->
              <td class="py-3.5 px-4 text-xs">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isInactive ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'}">
                  ${escapeHtml(member.status)}
                </span>
              </td>

              <!-- Actions -->
              <td class="py-3.5 px-4 text-right">
                <div class="flex items-center justify-end space-x-1.5">
                  <button 
                    onclick="window.CABSSA_MEMBERS.openProfileDrawer('${member.id}')"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="View Full Profile"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  </button>

                  ${isAdmin ? `
                    <button 
                      onclick="window.CABSSA_MEMBERS.openEditMemberModal('${member.id}')"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      title="Edit Member Details"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>

                    <button 
                      onclick="window.CABSSA_MEMBERS.confirmDeactivate('${member.id}', '${escapeHtml(member.full_name)}', '${member.status}')"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="${isInactive ? 'Reactivate Member' : 'Deactivate Member (Preserve Records)'}"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (err) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-8 text-rose-400 text-xs font-mono">
              Database error: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    },

    openAddMemberModal() {
      if (!window.CABSSA_AUTH.requireAdmin()) return;

      const modal = document.getElementById('memberModal');
      const title = document.getElementById('memberModalTitle');
      const form = document.getElementById('memberForm');
      const idInput = document.getElementById('memberFormId');
      const errorBox = document.getElementById('memberFormErrorBox');

      if (form) form.reset();
      if (idInput) idInput.value = '';
      if (title) title.textContent = 'Add Committee Member to Database';
      if (errorBox) errorBox.classList.add('hidden');

      const photoPreview = document.getElementById('memberPhotoPreview');
      if (photoPreview) {
        photoPreview.src = 'logo.png';
      }

      if (modal) modal.classList.remove('hidden');
    },

    openEditMemberModal(id) {
      if (!window.CABSSA_AUTH.requireAdmin()) return;

      const member = currentMembersList.find(m => m.id === id);
      if (!member) {
        window.CABSSA_TOAST.show('Member record not found in active list.', 'error');
        return;
      }

      const modal = document.getElementById('memberModal');
      const title = document.getElementById('memberModalTitle');
      const idInput = document.getElementById('memberFormId');
      const errorBox = document.getElementById('memberFormErrorBox');

      if (idInput) idInput.value = member.id;
      if (title) title.textContent = `Edit Details: ${member.full_name} (${member.member_id})`;
      if (errorBox) errorBox.classList.add('hidden');

      // Populate form fields
      setValue('memberFormFullName', member.full_name);
      setValue('memberFormEmail', member.email);
      setValue('memberFormContact', member.contact_number);
      setValue('memberFormPRN', member.prn_number);
      setValue('memberFormRoll', member.roll_number);
      setValue('memberFormYear', member.academic_year);
      setValue('memberFormDivision', member.division);
      setValue('memberFormDesignation', member.designation);
      setValue('memberFormDomain', member.domain_id || '');
      setValue('memberFormDOB', member.dob || '');
      setValue('memberFormDOJ', member.date_of_joining || '');
      setValue('memberFormStatus', member.status || 'Active');

      const vehicleCheckbox = document.getElementById('memberFormVehicle');
      if (vehicleCheckbox) vehicleCheckbox.checked = Boolean(member.personal_vehicle);

      const photoPreview = document.getElementById('memberPhotoPreview');
      if (photoPreview) {
        photoPreview.src = member.profile_photo_url || 'logo.png';
      }

      if (modal) modal.classList.remove('hidden');
    },

    closeMemberModal() {
      const modal = document.getElementById('memberModal');
      if (modal) modal.classList.add('hidden');
    },

    async handlePhotoSelected(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // Validate size (< 5MB)
      if (file.size > 5 * 1024 * 1024) {
        window.CABSSA_TOAST.show('Photo file exceeds 5MB size limit.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        const preview = document.getElementById('memberPhotoPreview');
        if (preview) preview.src = base64Data;

        try {
          const res = await window.CABSSA_API.uploadPhoto(base64Data, file.name);
          const hiddenUrlInput = document.getElementById('memberFormPhotoUrl');
          if (hiddenUrlInput) hiddenUrlInput.value = res.url;
          window.CABSSA_TOAST.show('Profile photo uploaded to Storage.', 'info');
        } catch (uploadErr) {
          window.CABSSA_TOAST.show('Failed to upload photo: ' + uploadErr.message, 'error');
        }
      };
      reader.readAsDataURL(file);
    },

    async handleSaveMember() {
      const errorBox = document.getElementById('memberFormErrorBox');
      const submitBtn = document.getElementById('memberFormSubmitBtn');
      if (errorBox) errorBox.classList.add('hidden');

      const id = document.getElementById('memberFormId').value;
      const fullName = document.getElementById('memberFormFullName').value.trim();
      const email = document.getElementById('memberFormEmail').value.trim();
      const contactNumber = document.getElementById('memberFormContact').value.trim();
      const prnNumber = document.getElementById('memberFormPRN').value.trim();
      const rollNumber = document.getElementById('memberFormRoll').value.trim();
      const academicYear = document.getElementById('memberFormYear').value;
      const division = document.getElementById('memberFormDivision').value;
      const designation = document.getElementById('memberFormDesignation').value;
      const domainId = document.getElementById('memberFormDomain').value || null;
      const dob = document.getElementById('memberFormDOB').value || null;
      const dateOfJoining = document.getElementById('memberFormDOJ').value || null;
      const status = document.getElementById('memberFormStatus').value || 'Active';
      const personalVehicle = document.getElementById('memberFormVehicle').checked;
      const profilePhotoUrl = document.getElementById('memberFormPhotoUrl')?.value || 
                             document.getElementById('memberPhotoPreview')?.getAttribute('src') || '';

      // Client-side validations before database dispatch
      if (!fullName || !email || !contactNumber || !prnNumber || !rollNumber || !academicYear || !division || !designation) {
        if (errorBox) {
          errorBox.textContent = 'Please fill out all mandatory fields marked with an asterisk (*).';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorBox) {
          errorBox.textContent = 'Please enter a valid email address.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      const payload = {
        fullName,
        email,
        contactNumber,
        prnNumber,
        rollNumber,
        academicYear,
        division,
        designation,
        domainId,
        personalVehicle,
        dob,
        profilePhotoUrl,
        dateOfJoining,
        status
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Saving to PostgreSQL Database...`;
      }

      try {
        if (id) {
          // Update existing member
          await window.CABSSA_API.updateMember(id, payload);
          window.CABSSA_TOAST.show(`Member '${fullName}' successfully updated in PostgreSQL database.`, 'success');
        } else {
          // Create new member
          await window.CABSSA_API.createMember(payload);
          window.CABSSA_TOAST.show(`Member '${fullName}' permanently stored in database.`, 'success');
        }

        this.closeMemberModal();
        await this.renderMembersTable();
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Operation failed.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Save Member to Database`;
        }
      }
    },

    async confirmDeactivate(id, name, currentStatus) {
      if (!window.CABSSA_AUTH.requireAdmin()) return;

      const isDeactivating = currentStatus === 'Active';
      const promptText = isDeactivating
        ? `Are you sure you want to deactivate ${name}? Their historical records (attendance, tasks, MoM) will be safely preserved.`
        : `Reactivate ${name} as an active committee member?`;

      if (confirm(promptText)) {
        try {
          if (isDeactivating) {
            await window.CABSSA_API.deleteMember(id, false); // soft deactivation
            window.CABSSA_TOAST.show(`Member ${name} deactivated. Historical data preserved.`, 'info');
          } else {
            await window.CABSSA_API.updateMember(id, { status: 'Active' });
            window.CABSSA_TOAST.show(`Member ${name} reactivated.`, 'success');
          }
          await this.renderMembersTable();
        } catch (err) {
          window.CABSSA_TOAST.show('Error updating member status: ' + err.message, 'error');
        }
      }
    },

    async openProfileDrawer(id) {
      const drawer = document.getElementById('memberProfileDrawer');
      if (!drawer) return;

      drawer.classList.remove('translate-x-full');

      try {
        const member = await window.CABSSA_API.getMemberById(id);
        activeMemberInDrawer = member;

        document.getElementById('profileDrawerName').textContent = member.full_name;
        document.getElementById('profileDrawerMemberId').textContent = member.member_id;
        document.getElementById('profileDrawerRole').textContent = member.designation;
        document.getElementById('profileDrawerEmail').textContent = member.email;
        document.getElementById('profileDrawerPhone').textContent = member.contact_number;
        document.getElementById('profileDrawerPRN').textContent = member.prn_number;
        document.getElementById('profileDrawerRoll').textContent = member.roll_number;
        document.getElementById('profileDrawerYearDiv').textContent = `${member.academic_year} · Division ${member.division}`;
        document.getElementById('profileDrawerDomain').textContent = member.domain_name || 'General';
        document.getElementById('profileDrawerVehicle').textContent = member.personal_vehicle ? 'Yes, personal transport available' : 'No';
        document.getElementById('profileDrawerDOB').textContent = member.dob || 'Not specified';
        document.getElementById('profileDrawerDOJ').textContent = member.date_of_joining;
        document.getElementById('profileDrawerStatus').textContent = member.status;
        document.getElementById('profileDrawerAttendanceCount').textContent = `${member.attendance_count || 0} Events Verified`;
        document.getElementById('profileDrawerTasksCount').textContent = `${member.completed_tasks || 0}/${member.total_tasks || 0} Tasks Done`;

        const avatar = document.getElementById('profileDrawerAvatar');
        if (avatar) {
          avatar.src = member.profile_photo_url || 'logo.png';
        }
      } catch (err) {
        window.CABSSA_TOAST.show('Failed to fetch detailed profile: ' + err.message, 'error');
        this.closeProfileDrawer();
      }
    },

    closeProfileDrawer() {
      const drawer = document.getElementById('memberProfileDrawer');
      if (drawer) drawer.classList.add('translate-x-full');
      activeMemberInDrawer = null;
    },

    openCsvImportModal() {
      if (!window.CABSSA_AUTH.requireAdmin()) return;
      const modal = document.getElementById('csvImportModal');
      const preview = document.getElementById('csvImportPreview');
      if (preview) preview.innerHTML = '';
      if (modal) modal.classList.remove('hidden');
    },

    closeCsvImportModal() {
      const modal = document.getElementById('csvImportModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleCsvImportSubmit() {
      const textarea = document.getElementById('csvImportTextarea');
      const errorBox = document.getElementById('csvImportErrorBox');
      const submitBtn = document.getElementById('csvImportSubmitBtn');

      if (!textarea || !textarea.value.trim()) {
        if (errorBox) {
          errorBox.textContent = 'Please paste CSV content or upload a file.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validating and importing to PostgreSQL...';
      }

      try {
        const res = await window.CABSSA_API.importMembersCSV(textarea.value);
        if (res.errors && res.errors.length > 0) {
          window.CABSSA_TOAST.show(`Imported ${res.importedCount} members with ${res.errors.length} skipped rows.`, 'warning');
        } else {
          window.CABSSA_TOAST.show(`Successfully imported ${res.importedCount} committee members!`, 'success');
        }

        this.closeCsvImportModal();
        await this.renderMembersTable();
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message;
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Import Valid Members';
        }
      }
    },

    exportCsv() {
      window.location.href = window.CABSSA_API.getMemberExportCSVUrl();
      window.CABSSA_TOAST.show('Downloading CABSSA committee member directory CSV...', 'info');
    }
  };

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

    MembersModule.handleDrawerPermanentDelete = async function() {
    if (!activeMemberInDrawer) return;
    if (!window.CABSSA_AUTH.requireAdmin()) return;

    const member = activeMemberInDrawer;
    if (confirm(`CAUTION: Are you sure you want to PERMANENTLY DELETE '${member.full_name}' from PostgreSQL database?\n\nThis action cannot be undone.`)) {
      try {
        await window.CABSSA_API.deleteMember(member.id, true);
        window.CABSSA_TOAST.show(`Member '${member.full_name}' was permanently deleted.`, 'info');
        this.closeProfileDrawer();
        await this.renderMembersTable();
      } catch (err) {
        window.CABSSA_TOAST.show('Delete failed: ' + err.message, 'error');
      }
    }
  };

  window.CABSSA_MEMBERS = MembersModule;
})();
