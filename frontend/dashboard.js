// dashboard.js — CampusLoop Student & Admin Dashboard Logic

(function () {
    const API = window.location.origin;
    let currentUser = null;
    let allComplaints = [];
    let allLFItems = [];
    let currentAdminFilter = 'ALL';
    let currentLFFilter = 'ALL';
    let currentSearchTerm = '';
    let currentCategoryFilter = '';

    // -- Fetch current user --------------------------------------------------
    fetch(API + '/api/me', { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('Not authenticated');
            return res.json();
        })
        .then(data => {
            currentUser = data.user;
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('dashMain').style.display = 'block';
            document.getElementById('userArea').style.display = 'flex';

            setupUserInterface();
            loadStats();
            loadComplaints();
            loadLostFound();
        })
        .catch((err) => {
            console.warn('Authentication failed, redirecting to login:', err);
            window.location.href = 'login.html';
        });

    // -- Setup UI according to role (Student vs Admin) -----------------------
    function setupUserInterface() {
        const isAdmin = currentUser.role === 'admin';
        const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

        // Topbar
        document.getElementById('topName').textContent = currentUser.name;
        const avatarEl = document.getElementById('topAvatar');
        if (avatarEl) avatarEl.textContent = initial;

        const badge = document.getElementById('roleBadge');
        badge.textContent = currentUser.role.toUpperCase();
        badge.className = 'role-badge ' + currentUser.role;

        const taglineEl = document.getElementById('topbarTagline');
        if (taglineEl) {
            taglineEl.textContent = isAdmin ? 'Admin Control Hub • SIES GST' : 'Student Portal • SIES GST';
        }

        // Hero banner
        const welcomeHeading = document.getElementById('welcomeHeading');
        const heroSubtitle = document.getElementById('heroRoleSubtitle');
        const heroDesc = document.getElementById('heroDescription');

        if (isAdmin) {
            welcomeHeading.textContent = `Admin Console: ${currentUser.name}`;
            if (heroSubtitle) heroSubtitle.textContent = 'SIES GST Facilities & Maintenance Control';
            if (heroDesc) {
                heroDesc.textContent =
                    'Review real-time student civic reports, update resolution progress, inspect verified photo proof, and oversee campus facilities.';
            }
        } else {
            welcomeHeading.textContent = `Welcome back, ${firstName}! 👋`;
            if (heroSubtitle) heroSubtitle.textContent = 'SIES GST Student Maintenance Hub';
            if (heroDesc) {
                heroDesc.textContent =
                    'Track civic issues across campus wings, submit verified maintenance requests with live photo proof, and browse lost belongings.';
            }
        }

        // Profile summary pills
        const infoDept = document.getElementById('infoDept');
        if (infoDept) infoDept.textContent = currentUser.department || 'General';
        const infoYear = document.getElementById('infoYear');
        if (infoYear) infoYear.textContent = currentUser.year || '-';

        // Trust score
        const trustEl = document.getElementById('infoTrust');
        if (trustEl) {
            const score = currentUser.trust_score !== undefined ? currentUser.trust_score : 100;
            trustEl.textContent = `⭐ ${score}/100 Trust`;
            if (score < 40) {
                trustEl.style.background = '#FEE2E2';
                trustEl.style.color = '#B91C1C';
                trustEl.style.borderColor = '#FCA5A5';
            } else if (score < 70) {
                trustEl.style.background = '#FEF3C7';
                trustEl.style.color = '#B45309';
                trustEl.style.borderColor = '#FDE68A';
            }
        }

        // Role-based visibility
        const studentActions = document.getElementById('studentQuickActionsWrap');
        const adminToolbar = document.getElementById('adminToolbar');
        const topNavReport = document.getElementById('topNavReport');
        const btnReport = document.getElementById('btnReport');
        const btnReportLF = document.getElementById('btnReportLostFound');
        const adminBtnReportLF = document.getElementById('adminBtnReportLF');

        if (isAdmin) {
            if (studentActions) studentActions.style.display = 'none';
            if (adminToolbar) adminToolbar.style.display = 'flex';
            if (topNavReport) topNavReport.style.display = 'inline-flex';
            if (btnReport) btnReport.style.display = 'none';
            if (btnReportLF) btnReportLF.style.display = 'inline-block';
            if (adminBtnReportLF) adminBtnReportLF.style.display = 'inline-flex';
        } else {
            if (studentActions) studentActions.style.display = 'block';
            if (adminToolbar) adminToolbar.style.display = 'none';
            if (topNavReport) topNavReport.style.display = 'inline-flex';
            if (btnReport) btnReport.style.display = 'flex';
            if (btnReportLF) btnReportLF.style.display = 'inline-block';
            if (adminBtnReportLF) adminBtnReportLF.style.display = 'none';
        }

        // Make sure Reports section is visible by default
        document.getElementById('reportsSection').style.display = 'block';
        document.getElementById('lostFoundSection').style.display = 'none';
    }

    // -- Logout --------------------------------------------------------------
    document.getElementById('btnLogout').addEventListener('click', () => {
        fetch(API + '/api/logout', { method: 'POST', credentials: 'include' })
            .then(() => { window.location.href = 'login.html'; })
            .catch(() => { window.location.href = 'login.html'; });
    });

    // -- Live Stats ----------------------------------------------------------
    function loadStats() {
        fetch(API + '/api/stats', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                const totalEl = document.getElementById('statTotal');
                const pendingEl = document.getElementById('statPending');
                const fixedEl = document.getElementById('statFixed');

                if (totalEl) totalEl.textContent = data.total || 0;
                if (pendingEl) pendingEl.textContent = data.pending || 0;
                if (fixedEl) fixedEl.textContent = data.fixed || 0;
            })
            .catch(err => console.error('Failed to load stats:', err));
    }

    // Interactive clicking on KPI Stat Cards
    const cardStatTotal = document.getElementById('cardStatTotal');
    if (cardStatTotal) {
        cardStatTotal.addEventListener('click', () => {
            switchToReportsSection();
            setAdminFilter('ALL');
        });
    }

    const cardStatPending = document.getElementById('cardStatPending');
    if (cardStatPending) {
        cardStatPending.addEventListener('click', () => {
            switchToReportsSection();
            setAdminFilter('PENDING');
        });
    }

    const cardStatFixed = document.getElementById('cardStatFixed');
    if (cardStatFixed) {
        cardStatFixed.addEventListener('click', () => {
            switchToReportsSection();
            setAdminFilter('RESOLVED');
        });
    }

    // Modal scroll & lock helpers
    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('active');
        const modalContent = modalEl.querySelector('.modal');
        if (modalContent) modalContent.scrollTop = 0;
        modalEl.scrollTop = 0;
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('active');
        if (!document.querySelector('.modal-overlay.active, .lightbox-modal.active')) {
            document.body.style.overflow = '';
        }
    }

    // -- View switching helpers ----------------------------------------------
    function switchToReportsSection() {
        const repSec = document.getElementById('reportsSection');
        const lfSec = document.getElementById('lostFoundSection');
        if (repSec) repSec.style.display = 'block';
        if (lfSec) lfSec.style.display = 'none';
    }

    function switchToLostFoundSection() {
        const repSec = document.getElementById('reportsSection');
        const lfSec = document.getElementById('lostFoundSection');
        if (repSec) repSec.style.display = 'none';
        if (lfSec) lfSec.style.display = 'block';
        loadLostFound();
    }

    // Quick Actions Click Listeners
    const btnViewReports = document.getElementById('btnViewReports');
    if (btnViewReports) {
        btnViewReports.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            switchToReportsSection();
            setAdminFilter('ALL');
            const reportsSection = document.getElementById('reportsSection');
            if (reportsSection) {
                reportsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    const topNavLF = document.getElementById('topNavLF');
    if (topNavLF) {
        topNavLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            switchToLostFoundSection();
            const lfSec = document.getElementById('lostFoundSection');
            if (lfSec) {
                lfSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    const btnLFAction = document.getElementById('btnLostFoundAction');
    if (btnLFAction) {
        btnLFAction.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openLostFoundForm();
        });
    }

    const btnViewLF = document.getElementById('btnViewLostFound');
    if (btnViewLF) {
        btnViewLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            switchToLostFoundSection();
        });
    }

    const btnRefreshFeed = document.getElementById('btnRefreshFeed');
    if (btnRefreshFeed) {
        btnRefreshFeed.addEventListener('click', () => {
            loadStats();
            loadComplaints();
            loadLostFound();
        });
    }

    // -- Complaints Fetching & Filtering -------------------------------------
    function loadComplaints() {
        fetch(API + '/api/complaints', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                allComplaints = data.complaints || [];
                updateAdminFilterCounts();
                filterAndRenderComplaints();
            })
            .catch(err => {
                console.error('Error loading complaints:', err);
            });
    }

    function updateAdminFilterCounts() {
        const countAll = allComplaints.length;
        const countPending = allComplaints.filter(c => c.status === 'SUBMITTED' || c.status === 'REOPENED').length;
        const countInProgress = allComplaints.filter(c => c.status === 'VERIFIED' || c.status === 'IN_PROGRESS').length;
        const countResolved = allComplaints.filter(c => c.status === 'RESOLVED').length;
        const countRemoved = allComplaints.filter(c => c.status === 'REMOVED').length;

        const elAll = document.getElementById('countAll');
        const elPending = document.getElementById('countPending');
        const elInProgress = document.getElementById('countInProgress');
        const elResolved = document.getElementById('countResolved');
        const elRemoved = document.getElementById('countRemoved');
        const elLF = document.getElementById('countLF');

        if (elAll) elAll.textContent = countAll;
        if (elPending) elPending.textContent = countPending;
        if (elInProgress) elInProgress.textContent = countInProgress;
        if (elResolved) elResolved.textContent = countResolved;
        if (elRemoved) elRemoved.textContent = countRemoved;
        if (elLF) elLF.textContent = allLFItems.length;
    }

    function setAdminFilter(filterKey) {
        currentAdminFilter = filterKey;

        // Update active class on filter pill buttons
        const pills = document.querySelectorAll('#adminFilterPills .filter-pill-btn');
        pills.forEach(pill => {
            pill.classList.toggle('active', pill.dataset.filter === filterKey);
        });

        if (filterKey === 'LOST_FOUND') {
            switchToLostFoundSection();
        } else {
            switchToReportsSection();
            filterAndRenderComplaints();
        }
    }

    // Admin filter pill listeners
    const adminFilterPills = document.getElementById('adminFilterPills');
    if (adminFilterPills) {
        adminFilterPills.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-pill-btn');
            if (!btn) return;
            const filterKey = btn.dataset.filter;
            if (filterKey) setAdminFilter(filterKey);
        });
    }

    // Real-time search filter
    const feedSearchInput = document.getElementById('feedSearchInput');
    if (feedSearchInput) {
        feedSearchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.trim().toLowerCase();
            filterAndRenderComplaints();
        });
    }

    // Category dropdown filter
    const feedCategorySelect = document.getElementById('feedCategorySelect');
    if (feedCategorySelect) {
        feedCategorySelect.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            filterAndRenderComplaints();
        });
    }

    function filterAndRenderComplaints() {
        let filtered = allComplaints.slice();

        // 1. Status Filter
        if (currentAdminFilter === 'PENDING') {
            filtered = filtered.filter(c => c.status === 'SUBMITTED' || c.status === 'REOPENED');
        } else if (currentAdminFilter === 'IN_PROGRESS') {
            filtered = filtered.filter(c => c.status === 'VERIFIED' || c.status === 'IN_PROGRESS');
        } else if (currentAdminFilter === 'RESOLVED') {
            filtered = filtered.filter(c => c.status === 'RESOLVED');
        } else if (currentAdminFilter === 'REMOVED') {
            filtered = filtered.filter(c => c.status === 'REMOVED');
        }

        // 2. Category Filter
        if (currentCategoryFilter) {
            filtered = filtered.filter(c => (c.category || '').toLowerCase() === currentCategoryFilter.toLowerCase());
        }

        // 3. Search Filter
        if (currentSearchTerm) {
            filtered = filtered.filter(c => {
                const desc = (c.description || '').toLowerCase();
                const loc = (c.location_area || '').toLowerCase();
                const cat = (c.category || '').toLowerCase();
                const obj = (c.affected_object || '').toLowerCase();
                const reporter = (c.reporter_name || '').toLowerCase();
                const email = (c.reporter_email || '').toLowerCase();
                return desc.includes(currentSearchTerm) ||
                    loc.includes(currentSearchTerm) ||
                    cat.includes(currentSearchTerm) ||
                    obj.includes(currentSearchTerm) ||
                    reporter.includes(currentSearchTerm) ||
                    email.includes(currentSearchTerm);
            });
        }

        renderComplaintsList(filtered);
    }

    function getCategoryEmoji(cat) {
        const c = (cat || '').toLowerCase();
        if (c.includes('garbage')) return '🗑️';
        if (c.includes('water')) return '💧';
        if (c.includes('electric')) return '⚡';
        if (c.includes('infra') || c.includes('broken')) return '🔨';
        if (c.includes('road') || c.includes('pothole')) return '🚧';
        if (c.includes('washroom')) return '🚻';
        if (c.includes('clean')) return '🧹';
        if (c.includes('safe')) return '🛡️';
        return '📌';
    }

    function renderComplaintsList(complaints) {
        const container = document.getElementById('complaintsList');
        const countDisplay = document.getElementById('reportsDisplayCount');
        if (countDisplay) {
            countDisplay.textContent = `Showing ${complaints.length} of ${allComplaints.length} reports`;
        }

        if (!complaints.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No reports found</h3>
                    <p>There are no complaints matching your selected filter or search term.</p>
                </div>`;
            return;
        }

        const isAdmin = currentUser.role === 'admin';

        container.innerHTML = complaints.map(c => {
            const isOwner = currentUser.id === c.user_id;
            const date = new Date(c.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Category & Severity badge
            const catEmoji = getCategoryEmoji(c.category);
            const severityClass = 'badge-severity-' + (c.severity ? c.severity.toLowerCase() : 'medium');
            const severityLabel = c.severity || 'Medium';

            // Status Badge
            const statusKey = (c.status || 'SUBMITTED').toLowerCase();
            let statusLabel = c.status;
            let statusIcon = '⏳';
            if (c.status === 'RESOLVED') { statusIcon = '✅'; statusLabel = 'RESOLVED'; }
            else if (c.status === 'VERIFIED') { statusIcon = '🔍'; statusLabel = 'VERIFIED'; }
            else if (c.status === 'IN_PROGRESS') { statusIcon = '🔨'; statusLabel = 'IN PROGRESS'; }
            else if (c.status === 'REOPENED') { statusIcon = '⚠️'; statusLabel = 'REOPENED'; }
            else if (c.status === 'REMOVED') { statusIcon = '🚫'; statusLabel = 'REMOVED'; }

            // Reporter info
            let reporterHtml = '';
            if (isAdmin && c.reporter_name) {
                const trust = c.trust_score !== undefined ? c.trust_score : 100;
                let trustBadgeClass = 'rgba(16, 185, 129, 0.15); color: #047857;';
                if (trust < 50) trustBadgeClass = 'rgba(239, 68, 68, 0.15); color: #DC2626;';
                reporterHtml = `
                    <div class="complaint-reporter-line">
                        <span>Reported by: <strong>${escHtml(c.reporter_name)}</strong> (${escHtml(c.reporter_email)})</span>
                        <span class="badge-pill" style="background:${trustBadgeClass}">Trust: ${trust}/100</span>
                        ${c.reporter_dept ? `<span class="badge-pill" style="background:#F3F4F6; color:var(--ink-soft);">${escHtml(c.reporter_dept)}</span>` : ''}
                    </div>`;
            }

            // Location coordinates pill
            let coordsHtml = '';
            if (c.lat && c.lng) {
                const latNum = Number(c.lat).toFixed(4);
                const lngNum = Number(c.lng).toFixed(4);
                coordsHtml = `
                    <div class="meta-field-item">
                        <span>📍</span>
                        <span><strong>Coords:</strong> ${latNum}, ${lngNum}</span>
                    </div>`;
            }

            // Image Frame
            let imgHtml = '';
            if (c.image_data) {
                imgHtml = `
                    <div class="complaint-image-frame">
                        <img class="complaint-img-modern" src="${c.image_data}" alt="Complaint photo" title="Click to enlarge" data-lightbox="${c.image_data}">
                    </div>`;
            }

            // Verified Fix Section
            let fixHtml = '';
            if (c.status === 'RESOLVED') {
                const fixDate = c.resolved_at ? new Date(c.resolved_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : '';

                fixHtml = `
                    <div class="verified-fix-box">
                        <div class="verified-fix-header">
                            <span>🛡️ Verified Resolution Proof</span>
                            ${fixDate ? `<span style="font-size:11px; font-weight:600; color:var(--ink-soft); margin-left:auto;">Resolved: ${fixDate}</span>` : ''}
                        </div>
                        ${c.fix_note ? `<p class="verified-fix-note"><strong>Admin Remarks:</strong> ${escHtml(c.fix_note)}</p>` : ''}
                        ${c.fix_image_data ? `<img class="verified-fix-img" src="${c.fix_image_data}" alt="Proof of fix" title="Click to view resolution proof" data-lightbox="${c.fix_image_data}">` : ''}
                    </div>`;
            }

            // Action Buttons
            let actionsHtml = '';
            if (isAdmin) {
                let statusSelectHtml = '';
                if (c.status !== 'RESOLVED' && c.status !== 'REMOVED') {
                    statusSelectHtml = `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:12px; font-weight:700; color:var(--ink-soft);">Status:</span>
                            <select class="status-advance-select" data-id="${c.id}">
                                <option value="SUBMITTED" ${c.status === 'SUBMITTED' ? 'selected' : ''}>Submitted</option>
                                <option value="VERIFIED" ${c.status === 'VERIFIED' ? 'selected' : ''}>Verified</option>
                                <option value="IN_PROGRESS" ${c.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                            </select>
                        </div>`;
                }

                let resolveBtn = '';
                if (c.status !== 'RESOLVED' && c.status !== 'REMOVED') {
                    resolveBtn = `<button class="btn-action-primary btn-resolve" data-id="${c.id}" type="button">✅ Resolve with Proof</button>`;
                }

                let removeBtn = '';
                if (c.status !== 'REMOVED') {
                    removeBtn = `<button class="btn-action-danger btn-remove" data-id="${c.id}" type="button">🚫 Remove / Spam</button>`;
                }

                actionsHtml = `
                    <div class="card-actions-bar">
                        ${statusSelectHtml}
                        ${resolveBtn}
                        ${removeBtn}
                    </div>`;
            } else if (isOwner && c.status === 'RESOLVED') {
                actionsHtml = `
                    <div class="card-actions-bar">
                        <button class="btn-action-outline btn-reopen" data-id="${c.id}" type="button">
                            ⚠️ Issue Still Exists? Reopen
                        </button>
                    </div>`;
            }

            return `
                <div class="complaint-card-modern" id="complaint-${c.id}">
                    <div class="complaint-card-top">
                        <div class="complaint-tags-cluster">
                            <span class="badge-pill badge-category">${catEmoji} ${escHtml(c.category || 'General')}</span>
                            <span class="badge-pill ${severityClass}">⚡ ${severityLabel}</span>
                            <span class="badge-pill" style="background:#F3F4F6; color:var(--ink-soft);">📅 ${date}</span>
                        </div>
                        <span class="badge-pill badge-status ${statusKey}">${statusIcon} ${statusLabel}</span>
                    </div>

                    ${reporterHtml}

                    <div class="complaint-meta-grid">
                        <div class="meta-field-item">
                            <span>📍</span>
                            <span><strong>Location:</strong> ${escHtml(c.location_area || 'Not specified')}</span>
                        </div>
                        <div class="meta-field-item">
                            <span>🎯</span>
                            <span><strong>Affected Object:</strong> ${escHtml(c.affected_object || 'N/A')}</span>
                        </div>
                        ${coordsHtml}
                    </div>

                    <div class="complaint-desc-box">
                        ${escHtml(c.description)}
                    </div>

                    ${imgHtml}
                    ${fixHtml}
                    ${actionsHtml}
                </div>`;
        }).join('');

        // Attach action handlers
        container.querySelectorAll('.btn-resolve').forEach(btn => {
            btn.addEventListener('click', () => openResolveModal(btn.dataset.id));
        });

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => openRemoveModal(btn.dataset.id));
        });

        container.querySelectorAll('.btn-reopen').forEach(btn => {
            btn.addEventListener('click', () => handleReopen(btn.dataset.id));
        });

        container.querySelectorAll('.status-advance-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const complaintId = sel.dataset.id;
                const newStatus = e.target.value;
                updateComplaintStatus(complaintId, newStatus);
            });
        });

        // Lightbox handlers
        container.querySelectorAll('[data-lightbox]').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.dataset.lightbox));
        });
    }

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Admin status update API call
    function updateComplaintStatus(id, status) {
        fetch(API + `/api/complaints/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status })
        })
            .then(async r => {
                const res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to update status');
                return res;
            })
            .then(() => {
                loadStats();
                loadComplaints();
            })
            .catch(err => alert(err.message));
    }

    // Student reopen handler
    function handleReopen(id) {
        if (!confirm("Are you sure this maintenance problem still exists? This will notify administration.")) return;
        fetch(API + '/api/complaints/' + id + '/still_exists', {
            method: 'POST',
            credentials: 'include'
        })
            .then(r => r.json())
            .then(res => {
                if (res.error) alert(res.error);
                else {
                    alert("Issue has been reopened for administrator review.");
                    loadStats();
                    loadComplaints();
                }
            })
            .catch(err => alert('Failed to reopen: ' + err.message));
    }

    // Lightbox Modal
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');

    function openLightbox(src) {
        if (!lightboxModal || !lightboxImg || !src) return;
        lightboxImg.src = src;
        lightboxModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', () => {
            lightboxModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // ── Client-side Image Compression Utility ───────────────────────────────
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve) => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }

    async function compressImageFile(file, options = {}) {
        if (!file) {
            return { dataUrl: null, originalSize: 0, compressedSize: 0, width: 0, height: 0 };
        }
        const rawDataUrl = await readFileAsDataUrl(file);
        if (!rawDataUrl) {
            return { dataUrl: null, originalSize: file.size, compressedSize: file.size, width: 0, height: 0 };
        }

        try {
            const maxDimension = options.maxDimension || 1600;
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = rawDataUrl;
            });

            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            if (!width || !height) {
                return { dataUrl: rawDataUrl, originalSize: file.size, compressedSize: file.size, width: 0, height: 0 };
            }

            if (width > maxDimension || height > maxDimension) {
                const scale = Math.min(maxDimension / width, maxDimension / height);
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return { dataUrl: rawDataUrl, originalSize: file.size, compressedSize: file.size, width: width, height: height };
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
            const estBytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

            return {
                dataUrl: dataUrl,
                originalSize: file.size,
                compressedSize: estBytes,
                width: width,
                height: height
            };
        } catch (err) {
            return {
                dataUrl: rawDataUrl,
                originalSize: file.size,
                compressedSize: file.size,
                width: 0,
                height: 0
            };
        }
    }

    // -- Report a Problem Modal ----------------------------------------------
    const reportModal = document.getElementById('reportModal');
    const reportImage = document.getElementById('reportImage');
    const reportPreview = document.getElementById('reportPreview');
    let reportImageData = null;

    function openReportForm() {
        openModal(reportModal);
        reportImageData = null;
        if (reportPreview) {
            reportPreview.style.display = 'none';
            reportPreview.src = '';
        }

        const repInfo = document.getElementById('reportCompressionInfo');
        if (repInfo) {
            repInfo.style.display = 'none';
            repInfo.textContent = '';
        }

        document.getElementById('reportCategory').value = '';
        document.getElementById('reportLocation').value = '';
        document.getElementById('reportDesc').value = '';
        document.getElementById('reportObject').value = '';
        document.getElementById('reportSeverity').value = 'Medium';
        document.getElementById('reportLat').value = '';
        document.getElementById('reportLng').value = '';

        const repGpsBtn = document.getElementById('btnReportCurrentLocation');
        if (repGpsBtn) repGpsBtn.textContent = '📍 Use My Current Location';
        const repMapBtn = document.getElementById('btnOpenMap');
        if (repMapBtn) repMapBtn.textContent = '🗺️ Tap to set location on map';
        const repWarn = document.getElementById('reportLocationWarning');
        if (repWarn) repWarn.style.display = 'none';
        if (reportImage) reportImage.value = '';
    }

    const btnReport = document.getElementById('btnReport');
    if (btnReport) {
        btnReport.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openReportForm();
        });
    }

    const topNavReport = document.getElementById('topNavReport');
    if (topNavReport) {
        topNavReport.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openReportForm();
        });
    }

    const adminBtnReportProblem = document.getElementById('adminBtnReportProblem');
    if (adminBtnReportProblem) {
        adminBtnReportProblem.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openReportForm();
        });
    }

    document.getElementById('btnCancelReport').addEventListener('click', () => {
        closeModal(reportModal);
    });

    // GPS Current Location
    const btnReportCurrentLocation = document.getElementById('btnReportCurrentLocation');
    if (btnReportCurrentLocation) {
        btnReportCurrentLocation.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }
            btnReportCurrentLocation.textContent = '📍 Fetching location...';
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    document.getElementById('reportLat').value = lat.toFixed(6);
                    document.getElementById('reportLng').value = lng.toFixed(6);
                    btnReportCurrentLocation.textContent = `📍 GPS Set (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                    const mapBtn = document.getElementById('btnOpenMap');
                    if (mapBtn) mapBtn.textContent = `🗺️ View / Adjust on Map`;

                    const inCampus = isInsideCampus(lat, lng);
                    const warnEl = document.getElementById('reportLocationWarning');
                    if (warnEl) warnEl.style.display = inCampus ? 'none' : 'block';
                },
                (err) => {
                    btnReportCurrentLocation.textContent = '📍 Use My Current Location';
                    alert("Could not get location: " + err.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    if (reportImage) {
        reportImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const infoEl = document.getElementById('reportCompressionInfo');
            if (infoEl) {
                infoEl.style.display = 'inline-flex';
                infoEl.textContent = '⚡ Processing photo...';
            }

            const result = await compressImageFile(file, { maxDimension: 1600 });
            reportImageData = result.dataUrl;

            if (reportPreview && result.dataUrl) {
                reportPreview.src = result.dataUrl;
                reportPreview.style.display = 'block';
            }

            if (infoEl) {
                if (result.compressedSize && result.originalSize && result.compressedSize < result.originalSize) {
                    const savedPercent = Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100));
                    infoEl.innerHTML = `<span>⚡</span> <span>Compressed: <strong>${formatBytes(result.compressedSize)}</strong> (was ${formatBytes(result.originalSize)}, ${savedPercent}% saved)</span>`;
                } else {
                    infoEl.innerHTML = `<span>⚡</span> <span>Photo ready • ${formatBytes(file.size)}</span>`;
                }
                infoEl.style.display = 'inline-flex';
            }
        });
    }

    document.getElementById('btnSubmitReport').addEventListener('click', async () => {
        const category = document.getElementById('reportCategory').value;
        const location_area = document.getElementById('reportLocation').value.trim();
        const description = document.getElementById('reportDesc').value.trim();
        const affected_object = document.getElementById('reportObject').value.trim();
        const severity = document.getElementById('reportSeverity').value;
        const lat = document.getElementById('reportLat').value || null;
        const lng = document.getElementById('reportLng').value || null;

        if (!category) {
            alert('Please select a category for this problem.');
            return;
        }
        if (!location_area) {
            alert('Please specify the campus location (area / landmark).');
            return;
        }
        if (!description) {
            alert('Please provide a description of the problem.');
            return;
        }
        if (!affected_object) {
            alert('Please specify the affected object or area.');
            return;
        }

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        let finalImageData = reportImageData;
        if (!finalImageData && reportImage && reportImage.files && reportImage.files[0]) {
            const compRes = await compressImageFile(reportImage.files[0], { maxDimension: 1600 });
            finalImageData = compRes.dataUrl;
            reportImageData = compRes.dataUrl;
        }

        if (!finalImageData) {
            btn.disabled = false;
            btn.textContent = 'Submit Report';
            alert('Please upload a photo proof for this problem.');
            return;
        }

        const payload = {
            category,
            location_area,
            description,
            affected_object,
            severity,
            lat,
            lng,
            image_data: finalImageData
        };

        fetch(API + '/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        })
            .then(async r => {
                const res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to submit report');
                return res;
            })
            .then(() => {
                closeModal(reportModal);
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                alert('Complaint submitted successfully! Administration has been notified.');
                loadStats();
                switchToReportsSection();
                loadComplaints();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                alert('Submission failed: ' + e.message);
            });
    });

    // -- Map Modal & Leaflet -------------------------------------------------
    const mapModal = document.getElementById('mapModal');

    const SIES_CAMPUS_POLYGON = [
        [19.0447, 73.0227], // NW: AG Patil Marg / Shivaji Chowk
        [19.0449, 73.0244], // NE: Near MBA campus
        [19.0423, 73.0244], // SE: Parking & sports edge
        [19.0421, 73.0227]  // SW: Adi Shankaracharya Marg
    ];

    const SIES_CAMPUS_CENTER = [19.0435, 73.0235];

    const SIES_CAMPUS_LANDMARKS = [
        { name: "SIES GST Engg Campus", icon: "🎓", coords: [19.0435, 73.0231] },
        { name: "MBA Campus", icon: "💼", coords: [19.0445, 73.0242] },
        { name: "Commerce & Arts Wing", icon: "📚", coords: [19.0427, 73.0234] },
        { name: "Ayyappa Temple", icon: "🛕", coords: [19.0435, 73.0239] }
    ];

    function isInsideCampus(lat, lng) {
        if (lat === null || lat === undefined || isNaN(lat) || String(lat).trim() === '') {
            return true;
        }
        const x = Number(lat);
        const y = Number(lng);
        const poly = SIES_CAMPUS_POLYGON;
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0], yi = poly[i][1];
            const xj = poly[j][0], yj = poly[j][1];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    if (window.L && L.Icon && L.Icon.Default) {
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
    }

    let leafletMap = null;
    let leafletMarker = null;
    let currentMapTarget = 'report';
    let selectedLat = null;
    let selectedLng = null;

    function initOrUpdateMap(lat, lng) {
        const mapEl = document.getElementById('map');
        if (!mapEl || !window.L) return;

        const hasValidCoords = (lat !== null && lat !== undefined && !isNaN(lat) && String(lat).trim() !== '');
        const initialLat = hasValidCoords ? Number(lat) : SIES_CAMPUS_CENTER[0];
        const initialLng = hasValidCoords ? Number(lng) : SIES_CAMPUS_CENTER[1];
        const centerPos = [initialLat, initialLng];

        selectedLat = initialLat;
        selectedLng = initialLng;

        if (!leafletMap) {
            leafletMap = L.map('map', {
                center: centerPos,
                zoom: 17,
                minZoom: 16,
                maxZoom: 19,
                zoomControl: true,
                maxBounds: [
                    [19.0390, 73.0180],
                    [19.0480, 73.0290]
                ],
                maxBoundsViscosity: 0.8
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            }).addTo(leafletMap);

            L.polygon(SIES_CAMPUS_POLYGON, {
                color: '#047857',
                weight: 2.5,
                opacity: 0.95,
                fillColor: '#10B981',
                fillOpacity: 0.14,
                dashArray: '5, 5'
            }).addTo(leafletMap);

            SIES_CAMPUS_LANDMARKS.forEach(lm => {
                const landmarkIcon = L.divIcon({
                    className: 'campus-landmark-badge',
                    html: `<div class="campus-landmark-pill"><span class="lm-emoji">${lm.icon}</span><span class="lm-text">${lm.name}</span></div>`,
                    iconSize: null,
                    iconAnchor: [12, 12]
                });
                const lmMarker = L.marker(lm.coords, { icon: landmarkIcon, interactive: true }).addTo(leafletMap);
                lmMarker.on('click', () => {
                    if (leafletMarker) {
                        leafletMarker.setLatLng(lm.coords);
                        updatePinLocation(lm.coords[0], lm.coords[1]);
                    }
                });
            });

            leafletMarker = L.marker(centerPos, { draggable: true, zIndexOffset: 1000 }).addTo(leafletMap);

            leafletMarker.on('drag', function (e) {
                const pos = e.target.getLatLng();
                updatePinLocation(pos.lat, pos.lng);
            });

            leafletMarker.on('dragend', function (e) {
                const pos = e.target.getLatLng();
                updatePinLocation(pos.lat, pos.lng);
            });

            leafletMap.on('click', function (e) {
                leafletMarker.setLatLng(e.latlng);
                updatePinLocation(e.latlng.lat, e.latlng.lng);
            });
        } else {
            leafletMarker.setLatLng(centerPos);
            leafletMap.setView(centerPos, 17);
        }

        updatePinLocation(selectedLat, selectedLng);

        setTimeout(() => {
            if (leafletMap) {
                leafletMap.invalidateSize();
                if (!hasValidCoords) {
                    leafletMap.fitBounds(SIES_CAMPUS_POLYGON, { padding: [20, 20] });
                }
            }
        }, 150);
    }

    function updatePinLocation(lat, lng) {
        selectedLat = Number(lat);
        selectedLng = Number(lng);

        const coordsSpan = document.getElementById('mapModalCoords');
        if (coordsSpan) {
            coordsSpan.textContent = `Pin: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
        }

        const warnEl = document.getElementById('mapBoundaryWarning');
        if (warnEl) {
            warnEl.style.display = isInsideCampus(selectedLat, selectedLng) ? 'none' : 'block';
        }
    }

    function openMapModal(target) {
        currentMapTarget = target;
        const latInput = document.getElementById(target === 'report' ? 'reportLat' : 'lfLat');
        const lngInput = document.getElementById(target === 'report' ? 'reportLng' : 'lfLng');

        const curLat = latInput && latInput.value ? parseFloat(latInput.value) : null;
        const curLng = lngInput && lngInput.value ? parseFloat(lngInput.value) : null;

        openModal(mapModal);
        initOrUpdateMap(curLat, curLng);
    }

    document.getElementById('btnOpenMap').addEventListener('click', (e) => {
        e.preventDefault();
        openMapModal('report');
    });

    document.getElementById('btnCancelMap').addEventListener('click', () => {
        closeModal(mapModal);
    });

    document.getElementById('btnSaveMap').addEventListener('click', () => {
        if (selectedLat !== null && selectedLng !== null) {
            const isReport = (currentMapTarget === 'report');
            const latInputId = isReport ? 'reportLat' : 'lfLat';
            const lngInputId = isReport ? 'reportLng' : 'lfLng';
            const openBtnId = isReport ? 'btnOpenMap' : 'btnLFOpenMap';
            const warningId = isReport ? 'reportLocationWarning' : 'lfLocationWarning';

            document.getElementById(latInputId).value = selectedLat.toFixed(6);
            document.getElementById(lngInputId).value = selectedLng.toFixed(6);

            const openBtn = document.getElementById(openBtnId);
            if (openBtn) {
                openBtn.textContent = `📍 Location Set (${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)})`;
            }

            const warnEl = document.getElementById(warningId);
            if (warnEl) {
                warnEl.style.display = isInsideCampus(selectedLat, selectedLng) ? 'none' : 'block';
            }
        }
        closeModal(mapModal);
    });

    const btnModalGPS = document.getElementById('btnModalGPS');
    if (btnModalGPS) {
        btnModalGPS.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }
            btnModalGPS.textContent = '📍 Fetching GPS...';
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    btnModalGPS.textContent = '📍 Use My GPS Location';
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    if (leafletMap && leafletMarker) {
                        leafletMarker.setLatLng([lat, lng]);
                        leafletMap.setView([lat, lng], 18);
                        updatePinLocation(lat, lng);
                    }
                },
                (err) => {
                    btnModalGPS.textContent = '📍 Use My GPS Location';
                    alert("Could not get GPS location: " + err.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    // -- Resolve Modal (Admin) -----------------------------------------------
    const resolveModal = document.getElementById('resolveModal');
    const fixImage = document.getElementById('fixImage');
    const fixPreview = document.getElementById('fixPreview');
    let fixImageData = null;

    function openResolveModal(complaintId) {
        document.getElementById('resolveComplaintId').value = complaintId;
        fixImageData = null;
        if (fixPreview) {
            fixPreview.style.display = 'none';
            fixPreview.src = '';
        }
        const fixInfo = document.getElementById('fixCompressionInfo');
        if (fixInfo) {
            fixInfo.style.display = 'none';
            fixInfo.textContent = '';
        }
        if (fixImage) fixImage.value = '';
        document.getElementById('fixNote').value = '';
        openModal(resolveModal);
    }

    document.getElementById('btnCancelResolve').addEventListener('click', () => {
        closeModal(resolveModal);
    });

    if (fixImage) {
        fixImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const infoEl = document.getElementById('fixCompressionInfo');
            if (infoEl) {
                infoEl.style.display = 'inline-flex';
                infoEl.textContent = '⚡ Processing proof photo...';
            }

            const result = await compressImageFile(file, { maxDimension: 1600 });
            fixImageData = result.dataUrl;

            if (fixPreview && result.dataUrl) {
                fixPreview.src = result.dataUrl;
                fixPreview.style.display = 'block';
            }

            if (infoEl) {
                if (result.compressedSize && result.originalSize && result.compressedSize < result.originalSize) {
                    const savedPercent = Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100));
                    infoEl.innerHTML = `<span>⚡</span> <span>Compressed: <strong>${formatBytes(result.compressedSize)}</strong> (was ${formatBytes(result.originalSize)}, ${savedPercent}% saved)</span>`;
                } else {
                    infoEl.innerHTML = `<span>⚡</span> <span>Photo ready • ${formatBytes(file.size)}</span>`;
                }
                infoEl.style.display = 'inline-flex';
            }
        });
    }

    document.getElementById('btnSubmitResolve').addEventListener('click', async () => {
        const id = document.getElementById('resolveComplaintId').value;
        const note = document.getElementById('fixNote').value.trim();

        const btn = document.getElementById('btnSubmitResolve');
        btn.disabled = true;
        btn.textContent = 'Uploading & Resolving...';

        let finalImageData = fixImageData;
        if (!finalImageData && fixImage && fixImage.files && fixImage.files[0]) {
            const compRes = await compressImageFile(fixImage.files[0], { maxDimension: 1600 });
            finalImageData = compRes.dataUrl;
            fixImageData = compRes.dataUrl;
        }

        if (!finalImageData) {
            btn.disabled = false;
            btn.textContent = 'Upload & Resolve';
            alert('You must upload a photo of the completed task as proof of resolution.');
            return;
        }

        fetch(API + '/api/complaints/' + id + '/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fix_image_data: finalImageData, fix_note: note }),
        })
            .then(async r => {
                const res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to resolve complaint');
                return res;
            })
            .then(() => {
                closeModal(resolveModal);
                btn.disabled = false;
                btn.textContent = 'Upload & Resolve';
                alert('Complaint resolved and verified successfully!');
                loadStats();
                loadComplaints();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Upload & Resolve';
                alert(e.message || 'Failed to resolve. Please try again.');
            });
    });

    // -- Remove Modal (Admin) ------------------------------------------------
    const removeModal = document.getElementById('removeModal');

    function openRemoveModal(complaintId) {
        document.getElementById('removeComplaintId').value = complaintId;
        document.getElementById('removeReason').value = 'Duplicate';
        document.getElementById('removePenalty').checked = false;
        openModal(removeModal);
    }

    document.getElementById('btnCancelRemove').addEventListener('click', () => {
        closeModal(removeModal);
    });

    document.getElementById('btnSubmitRemove').addEventListener('click', () => {
        const id = document.getElementById('removeComplaintId').value;
        const reason = document.getElementById('removeReason').value;
        const apply_penalty = document.getElementById('removePenalty').checked;

        const btn = document.getElementById('btnSubmitRemove');
        btn.disabled = true;
        btn.textContent = 'Removing...';

        fetch(API + '/api/complaints/' + id + '/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason, apply_penalty }),
        })
            .then(async r => {
                const res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to remove');
                return res;
            })
            .then(() => {
                closeModal(removeModal);
                btn.disabled = false;
                btn.textContent = 'Remove Request';
                loadStats();
                loadComplaints();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Remove Request';
                alert(e.message || 'Failed to remove.');
            });
    });

    // -- Lost & Found --------------------------------------------------------
    function loadLostFound() {
        fetch(API + '/api/lost_found', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                allLFItems = data.items || [];
                const countLF = document.getElementById('countLF');
                if (countLF) countLF.textContent = allLFItems.length;
                renderLostFoundList();
            })
            .catch(err => console.error('Failed to load Lost & Found items:', err));
    }

    function renderLostFoundList() {
        const container = document.getElementById('lostFoundList');
        if (!container) return;

        let items = allLFItems.slice();
        if (currentLFFilter === 'Lost') {
            items = items.filter(it => it.type === 'Lost');
        } else if (currentLFFilter === 'Found') {
            items = items.filter(it => it.type === 'Found');
        }

        if (!items.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>No items found</h3>
                    <p>There are no reported items matching this filter.</p>
                </div>`;
            return;
        }

        container.innerHTML = items.map(item => {
            const date = new Date(item.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            const isLost = item.type === 'Lost';
            const badgeBg = isLost ? '#FFF3E0' : '#E8F5E9';
            const badgeColor = isLost ? '#C2410C' : '#047857';
            const badgeBorder = isLost ? '#FDBA74' : '#6EE7B7';
            const typeIcon = isLost ? '🔴' : '🟢';

            let imgHtml = '';
            if (item.image_data) {
                imgHtml = `
                    <div class="complaint-image-frame">
                        <img class="complaint-img-modern" src="${item.image_data}" alt="Item photo" title="Click to enlarge" data-lightbox="${item.image_data}">
                    </div>`;
            }

            let coordsHtml = '';
            if (item.lat && item.lng) {
                coordsHtml = `
                    <div class="meta-field-item">
                        <span>📍</span>
                        <span><strong>Coords:</strong> ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}</span>
                    </div>`;
            }

            return `
                <div class="complaint-card-modern">
                    <div class="complaint-card-top">
                        <div class="complaint-tags-cluster">
                            <span class="badge-pill" style="background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder};">
                                ${typeIcon} ${item.type} Item
                            </span>
                            <span class="badge-pill" style="background:#F3F4F6; color:var(--ink-soft);">
                                📅 Reported: ${date}
                            </span>
                        </div>
                    </div>

                    <div class="complaint-reporter-line">
                        <span>Reported by: <strong>${escHtml(item.reporter_name)}</strong> (${escHtml(item.reporter_email)})</span>
                    </div>

                    <div class="complaint-meta-grid">
                        <div class="meta-field-item">
                            <span>🏷️</span>
                            <span><strong>Item:</strong> ${escHtml(item.item_name)}</span>
                        </div>
                        <div class="meta-field-item">
                            <span>📍</span>
                            <span><strong>Location:</strong> ${escHtml(item.location)}</span>
                        </div>
                        <div class="meta-field-item">
                            <span>🗓️</span>
                            <span><strong>Incident Date:</strong> ${escHtml(item.item_date)}</span>
                        </div>
                        ${coordsHtml}
                    </div>

                    <div class="complaint-desc-box">
                        <strong>Description:</strong> ${escHtml(item.description)}
                    </div>

                    ${imgHtml}
                </div>`;
        }).join('');

        container.querySelectorAll('[data-lightbox]').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.dataset.lightbox));
        });
    }

    // LF Filter Pills
    const lfFilterPills = document.getElementById('lfFilterPills');
    if (lfFilterPills) {
        lfFilterPills.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-pill-btn');
            if (!btn) return;
            currentLFFilter = btn.dataset.lfFilter || 'ALL';
            lfFilterPills.querySelectorAll('.filter-pill-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            renderLostFoundList();
        });
    }

    // Lost & Found Modal Logic
    const lfModal = document.getElementById('lfModal');
    const lfImage = document.getElementById('lfImage');
    const lfPreview = document.getElementById('lfPreview');
    let lfImageData = null;

    function openLostFoundForm() {
        openModal(lfModal);
        lfImageData = null;
        if (lfPreview) {
            lfPreview.style.display = 'none';
            lfPreview.src = '';
        }

        const lfInfo = document.getElementById('lfCompressionInfo');
        if (lfInfo) {
            lfInfo.style.display = 'none';
            lfInfo.textContent = '';
        }

        document.getElementById('lfStep1').style.display = 'block';
        document.getElementById('lfStep2').style.display = 'none';

        document.getElementById('lfType').value = '';
        document.getElementById('lfName').value = '';
        document.getElementById('lfLocation').value = '';
        document.getElementById('lfDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('lfDesc').value = '';
        document.getElementById('lfLat').value = '';
        document.getElementById('lfLng').value = '';

        const warnEl = document.getElementById('lfLocationWarning');
        if (warnEl) warnEl.style.display = 'none';
        const lfGpsBtn = document.getElementById('btnLFCurrentLocation');
        if (lfGpsBtn) lfGpsBtn.textContent = '📍 Use My Current Location';
        const lfMapBtn = document.getElementById('btnLFOpenMap');
        if (lfMapBtn) lfMapBtn.textContent = '🗺️ Tap to set location on map';
        if (lfImage) lfImage.value = '';
    }

    const btnReportLF = document.getElementById('btnReportLostFound');
    if (btnReportLF) {
        btnReportLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openLostFoundForm();
        });
    }

    const adminBtnReportLF = document.getElementById('adminBtnReportLF');
    if (adminBtnReportLF) {
        adminBtnReportLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openLostFoundForm();
        });
    }

    document.getElementById('btnSelectLost').addEventListener('click', () => {
        document.getElementById('lfType').value = 'Lost';
        document.getElementById('lfStep2Title').textContent = 'Reporting a Lost Item';
        document.getElementById('lfStep1').style.display = 'none';
        document.getElementById('lfStep2').style.display = 'block';
    });

    document.getElementById('btnSelectFound').addEventListener('click', () => {
        document.getElementById('lfType').value = 'Found';
        document.getElementById('lfStep2Title').textContent = 'Reporting a Found Item';
        document.getElementById('lfStep1').style.display = 'none';
        document.getElementById('lfStep2').style.display = 'block';
    });

    document.getElementById('btnCancelLFStep1').addEventListener('click', () => {
        closeModal(lfModal);
    });

    const btnCancelLFStep2 = document.getElementById('btnCancelLFStep2');
    if (btnCancelLFStep2) {
        btnCancelLFStep2.addEventListener('click', () => {
            closeModal(lfModal);
        });
    }

    document.getElementById('btnBackLF').addEventListener('click', () => {
        document.getElementById('lfStep2').style.display = 'none';
        document.getElementById('lfStep1').style.display = 'block';
    });

    if (lfImage) {
        lfImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const infoEl = document.getElementById('lfCompressionInfo');
            if (infoEl) {
                infoEl.style.display = 'inline-flex';
                infoEl.textContent = '⚡ Processing photo...';
            }

            const result = await compressImageFile(file, { maxDimension: 1600 });
            lfImageData = result.dataUrl;

            if (lfPreview && result.dataUrl) {
                lfPreview.src = result.dataUrl;
                lfPreview.style.display = 'block';
            }

            if (infoEl) {
                if (result.compressedSize && result.originalSize && result.compressedSize < result.originalSize) {
                    const savedPercent = Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100));
                    infoEl.innerHTML = `<span>⚡</span> <span>Compressed: <strong>${formatBytes(result.compressedSize)}</strong> (was ${formatBytes(result.originalSize)}, ${savedPercent}% saved)</span>`;
                } else {
                    infoEl.innerHTML = `<span>⚡</span> <span>Photo ready • ${formatBytes(file.size)}</span>`;
                }
                infoEl.style.display = 'inline-flex';
            }
        });
    }

    document.getElementById('btnLFCurrentLocation').addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        const btn = document.getElementById('btnLFCurrentLocation');
        btn.textContent = '📍 Getting location...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                document.getElementById('lfLat').value = lat.toFixed(6);
                document.getElementById('lfLng').value = lng.toFixed(6);
                btn.textContent = `📍 GPS Set (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                const lfMapBtn = document.getElementById('btnLFOpenMap');
                if (lfMapBtn) {
                    lfMapBtn.textContent = `🗺️ View / Adjust on Map`;
                }

                const inCampus = isInsideCampus(lat, lng);
                const warnEl = document.getElementById('lfLocationWarning');
                if (warnEl) warnEl.style.display = inCampus ? 'none' : 'block';
            },
            (err) => {
                btn.textContent = '📍 Use My Current Location';
                alert("Could not get location: " + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    const btnLFOpenMap = document.getElementById('btnLFOpenMap');
    if (btnLFOpenMap) {
        btnLFOpenMap.addEventListener('click', (e) => {
            e.preventDefault();
            openMapModal('lf');
        });
    }

    document.getElementById('btnSubmitLF').addEventListener('click', async () => {
        let type = document.getElementById('lfType').value;
        if (!type) {
            type = 'Lost';
        }
        const item_name = document.getElementById('lfName').value.trim();
        const location = document.getElementById('lfLocation').value.trim();
        let item_date = document.getElementById('lfDate').value;
        if (!item_date) {
            item_date = new Date().toISOString().split('T')[0];
        }
        const description = document.getElementById('lfDesc').value.trim();
        const lat = document.getElementById('lfLat').value || null;
        const lng = document.getElementById('lfLng').value || null;

        if (!item_name) {
            alert('Please specify the item name / title.');
            return;
        }
        if (!location) {
            alert('Please specify the location.');
            return;
        }
        if (!description) {
            alert('Please provide a description with identifying details.');
            return;
        }

        const btn = document.getElementById('btnSubmitLF');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        let finalImageData = lfImageData;
        if (!finalImageData && lfImage && lfImage.files && lfImage.files[0]) {
            const compRes = await compressImageFile(lfImage.files[0], { maxDimension: 1600 });
            finalImageData = compRes.dataUrl;
            lfImageData = compRes.dataUrl;
        }

        const payload = {
            type,
            item_name,
            location,
            item_date,
            description,
            image_data: finalImageData || null,
            lat,
            lng
        };

        fetch(API + '/api/lost_found', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        })
            .then(async r => {
                const res = await r.json();
                if (!r.ok) throw new Error(res.error || 'Failed to submit item');
                return res;
            })
            .then(() => {
                closeModal(lfModal);
                btn.disabled = false;
                btn.textContent = 'Submit Item';
                alert('Item posted successfully to Lost & Found directory!');
                loadLostFound();
                switchToLostFoundSection();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Submit Item';
                alert('Submission failed: ' + e.message);
            });
    });

    // Close modals on backdrop click
    [reportModal, resolveModal, removeModal, mapModal, lfModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active, .lightbox-modal.active');
            if (activeModal) closeModal(activeModal);
        }
    });

})();
