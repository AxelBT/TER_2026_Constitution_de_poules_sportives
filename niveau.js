import { traiterCSV, generer_poules } from './calcul-poules.js';

let selection   = null;


document.addEventListener('DOMContentLoaded', () => {

    /* ====================================================
       CONFIG — lecture URL (compatible file://)
       ==================================================== */
    const params = new URLSearchParams(window.location.search);
    const config = {
        categorie: params.get('categorie') || 'senior',
        niveaux: parseInt(params.get('niveaux')) || 1,
        genre: params.get('genre') || 'masculin',
        niveauActuel: parseInt(params.get('niveauActuel')) || 1,
    };

    /* ====================================================
       PALETTE COULEURS POULES
       ==================================================== */
    const PALETTE = [
        '#0abbef', '#2563eb', '#dc2626', '#d97706', '#7c3aed',
        '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
    ];

    /* ====================================================
       TOASTS
       ==================================================== */
    const toastContainer = document.getElementById('toast-container');

    const ICONS = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warn:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    };

    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = (ICONS[type] || '') + '<span>' + msg + '</span>';
        toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    /* ====================================================
       STEPPER
       ==================================================== */
    function renderStepper() {
        const stepper = document.getElementById('stepper');
        const etapes = [
            { label: 'Config', step: 0 },
            ...Array.from({ length: config.niveaux }, (_, i) => ({
                label: `Niveau ${i + 1}`,
                step: i + 1,
            })),
            { label: 'Récap', step: config.niveaux + 1 },
        ];

        const courant = config.niveauActuel;

        stepper.innerHTML = etapes.map((e, i) => {
            const classe = i === courant ? 'active' : (i < courant ? 'completed' : '');
            const num = i < courant ? '' : `<span>${i + 1}</span>`;
            const conn = i < etapes.length - 1
                ? `<li class="ts-connector${i < courant ? ' filled' : ''}"></li>`
                : '';
            return `<li class="ts-item ${classe}">
                        <span class="ts-dot">${num}</span>
                        <span class="ts-label">${e.label}</span>
                    </li>${conn}`;
        }).join('');
    }

    /* ====================================================
       TITRE & NAVIGATION
       ==================================================== */
    function updateTitre() {
        document.getElementById('titre-niveau').textContent = `${config.categorie}-${config.genre}-${config.niveauActuel}`.toUpperCase();
        document.getElementById('badge-niveau').textContent = `Niveau ${config.niveauActuel} / ${config.niveaux}`;
    }

    function buildURL(niveauActuel) {
        return 'niveau.html?' + new URLSearchParams({
            categorie: config.categorie,
            niveaux: config.niveaux,
            genre: config.genre,
            niveauActuel,
        }).toString();
    }

    

    /* ====================================================
       LEAFLET
       ==================================================== */
    const map = L.map('map').setView([46.6033, 1.8883], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18,
    }).addTo(map);

    let markers = [];

    function clearMarkers() {
        markers.forEach(m => m.remove());
        markers = [];
    }

    const btnPrev     = document.getElementById('btn-prev');
    const btnNext     = document.getElementById('btn-next');
    const btnsGenerer = document.getElementsByClassName('btn-generate');
    const fileInput   = document.getElementById('file_csv_niveau');
    const fileLabel   = document.getElementById('file-label');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileLabel.innerText = "Fichier prêt : " + e.target.files[0].name;
            }
        });
    }

    if (config.niveauActuel === 1) {
        btnPrev.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Configuration`;
    }

    btnPrev.addEventListener('click', () => {
        if (config.niveauActuel > 1) {
            window.location.href = buildURL(config.niveauActuel - 1);
        } else {
            window.location.href = 'poule.html';
        }
    });

    if (config.niveauActuel === config.niveaux) {
        btnNext.innerHTML = `Récapitulatif
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
        btnNext.style.background = 'linear-gradient(135deg, #6d28d9, #7c3aed)';
        btnNext.style.boxShadow = '0 2px 4px rgba(109,40,217,.2), 0 8px 20px rgba(109,40,217,.16)';
    }

    btnNext.addEventListener('click', () => {
        if (config.niveauActuel < config.niveaux) {
            window.location.href = buildURL(config.niveauActuel + 1);
        } else {
            window.location.href = 'récapitulatif.html?' + new URLSearchParams({
                categorie: config.categorie,
                niveaux: config.niveaux,
                genre: config.genre,
            }).toString();
        }
    });

    for (const btn of btnsGenerer) {
        btn.addEventListener('click', () => {
            const fileInput = document.getElementById('file_csv_niveau');
            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = function (e) {
                const contenu = e.target.result;
                const equipes = traiterCSV(contenu);
                localStorage.setItem("equipes", JSON.stringify(equipes));
                const nb_poules = parseInt(document.getElementById('nb_poules').value);
                const nb_max    = parseInt(document.getElementById('nb_max_equipes').value);
                const poules    = generer_poules(equipes, nb_poules, nb_max);
                afficherCarte(equipes);
                afficherPoules(poules);
                localStorage.setItem(`poules_niveau${config.niveauActuel}`, JSON.stringify(poules));
                toast(`${equipes.length} équipes réparties en ${poules.length} poules.`, 'success');
            };
            reader.readAsText(file);
        });
    }

    function afficherCarte(equipes) {
        clearMarkers();
        const overlay = document.getElementById('map-overlay');

        if (!equipes || !equipes.length) {
            overlay.classList.remove('hidden');
            return;
        }
        overlay.classList.add('hidden');

        const bounds = [];
        equipes.forEach(c => {
            const lat = parseFloat(c.latitude);
            const lng = parseFloat(c.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const m = L.circleMarker([lng, lat], {
                radius: 9,
                fillColor: '#888780',
                color: '#fff',
                weight: 2.5,
                opacity: 1,
                fillOpacity: 0.6,
            });
            m.bindPopup(`<strong>${c.nom}</strong><br><span style="color:#888"> Club ${c.id_club}</span>`);
            m.addTo(map);
            m.clubId = c.id_club;
            markers.push(m);
            bounds.push([lng, lat]);
        });

        if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
    }

    /* ====================================================
       HIGHLIGHT POULE SUR LA CARTE
       ==================================================== */
    highlightPoule._actif = null;

    function highlightPoule(pouleIndex, poules) {
        // Reclic sur la même poule → reset
        if (highlightPoule._actif === pouleIndex) {
            highlightPoule._actif = null;
            resetMarkers();
            document.querySelectorAll('.pool-card').forEach(c => c.classList.remove('pool-card--active'));
            return;
        }

        highlightPoule._actif = pouleIndex;
        const poule    = poules[pouleIndex];
        const couleur  = PALETTE[pouleIndex % PALETTE.length];
        const idsPoule = new Set(poule.equipes.map(e => e.id_club));

        markers.forEach(m => {
            if (idsPoule.has(m.clubId)) {
                m.setStyle({ fillColor: couleur, fillOpacity: 0.95, radius: 11, color: '#fff', weight: 2.5 });
                debugger;
                m.bindPopup(`<strong>${poule.equipes.find((e) => e.id_club =m.clubId ).nom}</strong><br><span style="color:#888"> Club ${m.clubId}</span>`);
                m.bringToFront();
            } else {
                m.setStyle({ fillColor: '#888780', fillOpacity: 0.2, radius: 7, color: '#fff', weight: 1.5 });
            }
        });

        document.querySelectorAll('.pool-card').forEach((card, i) => {
            card.classList.toggle('pool-card--active', i === pouleIndex);
        });

        // Recentre sur les équipes de la poule sélectionnée
        const pBounds = markers
            .filter(m => idsPoule.has(m.clubId))
            .map(m => m.getLatLng());
        if (pBounds.length) {
            map.fitBounds(pBounds.map(ll => [ll.lat, ll.lng]), { padding: [60, 60], maxZoom: 10 });
        }
    }

    function resetMarkers() {
        markers.forEach(m => {
            m.setStyle({ fillColor: '#888780', fillOpacity: 0.6, radius: 9, color: '#fff', weight: 2.5 });
        });
    }

    /* ====================================================
       MODE ÉDITION — SWAP D'ÉQUIPES
       ==================================================== */
    let modeEdition = false;

    function setModeEdition(actif, poules) {
        modeEdition = actif;
        selection   = null;

        const btn     = document.getElementById('btn-switch');
        const badge   = document.getElementById('badge-edit');
        const hint    = document.getElementById('edit-hint');
        const overlay = document.getElementById('edit-overlay');

        btn.classList.toggle('active', actif);
        btn.textContent = actif ? '✕ Terminer la modification' : 'Modifier les poules';
        badge.classList.toggle('visible', actif);
        overlay.classList.toggle('visible', actif);
        hint.textContent = actif ? 'Cliquez sur deux équipes pour les échanger.' : '';

        document.querySelectorAll('.pool-team-row').forEach(el => {
            el.classList.toggle('clickable', actif);
            el.classList.remove('selected');
        });

        // En entrant en mode édition, reset le highlight carte
        if (actif) {
            highlightPoule._actif = null;
            resetMarkers();
            document.querySelectorAll('.pool-card').forEach(c => c.classList.remove('pool-card--active'));
            attacherListeners(poules);
        }
    }

    function attacherListeners(poules) {
    document.querySelectorAll('.pool-team-row.clickable').forEach(el => {

        el.addEventListener('click', (e) => {
            e.stopPropagation();

            const pi  = Number(el.dataset.pouleIndex);
            const eid = el.dataset.equipeId;

            // Sécurité DOM
            if (isNaN(pi) || !eid) return;

            // 1ère sélection
            if (!selection) {
                selection = { pi, eid, el };
                el.classList.add('selected');

                const hint = document.getElementById('edit-hint');
                if (hint) {
                    hint.textContent = "Maintenant cliquez sur l'équipe à échanger.";
                }
                return;
            }

            // Même équipe → désélection
            if (selection.eid === eid) {
                selection.el.classList.remove('selected');
                selection = null;

                const hint = document.getElementById('edit-hint');
                if (hint) {
                    hint.textContent = 'Cliquez sur deux équipes pour les échanger.';
                }
                return;
            }

            // Capture locale pour éviter NULL dans setTimeout
            const sel = selection;

            el.classList.add('selected');

            setTimeout(() => {
                if (!sel) return;

                const pA = poules[sel.pi];
                const pB = poules[pi];

                if (!pA || !pB) return;

                const iA = pA.equipes.findIndex(e => e.id === sel.eid);
                const iB = pB.equipes.findIndex(e => e.id === eid);

                if (iA === -1 || iB === -1) return;

                [pA.equipes[iA], pB.equipes[iB]] =
                [pB.equipes[iB], pA.equipes[iA]];

                selection = null;
                afficherPoules(poules);

                const hint = document.getElementById('edit-hint');
                if (hint) {
                    hint.textContent = '✓ Échange effectué.';
                    setTimeout(() => {
                        hint.textContent = 'Cliquez sur deux équipes pour les échanger.';
                    }, 250);
                }

            }, 120);
        });
    });
}

    /* ====================================================
       GRILLE DE POULES
       ==================================================== */
    function afficherPoules(poules) {
        const grid       = document.getElementById('pools-grid');
        const meta       = document.getElementById('pools-meta');
        const btnEchange = document.getElementById('conteneur-btn-echange');

        // Reset highlight à chaque re-rendu (ex : après un swap)
        highlightPoule._actif = null;

        if (!poules.length) {
            meta.textContent = '';
            grid.innerHTML = `
            <div class="pools-empty">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                </svg>
                <p>Les poules apparaîtront ici après génération.</p>
            </div>`;
            return;
        }

        const totalEq = poules.reduce((s, p) => s + p.equipes.length, 0);
        meta.textContent = `${totalEq} équipes · ${poules.length} poules`;

        // Créer le bouton une seule fois
        if (btnEchange && !document.getElementById('btn-switch')) {
            btnEchange.innerHTML = `<button id="btn-switch" class="btn-switch-style">Modifier les poules</button>`;
            document.getElementById('btn-switch').addEventListener('click', () => {
                setModeEdition(!modeEdition, poules);
            });
        }

        grid.innerHTML = poules.map((poule, pi) => {
            const lettre  = poule.nom || String.fromCharCode(65 + pi);
            const couleur = PALETTE[pi % PALETTE.length];

            const lignes = poule.equipes.map(e => `
                <div class="pool-team-row${modeEdition ? ' clickable' : ''}"
                     data-poule-index="${pi}"
                     data-equipe-id="${e.id}">
                    <span class="pool-team-dot" style="background:${couleur}"></span>
                    <span>${e.nom}</span>
                    <span class="pool-team-club">${e.distance_totale}</span>
                </div>
            `).join('');

            return `
            <div class="pool-card" data-poule-index="${pi}">
                <div class="pool-card-head">
                    <span class="pool-dot" style="background:${couleur}"></span>
                    Poule ${lettre}
                    <span style="font-weight:500;color:var(--clr-surface-400);margin-left:2px">
                        (${poule.distance_moyenne})
                    </span>
                </div>
                ${lignes}
            </div>`;
        }).join('');

        // Listeners clic sur les cards pour highlight carte (hors mode édition)
        document.querySelectorAll('.pool-card').forEach((card, i) => {
            card.addEventListener('click', () => {
                if (modeEdition) return;
                highlightPoule(i, poules);
            });
        });

        // Listeners mode édition si actif
        if (modeEdition) attacherListeners(poules);
    }

    /* ====================================================
       BOUTONS GÉNÉRER
       ==================================================== */
    function onGenerer(mode) {
        const clubs = JSON.parse(localStorage.getItem("clubs"));
        afficherCarte(clubs);
        afficherPoules([]);
        toast(`${clubs.length} clubs affichés (mode : ${mode === 'niveau' ? 'par niveau' : 'par distance'}).`, 'info');
    }

    document.getElementById('btn-generer-niveau').addEventListener('click', () => onGenerer('niveau'));
    document.getElementById('btn-generer-dis').addEventListener('click', () => onGenerer('distance'));

    /* ====================================================
       INIT
       ==================================================== */
    updateTitre();
    renderStepper();
    setTimeout(() => map.invalidateSize(), 100);
});