// dashboard.js — CampusLoop dashboard logic

(function () {
    const API = window.location.origin;
    let currentUser = null;

    // -- fetch current user --------------------------------------------------
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

            // header
            document.getElementById('topName').textContent = currentUser.name;
            const badge = document.getElementById('roleBadge');
            badge.textContent = currentUser.role;
            badge.classList.add(currentUser.role);

            // welcome
            document.getElementById('welcomeHeading').textContent =
                'Welcome back, ' + currentUser.name.split(' ')[0] + '!';

            // profile
            document.getElementById('infoName').textContent = currentUser.name;
            document.getElementById('infoEmail').textContent = currentUser.email;
            document.getElementById('infoDept').textContent = currentUser.department || '-';
            document.getElementById('infoYear').textContent = currentUser.year || '-';

            // role-based UI
            if (currentUser.role === 'admin') {
                // admins don't report, they review
                document.getElementById('btnReport').style.display = 'none';
            } else {
                document.getElementById('btnReport').style.display = 'flex';
            }

            loadStats();
            
            // Automatically load reports when dashboard opens
            const section = document.getElementById('reportsSection');
            section.style.display = 'block';
            loadComplaints();
        })
        .catch(() => {
            window.location.href = 'login.html';
        });

    // -- logout --------------------------------------------------------------
    document.getElementById('btnLogout').addEventListener('click', () => {
        fetch(API + '/api/logout', { method: 'POST', credentials: 'include' })
            .then(() => { window.location.href = 'login.html'; });
    });

    // -- stats ---------------------------------------------------------------
    function loadStats() {
        fetch(API + '/api/stats', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                document.getElementById('statTotal').textContent = data.total;
                document.getElementById('statPending').textContent = data.pending;
                document.getElementById('statFixed').textContent = data.fixed;
            });
    }

    // -- view reports --------------------------------------------------------
    document.getElementById('btnViewReports').addEventListener('click', () => {
        const section = document.getElementById('reportsSection');
        if (section.style.display === 'none') {
            section.style.display = 'block';
            loadComplaints();
            section.scrollIntoView({ behavior: 'smooth' });
        } else {
            section.style.display = 'none';
        }
    });

    function loadComplaints() {
        fetch(API + '/api/complaints', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                renderComplaints(data.complaints);
            });
    }

    function renderComplaints(complaints) {
        const container = document.getElementById('complaintsList');
        if (!complaints.length) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No reports yet.</p></div>';
            return;
        }

        container.innerHTML = complaints.map(c => {
            const isAdmin = currentUser.role === 'admin';
            const date = new Date(c.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            let reporterInfo = '';
            if (c.reporter_name) {
                reporterInfo = '<div class="reporter">Reported by <strong>' + escHtml(c.reporter_name) + '</strong> (' + escHtml(c.reporter_email) + ') &middot; ' + escHtml(c.reporter_dept || '') + '</div>';
            }

            let imgHtml = '';
            if (c.image_data) {
                imgHtml = '<img class="complaint-img" src="' + c.image_data + '" alt="Complaint photo">';
            }

            let fixHtml = '';
            if (c.status === 'fixed') {
                fixHtml = '<div class="complaint-fix"><h4>Problem Fixed</h4>';
                if (c.fix_note) fixHtml += '<p>' + escHtml(c.fix_note) + '</p>';
                if (c.fix_image_data) fixHtml += '<img src="' + c.fix_image_data + '" alt="Fix photo">';
                fixHtml += '</div>';
            }

            let resolveBtn = '';
            if (isAdmin && c.status === 'pending') {
                resolveBtn = '<button class="btn-resolve" data-id="' + c.id + '">Upload completed pic & remove request</button>';
            }

            return '<div class="complaint-card">' +
                '<div class="complaint-header">' +
                '<div>' + reporterInfo + '<div class="complaint-date">' + date + '</div></div>' +
                '<span class="status-badge ' + c.status + '">' + (c.status === 'fixed' ? 'Problem Fixed' : 'Pending') + '</span>' +
                '</div>' +
                '<div class="complaint-desc">' + escHtml(c.description) + '</div>' +
                imgHtml +
                fixHtml +
                resolveBtn +
                '</div>';
        }).join('');

        // attach resolve handlers
        container.querySelectorAll('.btn-resolve').forEach(btn => {
            btn.addEventListener('click', () => openResolveModal(btn.dataset.id));
        });
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // -- report modal --------------------------------------------------------
    const reportModal = document.getElementById('reportModal');
    const reportImage = document.getElementById('reportImage');
    const reportPreview = document.getElementById('reportPreview');
    let reportImageData = null;

    document.getElementById('btnReport').addEventListener('click', () => {
        reportModal.classList.add('active');
        reportImageData = null;
        reportPreview.style.display = 'none';
        document.getElementById('reportDesc').value = '';
        reportImage.value = '';
    });

    document.getElementById('btnCancelReport').addEventListener('click', () => {
        reportModal.classList.remove('active');
    });

    reportImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            reportImageData = ev.target.result;
            reportPreview.src = reportImageData;
            reportPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btnSubmitReport').addEventListener('click', () => {
        const desc = document.getElementById('reportDesc').value.trim();
        if (!desc) { alert('Please add a description.'); return; }

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch(API + '/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ description: desc, image_data: reportImageData }),
        })
            .then(r => r.json())
            .then(() => {
                reportModal.classList.remove('active');
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                loadStats();
                // show reports section with new complaint
                document.getElementById('reportsSection').style.display = 'block';
                loadComplaints();
            })
            .catch(() => {
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                alert('Failed to submit. Please try again.');
            });
    });

    // -- resolve modal (admin) -----------------------------------------------
    const resolveModal = document.getElementById('resolveModal');
    const fixImage = document.getElementById('fixImage');
    const fixPreview = document.getElementById('fixPreview');
    let fixImageData = null;

    function openResolveModal(complaintId) {
        document.getElementById('resolveComplaintId').value = complaintId;
        fixImageData = null;
        fixPreview.style.display = 'none';
        fixImage.value = '';
        document.getElementById('fixNote').value = '';
        resolveModal.classList.add('active');
    }

    document.getElementById('btnCancelResolve').addEventListener('click', () => {
        resolveModal.classList.remove('active');
    });

    fixImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            fixImageData = ev.target.result;
            fixPreview.src = fixImageData;
            fixPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btnSubmitResolve').addEventListener('click', () => {
        if (!fixImageData) { alert('You must upload a fix photo before resolving.'); return; }

        const id = document.getElementById('resolveComplaintId').value;
        const note = document.getElementById('fixNote').value.trim();
        const btn = document.getElementById('btnSubmitResolve');
        btn.disabled = true;
        btn.textContent = 'Resolving...';

        fetch(API + '/api/complaints/' + id + '/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fix_image_data: fixImageData, fix_note: note }),
        })
            .then(r => r.json())
            .then(() => {
                resolveModal.classList.remove('active');
                btn.disabled = false;
                btn.textContent = 'Upload & Remove Request';
                loadStats();
                loadComplaints();
            })
            .catch(() => {
                btn.disabled = false;
                btn.textContent = 'Upload & Remove Request';
                alert('Failed to resolve. Please try again.');
            });
    });

    // close modals on overlay click
    [reportModal, resolveModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

})();
