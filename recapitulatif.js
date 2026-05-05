import { distance } from "./calcul-poules.js";
import { toast } from "./toast.js";
document.addEventListener("DOMContentLoaded", () => {
  const config = JSON.parse(localStorage.getItem("championnatConfig"));
  
  const PALETTE = [
    "#0abbef",
    "#2563eb",
    "#dc2626",
    "#d97706",
    "#7c3aed",
    "#db2777",
    "#0891b2",
    "#65a30d",
    "#ea580c",
    "#4f46e5",
  ];

  function renderStepper() {
    const stepper = document.getElementById("stepper");
    const etapes = [
      { label: "Config", step: 0 },
      ...Array.from({ length: config.niveaux }, (_, i) => ({
        label: `Niveau ${i + 1}`,
        step: i + 1,
      })),
      { label: "Récap", step: config.niveaux + 1 },
    ];

    const courant = config.niveaux + 1; // récap = dernière étape

    stepper.innerHTML = etapes
      .map((e, i) => {
        const classe =
          i === courant ? "active" : i < courant ? "completed" : "";
        const num = i < courant ? "" : `<span>${i + 1}</span>`;
        const conn =
          i < etapes.length - 1
            ? `<li class="ts-connector${i < courant ? " filled" : ""}"></li>`
            : "";
        return `<li class="ts-item ${classe}">
                        <span class="ts-dot">${num}</span>
                        <span class="ts-label">${e.label}</span>
                    </li>${conn}`;
      })
      .join("");
  }

  function chargerToutesLesPoules() {
    const resultat = [];
    //console.log(localStorage);
    for (let n = 1; n <= config.niveaux; n++) {
      const raw = localStorage.getItem(
        `${config.categorie}-${config.genre}-${n}`,
      );
      if (raw) {
        try {
          resultat.push({ niveau: n, poules: JSON.parse(raw) });
        } catch (e) {
          console.warn(`Erreur lecture niveau ${n}`, e);
        }
      }
    }
    return resultat;
  }

  function calculerStatsGlobales(niveauxData) {
    const totalNiveaux = niveauxData.length;
    const totalPoules = niveauxData.reduce((s, n) => s + n.poules.length, 0);
    const totalEquipes = niveauxData.reduce(
      (s, n) => s + n.poules.reduce((ss, p) => ss + p.equipes.length, 0),
      0,
    );
    const distMoyGlobal =
      niveauxData.reduce((s, n) => {
        const moy =
          n.poules.reduce(
            (ss, p) => ss + parseFloat(p.distance_moyenne || 0),
            0,
          ) / (n.poules.length || 1);
        return s + moy;
      }, 0) / (totalNiveaux || 1);

    return { totalNiveaux, totalPoules, totalEquipes, distMoyGlobal };
  }

  function afficherStatsGlobales(stats) {
    document.getElementById("badge-recap").textContent =
      `${stats.totalNiveaux} niveau(x)`;

    document.getElementById("stats-globales").innerHTML = `
            <div class="stat-card">
                <div class="stat-card-label">Niveaux</div>
                <div class="stat-card-value">${stats.totalNiveaux}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Poules</div>
                <div class="stat-card-value">${stats.totalPoules}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Équipes</div>
                <div class="stat-card-value">${stats.totalEquipes}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-label">Dist. moy.</div>
                <div class="stat-card-value">
                    ${stats.distMoyGlobal.toFixed(0)}
                    <span class="stat-card-unit">km</span>
                </div>
            </div>
        `;
  }

  function renderTabs(niveauxData, niveauActif, onSelect) {
    const bar = document.getElementById("tabs-bar");
    bar.innerHTML = niveauxData
      .map(
        ({ niveau }) => `
            <button class="tab-btn ${niveau === niveauActif ? "active" : ""}"
                    data-niveau="${niveau}">
                Niveau ${niveau}
            </button>
        `,
      )
      .join("");

    bar.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        onSelect(parseInt(btn.dataset.niveau));
      });
    });
  }

  

  function afficherNiveau(niveauData) {
    const isModeNiveau = config.mode === "niveau";
    console.log("Affichage du niveau", niveauData.niveau, "Mode:", config.mode);
    const { niveau, poules } = niveauData;
    const toutesLesEquipes = poules.flatMap((p) => p.equipes);
    const totalDistancesIndividuelles = toutesLesEquipes.reduce(
      (s, e) => s + parseFloat(e.distance_totale || 0),
      0,
    );
    const moyenneEquipeGlobale =
      totalDistancesIndividuelles / (toutesLesEquipes.length || 1);
    const nb_max_equipes = Math.max(...poules.map((p) => p.nb_max));
    const cartes = poules
      .map((poule, pi) => {
        const couleur = PALETTE[pi % PALETTE.length];
        const lettre = poule.nom || String.fromCharCode(65 + pi);
        const difficultePoule = poule.equipes.reduce((acc, e) => {
          const statut = (e.statut_niveau || "").toLowerCase();
          if (statut.includes("+") || statut === "montante") return acc - 1;
          if (statut.includes("-") || statut === "descendante") return acc + 1;
          return acc;
        }, 0);
        const lignes = poule.equipes
          .map(
            (e) =>{
            let prefixeHtml = "";
            const statut = (e.statut_niveau || "").toLowerCase();
            if (isModeNiveau) {
              let svgPath = "";
              let couleurStatut = "";
              if (statut.includes("+") || statut === "montante") {
                svgPath = `<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>`;
                couleurStatut = "#16a34a";
              } else if (statut.includes("-") || statut === "descendante") {
                svgPath = `<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>`;
                couleurStatut = "#dc2626";
              } else {
                svgPath = `<line x1="5" y1="12" x2="19" y2="12"/>`;
                couleurStatut = "#9ca3af";
              }
              prefixeHtml = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="${couleurStatut}" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round"
                     style="flex-shrink:0; width:16px; height:16px; min-width:16px; margin: 0 6px 0 2px;">
                  ${svgPath}
                </svg>`;
            } else {
              prefixeHtml = `<span class="pool-team-dot" style="flex-shrink:0; background:${couleur}"></span>`;
            }
              
            return  `
                <div class="pool-team-row">
                    ${prefixeHtml}
                    <span class="pool-team-name">
                        ${e.type === "CTC" ? e.ctc_nom : e.nom_club} — ${e.numero}
                        </span>
                    <span class="pool-team-club">${parseFloat(e.distance_totale || 0).toFixed(0)} km</span>
                </div>
            `;}
          )
          .join("");

        // Ajout de l'exempt si la poule est incomplète
        let exempt = ``;
        if (poule.equipes.length < nb_max_equipes) {
          exempt = `
                    <div class="pool-team-row"
                        style="background-color: rgba(0,0,0,0.05); color: #888; font-style: italic;">
                        <span class="pool-team-dot" style="background:#ccc; opacity:0.5;"></span>
                        <span>Exempt</span>
                        <span class="pool-team-club">-</span>
                    </div>`;
        }
        const affichagePoids = difficultePoule > 0 ? `+${difficultePoule}` : difficultePoule;
        return `
            <div class="pool-card">
                <div class="pool-card-head">
                    <span class="pool-dot" style="background:${couleur}"></span>
                    Poule ${lettre}
                    <div style="text-align:right; margin-left:auto">
                        <div style="font-weight:600; font-size:.7rem; color:var(--clr-surface-600)">
                            Dist.Moy: ${parseFloat(poule.distance_moyenne || 0).toFixed(0)} km
                        </div>
                        <div style="font-size:0.7rem; color:#888; font-weight:normal">
                            σ: ${parseFloat(poule.ecart_type || 0).toFixed(0)} (Écart-type)
                        </div>
                        ${isModeNiveau ? `
            <div style="font-weight:600; font-size:.7rem; color:var(--clr-surface-600); margin-top:2px;">
              Poids : ${affichagePoids}
            </div>` : ""}
                    </div>
                </div>
                ${lignes}${exempt}
            </div>`;
      })
      .join("");

    document.getElementById("recap-content").innerHTML = `
            <div class="niveau-bloc">
                <div class="niveau-bloc-header">
                    <span class="niveau-bloc-title">
                        ${config.categorie.toUpperCase()} — ${config.genre.toUpperCase()} — ${niveau}
                    </span>
                    <span class="niveau-bloc-meta">${poules.length} poules · ${toutesLesEquipes.length} équipes</span>
                </div>
                <div class="niveau-stats">
                    <div class="niveau-stat-pill" style="background: var(--clr-primary-100); color: var(--clr-primary-700)">
                        Moyenne trajet équipe: <strong>${moyenneEquipeGlobale.toFixed(0)} km</strong>
                    </div>
                </div>
                <div class="pools-grid">${cartes}</div>
            </div>`;
  }

  function exporterExcel(niveauxData) {
    if (typeof XLSX === "undefined") {
      toast("Bibliothèque Excel non chargée.", "error");
      return;
    }

    const wb = XLSX.utils.book_new();

    niveauxData.forEach(({ niveau, poules }) => {
      const rows = [];

      rows.push([
        `${config.categorie.toUpperCase()} — ${config.genre} — Niveau ${niveau}`,
      ]);
      rows.push([]); // ligne vide

      poules.forEach((poule, pi) => {
        const lettre = poule.nom || String.fromCharCode(65 + pi);

        // En-tête de la poule
        rows.push([
          `Poule ${lettre}`,
          "",
          `Distance moyenne : ${parseFloat(poule.distance_moyenne || 0).toFixed(0)} km ---- Écart-type : ${parseFloat(poule.ecart_type || 0).toFixed(0)}`,
        ]);

        // En-têtes colonnes
        rows.push(["Équipe", "Numéro Club", "Distance totale (km)"]);

        // Équipes
        poule.equipes.forEach((e) => {
          rows.push([
            e.id || "",
            e.num_club || "",
            parseFloat(e.distance_totale || 0).toFixed(0),
          ]);
        });

        rows.push([]);
      });

      // Créer la feuille
      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // Largeurs de colonnes
      ws["!cols"] = [{ wch: 56 }, { wch: 20 }, { wch: 38 }];

      const nomFeuille = `Niveau ${niveau}`;
      XLSX.utils.book_append_sheet(wb, ws, nomFeuille);
    });

    // Téléchargement
    const nomFichier = `poules_${config.categorie}_${config.genre}.xlsx`;
    XLSX.writeFile(wb, nomFichier);
    toast("Fichier Excel exporté avec succès.", "success");
  }

  document.getElementById("btn-prev").addEventListener("click", () => {
    window.location.href =
      `niveau.html?` +
      new URLSearchParams({
        categorie: config.categorie,
        niveaux: config.niveaux,
        genre: config.genre,
        niveauActuel: config.niveaux,
        mode: config.mode,
      }).toString();
  });

  //initialisation
  renderStepper();

  const niveauxData = chargerToutesLesPoules();

  if (!niveauxData.length) {
    document.getElementById("recap-content").innerHTML = `
        <div class="niveau-bloc">
            <div class="pools-grid">
                <div class="recap-empty">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <p>Aucune poule générée. Retournez aux niveaux pour générer les poules.</p>
                </div>
            </div>
        </div>`;
    toast("Aucune poule trouvée dans la session.", "warn");
    return;
  }

  let niveauActif = niveauxData[0].niveau;

  function selectionnerNiveau(n) {
    niveauActif = n;
    const data = niveauxData.find((d) => d.niveau === n);
    if (!data) return;

    renderTabs(niveauxData, niveauActif, selectionnerNiveau);
    //renderSelectorSidebar(niveauxData, niveauActif, selectionnerNiveau);
    afficherNiveau(data);
  }

  const stats = calculerStatsGlobales(niveauxData);
  afficherStatsGlobales(stats);

  selectionnerNiveau(niveauActif);

  document.getElementById("btn-export").addEventListener("click", () => {
    exporterExcel(niveauxData);
  });

  const niveauxManquants = [];
  for (let n = 1; n <= config.niveaux; n++) {
    if (!niveauxData.find((d) => d.niveau === n)) niveauxManquants.push(n);
  }
  if (niveauxManquants.length) {
    toast(
      `Niveaux sans poules : ${niveauxManquants.map((n) => `Niveau ${n}`).join(", ")}`,
      "warn",
    );
  }
});

// Feuille récap globale
    /*const recapRows = [
      [`Récapitulatif — ${config.categorie.toUpperCase()} ${config.genre}`],
      [],
      [
        "Niveau",
        "Nb poules",
        "Nb équipes",
        "Dist. moy. (km)",
        "Dist. min (km)",
        "Dist. max (km)",
        "Écart (km)",
      ],
    ];

    niveauxData.forEach(({ niveau, poules }) => {
      const nbEq = poules.reduce((s, p) => s + p.equipes.length, 0);
      const dists = poules.map((p) => parseFloat(p.distance_moyenne || 0));
      const moy = dists.reduce((a, b) => a + b, 0) / (dists.length || 1);
      const min = Math.min(...dists);
      const max = Math.max(...dists);
      recapRows.push([
        `Niveau ${niveau}`,
        poules.length,
        nbEq,
        moy.toFixed(0),
        min.toFixed(0),
        max.toFixed(0),
        (max - min).toFixed(0),
      ]);
    });

    const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);
    wsRecap["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 13 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRecap, "Récapitulatif");*/

  /*function renderSelectorSidebar(niveauxData, niveauActif, onSelect) {
    const container = document.getElementById("niveau-selector");
    container.innerHTML = niveauxData
      .map(({ niveau, poules }) => {
        const nbEq = poules.reduce((s, p) => s + p.equipes.length, 0);
        return `
            <div class="niveau-selector-item ${niveau === niveauActif ? "active" : ""}"
                 data-niveau="${niveau}">
                Niveau ${niveau}
                <span class="ns-badge">${poules.length} poules · ${nbEq} éq.</span>
            </div>`;
      })
      .join("");

    container.querySelectorAll(".niveau-selector-item").forEach((el) => {
      el.addEventListener("click", () => {
        onSelect(parseInt(el.dataset.niveau));
      });
    });
  }*/

/*function afficherNiveau(niveauData) {
        const { niveau, poules } = niveauData;
        const nbEquipes = poules.reduce((s, p) => s + p.equipes.length, 0);
        const distMoy   = poules.reduce((s, p) => s + parseFloat(p.distance_moyenne || 0), 0) / (poules.length || 1);
        const distMin   = Math.min(...poules.map(p => parseFloat(p.distance_moyenne || 0)));
        const distMax   = Math.max(...poules.map(p => parseFloat(p.distance_moyenne || 0)));
        const nb_max_equipes = Math.max(...poules.map((p) => p.nb_max));
        const cartes = poules.map((poule, pi) => {
            const couleur = PALETTE[pi % PALETTE.length];
            const lettre  = poule.nom || String.fromCharCode(65 + pi);
            const lignes = poule.equipes.map(e => `
                <div class="pool-team-row">
                    <span class="pool-team-dot" style="background:${couleur}"></span>
                    <span>${e.nom}</span>
                    <span class="pool-team-club">${parseFloat(e.distance_totale || 0).toFixed(0)} km</span>
                </div>
            `).join('');

            // Ajout de l'exempt si la poule est incomplète
            let exempt = ``;
            if (poule.equipes.length < nb_max_equipes) {
                exempt = `
                    <div class="pool-team-row"
                        style="background-color: rgba(0,0,0,0.05); color: #888; font-style: italic;">
                        <span class="pool-team-dot" style="background:#ccc; opacity:0.5;"></span>
                        <span>Exempt</span>
                        <span class="pool-team-club">-</span>
                    </div>`;
            }
            return `
            <div class="pool-card">
                <div class="pool-card-head">
                    <span class="pool-dot" style="background:${couleur}"></span>
                    Poule ${lettre}
                    <span style="font-weight:500;color:var(--clr-surface-400);margin-left:auto;font-size:.78rem">
                        ${parseFloat(poule.distance_moyenne || 0).toFixed(0)} km
                    </span>
                </div>
                ${lignes}${exempt}
            </div>`;
        }).join('');

        document.getElementById('recap-content').innerHTML = `
        <div class="niveau-bloc">
            <div class="niveau-bloc-header">
                <span class="niveau-bloc-title">
                    ${config.categorie.toUpperCase()} — ${config.genre} — Niveau ${niveau}
                </span>
                <span class="niveau-bloc-meta">${poules.length} poules · ${nbEquipes} équipes</span>
            </div>
            <div class="niveau-stats">
                <div class="niveau-stat-pill">
                    Distance moy. <strong>${distMoy.toFixed(0)} km</strong>
                </div>
                <div class="niveau-stat-pill">
                    Min <strong>${distMin.toFixed(0)} km</strong>
                </div>
                <div class="niveau-stat-pill">
                    Max <strong>${distMax.toFixed(0)} km</strong>
                </div>
                <div class="niveau-stat-pill">
                    Écart <strong>${(distMax - distMin).toFixed(0)} km</strong>
                </div>
            </div>
            <div class="pools-grid">${cartes}</div>
        </div>`;
    }*/
