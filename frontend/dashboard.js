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
                document.getElementById('btnReport').style.display = 'none';
            } else {
                document.getElementById('btnReport').style.display = 'flex';
            }

            loadStats();

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
            const isOwner = currentUser.id === c.user_id;
            const date = new Date(c.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            let reporterInfo = '';
            if (c.reporter_name) {
                let trustStr = c.trust_score !== undefined ? ` (Trust: ${c.trust_score}/100)` : '';
                reporterInfo = `<div class="reporter">Reported by <strong>${escHtml(c.reporter_name)}</strong> (${escHtml(c.reporter_email)})${trustStr} &middot; ${escHtml(c.reporter_dept || '')}</div>`;
            }

            let imgHtml = '';
            if (c.image_data) {
                imgHtml = `<img class="complaint-img" src="${c.image_data}" alt="Complaint photo">`;
            }

            let fixHtml = '';
            if (c.status === 'RESOLVED') {
                fixHtml = '<div class="complaint-fix"><h4>Problem Resolved</h4>';
                if (c.fix_note) fixHtml += '<p>' + escHtml(c.fix_note) + '</p>';
                if (c.fix_image_data) fixHtml += '<img src="' + c.fix_image_data + '" alt="Fix photo">';
                fixHtml += '</div>';
            }

            let actionsHtml = '<div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">';
            if (isAdmin) {
                if (c.status !== 'REMOVED' && c.status !== 'RESOLVED') {
                    actionsHtml += `<button class="btn-resolve" data-id="${c.id}">Resolve</button>`;
                }
                if (c.status !== 'REMOVED') {
                    actionsHtml += `<button class="btn-remove" data-id="${c.id}">Remove</button>`;
                }
            } else if (isOwner) {
                if (c.status === 'SUBMITTED') {
                    // Note: Edit UI could go here
                }
                if (c.status === 'RESOLVED') {
                    actionsHtml += `<button class="btn-reopen" data-id="${c.id}">Issue Still Exists</button>`;
                }
            }
            actionsHtml += '</div>';
            
            let statusBadgeClass = 'pending';
            if(c.status === 'RESOLVED') statusBadgeClass = 'fixed';
            if(c.status === 'REMOVED') statusBadgeClass = 'removed'; // needs styling in css ideally

            return `
                <div class="complaint-card">
                    <div class="complaint-header">
                        <div>
                            ${reporterInfo}
                            <div class="complaint-date">${date}</div>
                        </div>
                        <span class="status-badge ${statusBadgeClass}">${c.status}</span>
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
                        <strong>Category:</strong> ${escHtml(c.category || 'N/A')} | 
                        <strong>Location:</strong> ${escHtml(c.location_area || 'N/A')} | 
                        <strong>Severity:</strong> ${escHtml(c.severity || 'N/A')}
                    </div>
                    <div class="complaint-desc">
                        <strong>Problem:</strong> ${escHtml(c.description)}<br>
                        <strong>Affected Object:</strong> ${escHtml(c.affected_object || 'N/A')}
                    </div>
                    ${imgHtml}
                    ${fixHtml}
                    ${actionsHtml}
                </div>`;
        }).join('');

        // attach resolve handlers
        container.querySelectorAll('.btn-resolve').forEach(btn => {
            btn.addEventListener('click', () => openResolveModal(btn.dataset.id));
        });
        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => openRemoveModal(btn.dataset.id));
        });
        container.querySelectorAll('.btn-reopen').forEach(btn => {
            btn.addEventListener('click', () => handleReopen(btn.dataset.id));
        });
    }

    function escHtml(str) {
        if(!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function handleReopen(id) {
        if(!confirm("Are you sure this issue still exists?")) return;
        fetch(API + '/api/complaints/' + id + '/still_exists', {
            method: 'POST',
            credentials: 'include'
        }).then(r=>r.json()).then(res=>{
            if(res.error) alert(res.error);
            else {
                alert("Issue reopened.");
                loadComplaints();
            }
        });
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
        
        document.getElementById('reportCategory').value = '';
        document.getElementById('reportLocation').value = '';
        document.getElementById('reportDesc').value = '';
        document.getElementById('reportObject').value = '';
        document.getElementById('reportSeverity').value = 'Medium';
        document.getElementById('reportLat').value = '';
        document.getElementById('reportLng').value = '';
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
        const payload = {
            category: document.getElementById('reportCategory').value,
            location_area: document.getElementById('reportLocation').value.trim(),
            description: document.getElementById('reportDesc').value.trim(),
            affected_object: document.getElementById('reportObject').value.trim(),
            severity: document.getElementById('reportSeverity').value,
            lat: document.getElementById('reportLat').value,
            lng: document.getElementById('reportLng').value,
            image_data: reportImageData
        };

        if (!payload.category || !payload.location_area || !payload.description || !payload.affected_object || !payload.image_data) {
            alert('Please fill all required fields and upload an image.'); 
            return; 
        }

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch(API + '/api/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        })
            .then(async r => {
                const res = await r.json();
                if(!r.ok) throw new Error(res.error || 'Failed');
                return res;
            })
            .then(() => {
                reportModal.classList.remove('active');
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                loadStats();
                document.getElementById('reportsSection').style.display = 'block';
                loadComplaints();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Submit Report';
                alert(e.message);
            });
    });
    
    // -- map modal ----------------------------------------------------------
    const mapModal = document.getElementById('mapModal');
    
    document.getElementById('btnOpenMap').addEventListener('click', (e) => {
        e.preventDefault();
        mapModal.classList.add('active');
        // trigger resize for map to load properly if hidden
        setTimeout(() => {
            if(window.google && map && marker) {
                google.maps.event.trigger(map, "resize");
                map.setCenter(marker.getPosition());
            }
        }, 100);
    });
    
    document.getElementById('btnCancelMap').addEventListener('click', () => {
        mapModal.classList.remove('active');
    });
    
    document.getElementById('btnSaveMap').addEventListener('click', () => {
        if(window.google && marker) {
            const pos = marker.getPosition();
            document.getElementById('reportLat').value = pos.lat();
            document.getElementById('reportLng').value = pos.lng();
            document.getElementById('btnOpenMap').textContent = `📍 Location Saved (${pos.lat().toFixed(4)}, ${pos.lng().toFixed(4)})`;
        }
        mapModal.classList.remove('active');
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
            .then(async r => {
                const res = await r.json();
                if(!r.ok) throw new Error(res.error);
                return res;
            })
            .then(() => {
                resolveModal.classList.remove('active');
                btn.disabled = false;
                btn.textContent = 'Upload & Resolve Request';
                loadStats();
                loadComplaints();
            })
            .catch((e) => {
                btn.disabled = false;
                btn.textContent = 'Upload & Resolve Request';
                alert(e.message || 'Failed to resolve. Please try again.');
            });
    });
    
    // -- remove modal (admin) -----------------------------------------------
    const removeModal = document.getElementById('removeModal');
    
    function openRemoveModal(complaintId) {
        document.getElementById('removeComplaintId').value = complaintId;
        document.getElementById('removeReason').value = 'Duplicate';
        document.getElementById('removePenalty').checked = false;
        removeModal.classList.add('active');
    }

    document.getElementById('btnCancelRemove').addEventListener('click', () => {
        removeModal.classList.remove('active');
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
                if(!r.ok) throw new Error(res.error);
                return res;
            })
            .then(() => {
                removeModal.classList.remove('active');
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

    // close modals on overlay click
    [reportModal, resolveModal, removeModal, mapModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

})();
