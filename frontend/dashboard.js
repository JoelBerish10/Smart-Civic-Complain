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
                const topReport = document.getElementById('topNavReport');
                if (topReport) topReport.style.display = 'none';
            } else {
                document.getElementById('btnReport').style.display = 'flex';
                const topReport = document.getElementById('topNavReport');
                if (topReport) topReport.style.display = 'inline-flex';
            }
            document.getElementById('btnReportLostFound').style.display = 'block';

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

    // Modal scroll & lock helpers (avoids unwanted scrolling or background jumps)
    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('active');
        const modalContent = modalEl.querySelector('.modal');
        if (modalContent) modalContent.scrollTop = 0;
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('active');
        document.body.style.overflow = '';
    }

    // -- view feeds (in-place without page jumping or scrolling) -------------
    document.getElementById('btnViewReports').addEventListener('click', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const section = document.getElementById('reportsSection');
        if (section.style.display === 'none') {
            section.style.display = 'block';
            document.getElementById('lostFoundSection').style.display = 'none';
            loadComplaints();
        } else {
            section.style.display = 'none';
        }
    });

    const btnViewLF = document.getElementById('btnViewLostFound');
    if (btnViewLF) {
        btnViewLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            const section = document.getElementById('lostFoundSection');
            if (section.style.display === 'none') {
                section.style.display = 'block';
                document.getElementById('reportsSection').style.display = 'none';
                loadLostFound();
            } else {
                section.style.display = 'none';
            }
        });
    }

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

            let coordsHtml = (c.lat && c.lng) ? ` <span style="font-weight:600; color:var(--navy);">(📍 ${Number(c.lat).toFixed(4)}, ${Number(c.lng).toFixed(4)})</span>` : '';

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
                        <strong>Location:</strong> ${escHtml(c.location_area || 'N/A')}${coordsHtml} | 
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

    function openReportForm() {
        openModal(reportModal);
        reportImageData = null;
        reportPreview.style.display = 'none';
        
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
        reportImage.value = '';
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

    document.getElementById('btnCancelReport').addEventListener('click', () => {
        closeModal(reportModal);
    });

    // Report a Problem: GPS current location button
    const btnReportCurrentLocation = document.getElementById('btnReportCurrentLocation');
    if (btnReportCurrentLocation) {
        btnReportCurrentLocation.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }
            btnReportCurrentLocation.textContent = '📍 Getting location...';
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
            lat: document.getElementById('reportLat').value || null,
            lng: document.getElementById('reportLng').value || null,
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
    
    // -- map modal & Leaflet setup -------------------------------------------
    const mapModal = document.getElementById('mapModal');

    // 4-sided quadrilateral campus boundary perimeter (verified with SIES GST records)
    const SIES_CAMPUS_POLYGON = [
        [19.0447, 73.0227], // NW: AG Patil Marg / Shivaji Chowk
        [19.0449, 73.0244], // NE: Near MBA campus / DY border
        [19.0423, 73.0244], // SE: Parking & sports edge
        [19.0421, 73.0227]  // SW: Adi Shankaracharya Marg & Amphitheatre
    ];

    const SIES_CAMPUS_CENTER = [19.0435, 73.0235];

    // Verified campus landmarks
    const SIES_CAMPUS_LANDMARKS = [
        { name: "SIES GST Engineering Campus", icon: "🎓", coords: [19.0435, 73.0231] },
        { name: "MBA Campus", icon: "💼", coords: [19.0445, 73.0242] },
        { name: "Commerce & Arts Campus", icon: "📚", coords: [19.0427, 73.0234] },
        { name: "Ayyappa Temple", icon: "🛕", coords: [19.0435, 73.0239] }
    ];

    // Ray-casting algorithm matching backend is_in_sies_gst
    function isInsideCampus(lat, lng) {
        if (lat === null || lat === undefined || isNaN(lat) || String(lat).trim() === '') {
            return true; // Optional: empty coordinates are allowed
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

    // Configure Leaflet marker icon paths for CDN
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
    let campusPolygonLayer = null;
    let landmarkLayers = [];
    let currentMapTarget = 'report'; // 'report' or 'lf'
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
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            }).addTo(leafletMap);

            // 4-sided quadrilateral campus boundary
            campusPolygonLayer = L.polygon(SIES_CAMPUS_POLYGON, {
                color: '#15803d',
                weight: 2.5,
                opacity: 0.95,
                fillColor: '#22c55e',
                fillOpacity: 0.12,
                dashArray: '5, 5'
            }).addTo(leafletMap);
            campusPolygonLayer.bindTooltip('SIES GST Campus Perimeter', { sticky: true });

            // Campus landmark markers
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
                landmarkLayers.push(lmMarker);
            });

            // Draggable pin marker
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
                openBtn.textContent = `📍 Location Saved (${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)})`;
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
        openModal(resolveModal);
    }

    document.getElementById('btnCancelResolve').addEventListener('click', () => {
        closeModal(resolveModal);
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
                closeModal(resolveModal);
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
                if(!r.ok) throw new Error(res.error);
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

    // -- lost & found --------------------------------------------------------
    function loadLostFound() {
        fetch(API + '/api/lost_found', { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                const container = document.getElementById('lostFoundList');
                if (!data.items || !data.items.length) {
                    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No items reported yet.</p></div>';
                    return;
                }
                container.innerHTML = data.items.map(item => {
                    const date = new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    });
                    const badgeColor = item.type === 'Lost' ? '#E65100' : '#2E7D32';
                    const badgeBg = item.type === 'Lost' ? '#FFF3E0' : '#E8F5E9';
                    let imgHtml = item.image_data ? `<img class="complaint-img" src="${item.image_data}" alt="Item photo">` : '';
                    let coordsHtml = (item.lat && item.lng) ? ` <br><strong>Coordinates:</strong> ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : '';
                    
                    return `
                        <div class="complaint-card">
                            <div class="complaint-header">
                                <div>
                                    <div class="reporter">Reported by <strong>${escHtml(item.reporter_name)}</strong> (${escHtml(item.reporter_email)})</div>
                                    <div class="complaint-date">${date}</div>
                                </div>
                                <span class="status-badge" style="background:${badgeBg}; color:${badgeColor};">${item.type}</span>
                            </div>
                            <div style="font-size: 15px; color: var(--ink); margin-bottom: 8px;">
                                <strong>Item:</strong> ${escHtml(item.item_name)} <br>
                                <strong>Location:</strong> ${escHtml(item.location)} ${coordsHtml} <br>
                                <strong>Date of incident:</strong> ${escHtml(item.item_date)}
                            </div>
                            <div class="complaint-desc">
                                <strong>Description:</strong> ${escHtml(item.description)}
                            </div>
                            ${imgHtml}
                        </div>`;
                }).join('');
            });
    }

    const lfModal = document.getElementById('lfModal');
    const lfImage = document.getElementById('lfImage');
    const lfPreview = document.getElementById('lfPreview');
    let lfImageData = null;

    function openLostFoundForm() {
        openModal(lfModal);
        lfImageData = null;
        lfPreview.style.display = 'none';
        
        document.getElementById('lfStep1').style.display = 'block';
        document.getElementById('lfStep2').style.display = 'none';

        document.getElementById('lfType').value = '';
        document.getElementById('lfName').value = '';
        document.getElementById('lfLocation').value = '';
        document.getElementById('lfDate').value = '';
        document.getElementById('lfDesc').value = '';
        document.getElementById('lfLat').value = '';
        document.getElementById('lfLng').value = '';
        const warnEl = document.getElementById('lfLocationWarning');
        if (warnEl) warnEl.style.display = 'none';
        const lfGpsBtn = document.getElementById('btnLFCurrentLocation');
        if (lfGpsBtn) lfGpsBtn.textContent = '📍 Use My Current Location';
        const lfMapBtn = document.getElementById('btnLFOpenMap');
        if (lfMapBtn) lfMapBtn.textContent = '🗺️ Tap to set location on map';
        lfImage.value = '';
    }

    const btnReportLF = document.getElementById('btnReportLostFound');
    if (btnReportLF) {
        btnReportLF.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openLostFoundForm();
        });
    }

    const btnLFAction = document.getElementById('btnLostFoundAction');
    if (btnLFAction) {
        btnLFAction.addEventListener('click', (e) => {
            if (e && e.preventDefault) e.preventDefault();
            openLostFoundForm();
        });
    }

    const topNavLF = document.getElementById('topNavLF');
    if (topNavLF) {
        topNavLF.addEventListener('click', (e) => {
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

    document.getElementById('btnBackLF').addEventListener('click', () => {
        document.getElementById('lfStep2').style.display = 'none';
        document.getElementById('lfStep1').style.display = 'block';
    });

    lfImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            lfImageData = ev.target.result;
            lfPreview.src = lfImageData;
            lfPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

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

    document.getElementById('btnSubmitLF').addEventListener('click', () => {
        const payload = {
            type: document.getElementById('lfType').value,
            item_name: document.getElementById('lfName').value.trim(),
            location: document.getElementById('lfLocation').value.trim(),
            item_date: document.getElementById('lfDate').value,
            description: document.getElementById('lfDesc').value.trim(),
            image_data: lfImageData,
            lat: document.getElementById('lfLat').value || null,
            lng: document.getElementById('lfLng').value || null
        };

        if (!payload.item_name || !payload.location || !payload.item_date || !payload.description) {
            alert('Please fill all required fields.'); 
            return; 
        }

        const btn = document.getElementById('btnSubmitLF');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch(API + '/api/lost_found', {
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
            closeModal(lfModal);
            btn.disabled = false;
            btn.textContent = 'Submit';
            loadLostFound();
        })
        .catch((e) => {
            btn.disabled = false;
            btn.textContent = 'Submit';
            alert(e.message);
        });
    });

    // close modals on overlay click
    [reportModal, resolveModal, removeModal, mapModal, lfModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

})();
