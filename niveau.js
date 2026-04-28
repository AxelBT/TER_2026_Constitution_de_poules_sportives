import {
  traiterCSV,
  generer_poules,
  verifierClubDansPoule,
  calculerDistanceMoyenne,
  verifierSaturationClub,
  finaliserStatistiquesPoules,
  calculerBarycentre,
  ajouterEquipeDansPoule,
} from "./calcul-poules.js";

import { genererPoulesNiveau } from "./calcul-poules-niveau.js";

import { toast } from "./toast.js";

let poulesActuelles = [];

let selection = null;

// ── Fabrique une icône pin SVG colorée ──────────────────────────────────────
function createPinIcon(color = "#888780", opacity = 1) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path fill="${color}" fill-opacity="${opacity}" stroke="#fff" stroke-width="2"
        d="M14 1C7.4 1 2 6.4 2 13c0 9 12 24 12 24S26 22 26 13C26 6.4 20.6 1 14 1z"/>
      <circle cx="14" cy="13" r="5" fill="#fff" fill-opacity="${opacity}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -38],
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const config = {
    categorie: params.get("categorie") || "senior",
    niveaux: parseInt(params.get("niveaux")) || 1,
    genre: params.get("genre") || "masculin",
    niveauActuel: parseInt(params.get("niveauActuel")) || 1,
    mode: params.get("mode") || "distance",
  };

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

  /* ── STEPPER ────────────────────────────────────────────────────────────── */
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
    const courant = config.niveauActuel;
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

  /* ── TITRE & NAVIGATION ─────────────────────────────────────────────────── */
  function updateTitre() {
    document.getElementById("titre-niveau").textContent =
      `${config.categorie}-${config.genre}-${config.niveauActuel}`.toUpperCase();
    document.getElementById("badge-niveau").textContent =
      `Niveau ${config.niveauActuel} / ${config.niveaux}`;
  }

  function buildURL(niveauActuel) {
    return (
      "niveau.html?" +
      new URLSearchParams({
        categorie: config.categorie,
        niveaux: config.niveaux,
        genre: config.genre,
        mode: config.mode,
        niveauActuel,
      }).toString()
    );
  }

  /* ── LEAFLET ────────────────────────────────────────────────────────────── */
  const map = L.map("map").setView([46.6033, 1.8883], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  let markers = [];

  function clearMarkers() {
    markers.forEach((m) => m.remove());
    markers = [];
  }

  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnGenerer = document.getElementById("btn-generer");
  const fileInput = document.getElementById("file_csv_niveau");
  const fileLabel = document.getElementById("file-label");

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0)
        fileLabel.innerText = "Fichier prêt : " + e.target.files[0].name;
    });
  }

  if (config.niveauActuel === 1) {
    btnPrev.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
      </svg>
      Configuration`;
  }

  btnPrev.addEventListener("click", () => {
    if (config.niveauActuel > 1) {
      localStorage.setItem(
        `${config.categorie}-${config.genre}-${config.niveauActuel}`,
        JSON.stringify(poulesActuelles),
      );
      window.location.href = buildURL(config.niveauActuel - 1);
    } else {
      alert(
        "Retour à la configuration générale des poules. Les poules générées seront supprimées.",
      );
      localStorage.clear();
      window.location.href = "poule.html";
    }
  });

  if (config.niveauActuel === config.niveaux) {
    btnNext.innerHTML = `Récapitulatif
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
      </svg>`;
    btnNext.style.background = "linear-gradient(135deg, #6d28d9, #7c3aed)";
    btnNext.style.boxShadow =
      "0 2px 4px rgba(109,40,217,.2), 0 8px 20px rgba(109,40,217,.16)";
  }

  btnNext.addEventListener("click", () => {
    if (config.niveauActuel < config.niveaux) {
      localStorage.setItem(
        `${config.categorie}-${config.genre}-${config.niveauActuel}`,
        JSON.stringify(poulesActuelles),
      );
      window.location.href = buildURL(config.niveauActuel + 1);
    } else {
      window.location.href =
        "recapitulatif.html?" +
        new URLSearchParams({
          categorie: config.categorie,
          niveaux: config.niveaux,
          genre: config.genre,
        }).toString();
    }
  });

  btnGenerer.addEventListener("click", () => {
    const fileInput = document.getElementById("file_csv_niveau");
    const file = fileInput.files[0];
    if (!file) {
      toast("Veuillez sélectionner un fichier CSV", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async function (e) {
      const contenu = e.target.result;
      const resultat = await traiterCSV(contenu);
      if (!resultat.succes) {
        // afficher plutard les noms des équipes
        console.error("Équipes inconnues détectées :", resultat.tableau);
        return;
      }
      localStorage.setItem(`csv_contenu_niveau${config.niveauActuel}`, contenu);
      localStorage.setItem(`csv_nom_niveau${config.niveauActuel}`, file.name);
      const equipes = resultat.tableau;
      afficherCarte(equipes);
      toast(
        `${equipes.length} équipes affichées (mode : ${config.mode === "niveau" ? "par niveau" : "par distance"}).`,
        "info",
      );
      //localStorage.setItem("equipes", JSON.stringify(equipes));
      const nb_poules = parseInt(document.getElementById("nb_poules").value);
      const nb_max = parseInt(document.getElementById("nb_max_equipes").value);
      const nb_equipes = equipes.length;
      if (nb_poules * nb_max < nb_equipes) {
        toast(
          "Capacité insuffisante : augmente le nombre de poules ou la taille max.",
          "error",
        );
        return;
      }

      // garantir qu'on a au moins une poule saturée et au plus un exempts dans les autres poules
      if (nb_equipes <= nb_poules * (nb_max - 1)) {
        toast(
          "Trop peu d'équipes : réduis le nombre de poules ou la taille max.",
          "error",
        );
        return;
      }

      if (!verifierSaturationClub(equipes, nb_poules)) {
        toast(
          "Trop d\'équipes d\'un même club pour le nombre de poules.",
          "error",
        );
        return;
      }
      // on ne peut pas avoir des exempts dans des poules de deux
      /*if (nb_max === 2 && nb_equipes != nb_max * nb_poules) {
        toast("Pas d\'exempts dans des poules de 2.", "error");
        return;
      }*/
      if(config.mode === "niveau"){ 
        console.log(equipes);
        poulesActuelles = genererPoulesNiveau(equipes,nb_poules);
        console.log("Poules générées par niveau :", poulesActuelles);
      }
      else poulesActuelles = generer_poules(equipes, nb_poules, nb_max);
      if (poulesActuelles) {
        afficherPoules();
        highlightToutesLesPoules();
        toast(
          `${equipes.length} équipes réparties en ${poulesActuelles.length} poules.`,
          "success",
        );
      }
      /*localStorage.setItem(
          `${config.categorie}-${config.genre}-${config.niveauActuel}`,
          JSON.stringify(poules),
        );*/
    };
    reader.readAsText(file);
  });

  function jitterCoords(lat, lng, index, total) {
    if (total <= 1) return [lat, lng];
    const angle = (2 * Math.PI * index) / total;
    const radius = 0.15; // ~15 km de décalage
    return [lat + radius * Math.sin(angle), lng + radius * Math.cos(angle)];
  }

  /* ── CARTE ──────────────────────────────────────────────────────────────── */
  function afficherCarte(equipes) {
    clearMarkers();
    const overlay = document.getElementById("map-overlay");

    if (!equipes || !equipes.length) {
      overlay.classList.remove("hidden");
      return;
    }
    overlay.classList.add("hidden");

    // Groupe les équipes par coordonnées identiques
    const groupes = {};
    equipes.forEach((c) => {
      const key = `${c.latitude},${c.longitude}`;
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(c);
    });

    const bounds = [];
    Object.values(groupes).forEach((groupe) => {
      groupe.forEach((c, index) => {
        const baseLat = parseFloat(String(c.latitude).replace(",", "."));
        const baseLng = parseFloat(String(c.longitude).replace(",", "."));
        if (isNaN(baseLat) || isNaN(baseLng)) return;

        const [lat, lng] = jitterCoords(baseLat, baseLng, index, groupe.length);

        const m = L.marker([lat, lng], { icon: createPinIcon("#888780") });
        m.bindPopup(
          `<strong>${c.type === "CTC" ? c.ctc_nom : c.nom_club} ${c.numero}</strong><br><span style="color:#888"> ${c.type === "CTC" ? "CTC " + c.ctc_num : "Club " + c.num_club}</span>`,
        );
        m.on('mouseover', function (e) {
            this.openPopup();
        });
        m.on('mouseout', function (e) {
            this.closePopup();
        });
        m.addTo(map);
        m.clubId = c.type === "CTC" ? c.ctc_num : c.num_club;
        m.equipeId = c.id;
        markers.push(m);
        bounds.push([lat, lng]);
      });
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
  }

  /* ── Affichage des erreurs ────────────────────────────────────────────────────── */

  function afficherErreurs() {
    const clubsIgnores = JSON.parse(localStorage.getItem('clubs_ignorés') || '[]');
    const equipesInconnues = window.equipesInconnues || []; // ton tableau produit par traiterCSV

    const panel = document.getElementById('errors-panel');
    let visible = false;

    // Clubs non géocodés
    const blockGeo = document.getElementById('block-geocodage');
    if (clubsIgnores.length > 0) {
        document.getElementById('count-geocodage').textContent = clubsIgnores.length;
        const ul = document.getElementById('list-geocodage');
        ul.innerHTML = clubsIgnores.map(nom => `<li>${nom}</li>`).join('');
        blockGeo.style.display = 'block';
        visible = true;
    }

    // Équipes non placées
    const blockEq = document.getElementById('block-equipes');
    if (equipesInconnues.length > 0) {
        document.getElementById('count-equipes').textContent = equipesInconnues.length;
        const ul = document.getElementById('list-equipes');
        ul.innerHTML = equipesInconnues.map(e => `<li>${e.nom}</li>`).join('');
        blockEq.style.display = 'block';
        visible = true;
    }

    panel.style.display = visible ? 'flex' : 'none';
}

  /* ── HIGHLIGHT POULE ────────────────────────────────────────────────────── */
  highlightPoule._actif = null;

  function highlightPoule(pouleIndex) {
    if (highlightPoule._actif === pouleIndex) {
      highlightPoule._actif = null;
      //resetMarkers();
      highlightToutesLesPoules();
      document
        .querySelectorAll(".pool-card")
        .forEach((c) => c.classList.remove("pool-card--active"));
      return;
    }

    highlightPoule._actif = pouleIndex;
    const poule = poulesActuelles[pouleIndex];
    const couleur = PALETTE[pouleIndex % PALETTE.length];
    const idsPoule = new Set(poule.equipes.map((e) => e.id)); // ← id au lieu de id_club
    markers.forEach((m) => {
      if (idsPoule.has(m.equipeId)) {
        m.setIcon(createPinIcon(couleur, 1));
        m.setZIndexOffset(1000);
        const equipe = poule.equipes.find((e) => e.id === m.equipeId); // ← idem
        //const nom = (equipe.type==="CTC") ? equipe.ctc_nom + " " + equipe.numero : equipe.nom_club + " " + equipe.numero;
        m.bindPopup(
          `<strong>${equipe ? (equipe.type === "CTC" ? equipe.ctc_nom + " " + equipe.numero : equipe.nom_club + " " + equipe.numero) : "Inconnu"}</strong><br><span style="color:#888">${m.clubId}</span>`,
        );
        m.on('mouseover', function (e) {
            this.openPopup();
        });
        m.on('mouseout', function (e) {
            this.closePopup();
        });
      } else {
        m.setIcon(createPinIcon("#888780", 0.25));
        m.setZIndexOffset(0);
      }
    });

    // fitBounds — inchangé
    const pBounds = markers
      .filter((m) => idsPoule.has(m.equipeId)) // ← equipeId
      .map((m) => m.getLatLng());
    if (pBounds.length)
      map.fitBounds(
        pBounds.map((ll) => [ll.lat, ll.lng]),
        { padding: [60, 60], maxZoom: 10 },
      );
  }

  function highlightToutesLesPoules() {
    const equipeIdToCouleur = new Map();
    poulesActuelles.forEach((poule, i) => {
      const couleur = PALETTE[i % PALETTE.length];
      poule.equipes.forEach((e) => equipeIdToCouleur.set(e.id, couleur));
    });
    markers.forEach((m) => {
      const couleur = equipeIdToCouleur.get(m.equipeId);
      if (couleur) {
        m.setIcon(createPinIcon(couleur, 1));
        m.setZIndexOffset(1000);
      } else {
        m.setIcon(createPinIcon("#888780", 0.25));
        m.setZIndexOffset(0);
      }
    });
    highlightPoule._actif = null;
  }

  function resetMarkers() {
    markers.forEach((m) => {
      m.setIcon(createPinIcon("#888780", 1));
      m.setZIndexOffset(0);
    });
  }

  /* ── MODE ÉDITION ───────────────────────────────────────────────────────── */
  let modeEdition = false;

  function setModeEdition(actif) {
    modeEdition = actif;
    selection = null;

    const btn = document.getElementById("btn-switch");
    const badge = document.getElementById("badge-edit");
    const hint = document.getElementById("edit-hint");
    const overlay = document.getElementById("edit-overlay");

    btn.classList.toggle("active", actif);
    btn.textContent = actif
      ? "✕ Terminer la modification"
      : "Modifier les poules";
    badge.classList.toggle("visible", actif);
    overlay.classList.toggle("visible", actif);
    hint.textContent = actif
      ? "Cliquez sur deux équipes pour les échanger."
      : "";

    if (actif) {
      highlightPoule._actif = null;
      //resetMarkers();
      document
        .querySelectorAll(".pool-card")
        .forEach((c) => c.classList.remove("pool-card--active"));
      afficherPoules();
    } else {
      afficherPoules();
    }
  }

  function attacherListenersEdition() {
    document.querySelectorAll(".pool-team-row").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();

        const pi = Number(el.dataset.pouleIndex);
        const eid = el.dataset.equipeId;
        if (isNaN(pi) || eid === undefined) return;

        if (!selection) {
          selection = { pi, eid, el };
          el.classList.add("selected");
          const hint = document.getElementById("edit-hint");
          if (hint)
            hint.textContent = "Maintenant cliquez sur l'équipe à échanger.";
          return;
        }

        // Même équipe → désélection
        if (selection.eid === eid && selection.pi === pi) {
          selection.el.classList.remove("selected");
          selection = null;
          const hint = document.getElementById("edit-hint");
          if (hint)
            hint.textContent = "Cliquez sur deux équipes pour les échanger.";
          return;
        }

        if (
          selection.pi === pi ||
          (selection.eid === "exempt" && eid === "exempt")
        ) {
          selection.el.classList.remove("selected"); // Retire le style du premier
          selection = { pi, eid, el }; // Enregistre le nouveau
          el.classList.add("selected"); // Ajoute le style au nouveau
          return;
        }

        if (
          selection.pi === pi ||
          (selection.eid === "exempt" && eid === "exempt")
        ) {
          selection.el.classList.remove("selected"); // Retire le style du premier
          selection = { pi, eid, el }; // Enregistre le nouveau
          el.classList.add("selected"); // Ajoute le style au nouveau
          return;
        }

        // 2ème sélection → swap
        const sel = selection;
        el.classList.add("selected");

        setTimeout(() => {
          if (!sel) return;
          const pA = poulesActuelles[sel.pi];
          const pB = poulesActuelles[pi];
          if (!pA || !pB) return;

          const isExemptA = sel.eid === "exempt";
          const isExemptB = eid === "exempt";
          const nb_max_equipes = Math.max(
            ...poulesActuelles.map((p) => p.nb_max),
          );
          if (isExemptA && isExemptB) {
            // normalement ce cas ne paut jamais arriver cas on ne peut pas sélectionner deux exempts
            toast("Impossible d'échanger deux exempts", "error");
          } else if (isExemptA || isExemptB) {
            console.log("Cas d'un transfert vers un emplacement libre");
            const sourcePoule = isExemptB ? pA : pB;
            const destPoule = isExemptB ? pB : pA;
            const equipeId = isExemptB ? sel.eid : eid;

            const idx = sourcePoule.equipes.findIndex((e) => e.id === equipeId);
            const equipeObj = sourcePoule.equipes[idx];

            // Vérifier si le club existe déjà dans la poule de destination
            if (nb_max_equipes === sourcePoule.nb_max) {
              if (!verifierClubDansPoule(destPoule, equipeObj)) {
                sourcePoule.equipes.splice(idx, 1);
                sourcePoule.distance_moyenne =
                  calculerDistanceMoyenne(sourcePoule);
                sourcePoule.barycentre = calculerBarycentre(
                  sourcePoule.equipes,
                );
                sourcePoule.nb_max = sourcePoule.nb_max - 1;
                destPoule.nb_max = destPoule.nb_max + 1;
                ajouterEquipeDansPoule(destPoule, equipeObj);
                finaliserStatistiquesPoules(poulesActuelles);
              } else {
                toast(
                  `il existe déjà une équipe du même club dans la poule de destination`,
                  "error",
                );
              }
            } else {
              toast(`Pas plus d'un exempt dans une poule`, "error");
            }
          }
          // --- LOGIQUE ORIGINALE : ÉCHANGE STANDARD ---
          else {
            const iA = pA.equipes.findIndex((e) => e.id === sel.eid);
            const iB = pB.equipes.findIndex((e) => e.id === eid);

            if (iA !== -1 && iB !== -1) {
              if (
                pA.equipes[iA].num_club === pB.equipes[iB].num_club ||
                (!verifierClubDansPoule(pA, pB.equipes[iB]) &&
                  !verifierClubDansPoule(pB, pA.equipes[iA]))
              ) {
                /*[pA.equipes[iA], pB.equipes[iB]] = [
                  pB.equipes[iB],
                  pA.equipes[iA],
                ];*/
                [
                  poulesActuelles[sel.pi].equipes[iA],
                  poulesActuelles[pi].equipes[iB],
                ] = [
                  poulesActuelles[pi].equipes[iB],
                  poulesActuelles[sel.pi].equipes[iA],
                ];
                console.log(poulesActuelles);
                poulesActuelles[sel.pi].distance_moyenne =
                  calculerDistanceMoyenne(poulesActuelles[sel.pi]);
                poulesActuelles[pi].distance_moyenne = calculerDistanceMoyenne(
                  poulesActuelles[pi],
                );
                poulesActuelles[sel.pi].barycentre = calculerBarycentre(
                  poulesActuelles[sel.pi].equipes,
                );
                poulesActuelles[pi].barycentre = calculerBarycentre(
                  poulesActuelles[pi].equipes,
                );
                finaliserStatistiquesPoules(poulesActuelles);
              } else {
                toast(
                  `Une équipe de ce club appartient déjà à cette poule`,
                  "error",
                );
              }
            }
          }
          selection = null;
          afficherPoules();
          highlightToutesLesPoules();
          /*localStorage.setItem(
            `${config.categorie}-${config.genre}-${config.niveauActuel}`,
            JSON.stringify(poules),
          );*/
          //sauvegarderPoules(poules);

          const hint = document.getElementById("edit-hint");
          if (hint) {
            hint.textContent = "✓ Échange effectué.";
            setTimeout(() => {
              if (modeEdition)
                hint.textContent =
                  "Cliquez sur deux équipes pour les échanger.";
            }, 2500);
          }
        }, 120);
      });
    });
  }

  /* ====================================================
       GRILLE DE POULES
       ==================================================== */

  function afficherPoules() {
    const grid = document.getElementById("pools-grid");
    const meta = document.getElementById("pools-meta");
    const btnEchange = document.getElementById("conteneur-btn-echange");

    highlightPoule._actif = null;

    if (!poulesActuelles.length) {
      meta.textContent = "";
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

    const totalEq = poulesActuelles.reduce((s, p) => s + p.equipes.length, 0);
    meta.textContent = `${totalEq} équipes · ${poulesActuelles.length} poules`;

    // Créer le bouton une seule fois
    if (btnEchange && !document.getElementById("btn-switch")) {
      btnEchange.innerHTML = `<button id="btn-switch" class="btn-switch-style">Modifier les poules</button>`;
      document.getElementById("btn-switch").addEventListener("click", () => {
        //const p = JSON.parse(localStorage.getItem(`${config.categorie}-${config.genre}-${config.niveauActuel}`));
        //console.log(p);
        setModeEdition(!modeEdition);
      });
    }

    // Reconstruction du DOM — les listeners précédents sont détruits avec les anciens éléments
    const nb_max_equipes = Math.max(...poulesActuelles.map((p) => p.nb_max));
    grid.innerHTML = poulesActuelles
      .map((poule, pi) => {
        const lettre = poule.nom || String.fromCharCode(65 + pi);
        const couleur = PALETTE[pi % PALETTE.length];

        let lignes = poule.equipes
          .map(
            (e) => `
                <div class="pool-team-row${modeEdition ? " clickable" : ""}"
                     data-poule-index="${pi}"
                     data-equipe-id="${e.id}">
                    <span class="pool-team-dot" style="background:${couleur}"></span>
                    <span class="pool-team-name">
                      ${e.type === "CTC" ? e.ctc_nom : e.nom_club} — ${e.numero}
                    </span>
                    <span class="pool-team-club">${e.distance_totale} Km</span>
                </div>
            `,
          )
          .join("");

        if (poule.equipes.length < nb_max_equipes) {
          lignes += `
        <div class="pool-team-row${modeEdition ? " clickable" : ""}"
             data-poule-index="${pi}"
             data-equipe-id="exempt"
             style="background-color: rgba(0, 0, 0, 0.05); color: #888; font-style: italic;">
            <span class="pool-team-dot" style="background: #ccc; opacity: 0.5;"></span>
            <span>Exempt</span>
            <span class="pool-team-club">-</span>
        </div>`;
        }

        //debugger;
        return `
            <div class="pool-card" data-poule-index="${pi}">
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
                    </div>
                </div>
                ${lignes}
            </div>`;
      })
      .join("");

    if (modeEdition) {
      // Mode édition : listeners swap sur les lignes, pas de listener carte sur les cards
      attacherListenersEdition();
    } else {
      // Mode normal : listener highlight carte sur les cards uniquement
      document.querySelectorAll(".pool-card").forEach((card, i) => {
        card.addEventListener("click", () => {
          highlightPoule(i);
          window.scrollTo(0, 0);
        });
      });
    }
  }
  /* ====================================================
       BOUTONS GÉNÉRER
       ==================================================== */
  /*function onGenerer(mode) {
    const equipes = traiterCSV(
      localStorage.getItem(`csv_niveau${config.niveauActuel}`),
    );
    afficherCarte(equipes);
    toast(
      `${equipes.length} équipes affichées (mode : ${mode === "niveau" ? "par niveau" : "par distance"}).`,
      "info",
    );
  }

  document
    .getElementById("btn-generer")
    .addEventListener("click", () => onGenerer((config.mode)));*/

  /* ── INIT ───────────────────────────────────────────────────────────────── */
  updateTitre();
  renderStepper();
  afficherErreurs();

  setTimeout(() => map.invalidateSize(), 100);

  /* ── RESTAURATION ───────────────────────────────────────────────────────── */
  const cle = `${config.categorie}-${config.genre}-${config.niveauActuel}`;
  const poulesStockees = localStorage.getItem(cle);

  if (poulesStockees) {
    try {
      //const poules = JSON.parse(poulesStockees);
      poulesActuelles = poulesStockees ? JSON.parse(poulesStockees) : [];
      if (poulesActuelles.length > 0) {
        document.getElementById("nb_poules").value = poulesActuelles.length;
        document.getElementById("nb_max_equipes").value = Math.max(
          ...poulesActuelles.map((p) => p.nb_max),
        );

        const equipes = poulesActuelles.flatMap((p) => p.equipes);
        afficherCarte(equipes);
        afficherPoules();
        highlightToutesLesPoules();

        const csvStocke = localStorage.getItem(
          `csv_contenu_niveau${config.niveauActuel}`,
        );
        const csvNom = localStorage.getItem(
          `csv_nom_niveau${config.niveauActuel}`,
        );

        if (csvStocke && csvNom) {
          const blob = new Blob([csvStocke], { type: "text/csv" });
          const file = new File([blob], csvNom, { type: "text/csv" });
          const dt = new DataTransfer();
          dt.items.add(file);
          document.getElementById("file_csv_niveau").files = dt.files;
          document.getElementById("file-label").innerHTML = `✓ ${csvNom}`;
        }
        toast(`Poules déjà générées pour ce niveau`, "info");
      }
    } catch (err) {
      console.warn("Erreur lors de la restauration des poules :", err);
    }
  }
});
