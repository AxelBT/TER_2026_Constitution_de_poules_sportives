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
let equipesActuelles = [];

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
        niveauActuel: config.niveauActuel,
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
      config.niveauActuel--;
      localStorage.setItem("championnatConfig", JSON.stringify(config));
      window.location.href = buildURL(config.niveauActuel);
    } else {
      const overlay = document.getElementById("modal-retour");
      overlay.style.display = "flex";

      document.getElementById("modal-btn-annuler").onclick = () => {
        overlay.style.display = "none";
      };

      document.getElementById("modal-btn-confirmer").onclick = () => {
        localStorage.clear();
        window.location.href = "poule.html";
      };
      overlay.addEventListener(
        "click",
        (e) => {
          if (e.target === overlay) overlay.style.display = "none";
        },
        { once: true },
      );
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
    localStorage.setItem(
      `${config.categorie}-${config.genre}-${config.niveauActuel}`,
      JSON.stringify(poulesActuelles),
    );
    if (config.niveauActuel < config.niveaux) {
      config.niveauActuel++;
      localStorage.setItem("championnatConfig", JSON.stringify(config));
      window.location.href = buildURL(config.niveauActuel );
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

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
      const contenu = e.target.result;

      // Traiter immédiatement
      const { succes, tableau } = await traiterCSV(contenu);

      if (!succes) {
        equipesActuelles = []; //
        if (tableau.length > 0) afficherEquipesInconnues(tableau);
        return;
      }

      equipesActuelles = tableau;
      localStorage.setItem(
        `csv_equipes_niveau${config.niveauActuel}`,
        JSON.stringify(equipesActuelles),
      );
      localStorage.setItem(`csv_nom_niveau${config.niveauActuel}`, file.name);
      //fileLabel.innerHTML = `✓ ${file.name} — ${tableau.length} équipes chargées`;
      //fileLabel.style.color = "#16a34a";
      toast(`${tableau.length} équipes chargées avec succès.`, "success");
      afficherCarte(equipesActuelles);
      toast(
        `${equipesActuelles.length} équipes affichées (mode : ${config.mode === "niveau" ? "par niveau" : "par distance"}).`,
        "info",
      );
    };

    reader.readAsText(file);
  });

  btnGenerer.addEventListener("click", () => {
    if (!equipesActuelles.length) {
      toast("Veuillez d'abord déposer un fichier valide.", "warn");
      return;
    }
    //localStorage.setItem("equipes", JSON.stringify(equipes));
    const nb_poules = parseInt(document.getElementById("nb_poules").value);
    const nb_max = parseInt(document.getElementById("nb_max_equipes").value);
    const nb_equipes = equipesActuelles.length;
    if (nb_poules * nb_max < nb_equipes) {
      afficherErreur(
        "Capacité insuffisante",
        "La capacité des poules est insuffisante pour accueillir toutes les équipes. Veuillez augmenter le nombre de poules ou la taille maximale.",
      );
      return;
    }

    // garantir qu'on a au moins une poule saturée et au plus un exempts dans les autres poules
    if (nb_equipes <= nb_poules * (nb_max - 1)) {
      afficherErreur(
        "Paramètres incohérents",
        "Trop peu d'équipes pour la configuration choisie. Veuillez réduire le nombre de poules ou la taille maximale.",
      );
      return;
    }
    const check = verifierSaturationClub(equipesActuelles, nb_poules);
    if (!check.ok) {
      afficherErreur(
        "Contrainte de club non respectée",
        `Le club "${check.nomClub}" (${check.numClub}) possède ${check.nbEquipes} équipes ` +
          `pour seulement ${nb_poules} poule(s) disponible(s). ` +
          `Il est impossible de répartir ses équipes sans conflit. ` +
          `Veuillez augmenter le nombre de poules à au moins ${check.nbEquipes}.`,
      );
      return;
    }
    // on ne peut pas avoir des exempts dans des poules de deux
    /*if (nb_max === 2 && nb_equipes != nb_max * nb_poules) {
        toast("Pas d\'exempts dans des poules de 2.", "error");
        return;
      }*/
    if (config.mode === "niveau") {
      poulesActuelles = genererPoulesNiveau(equipesActuelles, nb_poules);
    } else {
      poulesActuelles = generer_poules(equipesActuelles, nb_poules);
    }
    if (poulesActuelles) {
      afficherPoules();
      highlightToutesLesPoules();
      toast(
        `${equipesActuelles.length} équipes réparties en ${poulesActuelles.length} poules.`,
        "success",
      );
      if (!localStorage.getItem("hint_carte_vu")) {
        setTimeout(() => {
          toast(
            "Cliquez sur une poule pour la visualiser sur la carte.",
            "info",
          );
          localStorage.setItem("hint_carte_vu", "1");
        }, 4500);
      }
    }
  });

  function jitterCoords(lat, lng, index, total) {
    if (total <= 1) return [lat, lng];
    const angle = (2 * Math.PI * index) / total;
    const radius = 0.005; // 500 m de décalage
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
        /*m.bindPopup(
          `<strong>${c.type === "CTC" ? c.ctc_nom : c.nom_club} ${c.numero}</strong><br><span style="color:#888"> ${c.type === "CTC" ? "CTC " + c.ctc_num : "Club " + c.num_club}</span>`,
        );
        m.on("mouseover", function (e) {
          this.openPopup();
        });
        m.on("mouseout", function (e) {
          this.closePopup();
        });*/
        m.bindTooltip(
          `<strong>${c.type === "CTC" ? c.ctc_nom : c.nom_club} ${c.numero}</strong><br>
     <span style="color:#888">${c.type === "CTC" ? "CTC " + c.ctc_num : "Club " + c.num_club}</span>`,
          {
            permanent: false,
            direction: "top",
            offset: [0, -25],
            opacity: 0.95,
          },
        );
        m.addTo(map);
        m.clubId = c.type === "CTC" ? c.ctc_num : c.num_club;
        m.equipeId = c.id;
        markers.push(m);
        bounds.push([lat, lng]);
      });
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], animate: false });
      map.once("moveend", () => {
        map.panBy([0, -38], { animate: false }); // 30px vers le bas — ajuste selon tes tests
      });
    }
  }

  /* ── Affichage des erreurs ────────────────────────────────────────────────────── */
  function afficherErreur(titre, message) {
    const overlay = document.getElementById("modal-erreur");
    document.getElementById("modal-erreur-titre").textContent = titre;
    document.getElementById("modal-erreur-message").textContent = message;
    overlay.style.display = "flex";

    document.getElementById("modal-erreur-btn").onclick = () => {
      overlay.style.display = "none";
    };
  }

  function afficherClubIngores() {
    const clubsIgnores = JSON.parse(
      localStorage.getItem("clubs_ignorés") || "[]",
    );

    const panel = document.getElementById("errors-panel");
    let visible = false;

    // Gestion des clubs non géocodés (inchangée)
    const blockGeo = document.getElementById("block-geocodage");
    if (clubsIgnores.length > 0) {
      const countGeo = document.getElementById("count-geocodage");
      if (countGeo) countGeo.textContent = clubsIgnores.length;

      const ul = document.getElementById("list-geocodage");
      if (ul)
        ul.innerHTML = clubsIgnores.map((nom) => `<li>${nom}</li>`).join("");

      if (blockGeo) blockGeo.style.display = "block";
      visible = true;
    }

    if (panel) panel.style.display = visible ? "flex" : "none";
  }

  function afficherEquipesInconnues(equipesInconnues) {
    // Nouvelle gestion des équipes inconnues avec un Modal
    if (equipesInconnues.length > 0) {
      // Supprime un éventuel modal précédent pour éviter les doublons
      const existingModal = document.getElementById("modal-equipes-inconnues");
      if (existingModal) {
        existingModal.remove();
      }

      // Création du conteneur modal
      const modalOverlay = document.createElement("div");
      modalOverlay.className = "modal-overlay";
      modalOverlay.id = "modal-equipes-inconnues";
      modalOverlay.style.display = "flex";

      modalOverlay.innerHTML = `
      <div class="modal">
          <div class="modal-icon modal-icon--warn">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
          </div>
          <h3 class="modal-title">Impossible de générer les poules</h3>
          <p class="modal-message">
              Impossible de générer les poules avec les données fournies.
              Les équipes suivantes  n'ont pas pu être localisées :
          </p>
          
          <!-- Section Scrollable pour les équipes -->
          <div style="max-height: 180px; overflow-y: auto; text-align: left; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px; margin: 15px 0;">
              <ul class="error-state-list" style="margin: 0; padding-left: 20px;">
                  ${equipesInconnues.map((e) => `<li>${e.nom}</li>`).join("")}
              </ul>
          </div>
          
          <p class="modal-message" style="font-size: 0.85em; opacity: 0.8; margin-bottom: 20px;">
              Vérifiez que ces clubs sont présents dans votre fichier CSV et qu'ils ont bien été géocodés.
          </p>
          
          <!-- Boutons d'action -->
          <div class="modal-actions" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <button class="modal-btn modal-btn--cancel" id="btn-autre-fichier">Soumettre un autre fichier</button>
              <button class="modal-btn modal-btn--confirm" id="btn-retour-config">Retour à la configuration</button>
          </div>
      </div>
    `;

      document.body.appendChild(modalOverlay);

      // Optionnel : cacher la carte en arrière-plan pendant l'affichage de l'erreur
      const mapWrapper = document.querySelector(".map-wrapper");
      if (mapWrapper) mapWrapper.style.opacity = "0.3";

      // Logique du bouton "Retour à la configuration"
      document
        .getElementById("btn-retour-config")
        .addEventListener("click", () => {
          localStorage.clear();
          window.location.href = "poule.html"; // Page de configuration racine déduite du code
        });

      // Logique du bouton "Soumettre un autre fichier"
      document
        .getElementById("btn-autre-fichier")
        .addEventListener("click", () => {
          modalOverlay.style.display = "none";
          if (mapWrapper) mapWrapper.style.opacity = "1";

          // Ouvre automatiquement la fenêtre de sélection de fichier
          const fileInput = document.getElementById("file_csv_niveau");
          if (fileInput) fileInput.click();

          // Nettoyer la variable d'erreurs pour éviter que le modal ne revienne en boucle
          localStorage.removeItem("equipesInconnues");
        });
    }
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
        /*m.bindPopup(
          `<strong>${equipe ? (equipe.type === "CTC" ? equipe.ctc_nom + " " + equipe.numero : equipe.nom_club + " " + equipe.numero) : "Inconnu"}</strong><br><span style="color:#888">${m.clubId}</span>`,
        );
        m.on("mouseover", function (e) {
          this.openPopup();
        });
        m.on("mouseout", function (e) {
          this.closePopup();
        });*/
        m.bindTooltip(
          `<strong>${equipe.type === "CTC" ? equipe.ctc_nom : equipe.nom_club} ${equipe.numero}</strong><br>
     <span style="color:#888">${equipe.type === "CTC" ? "CTC " + equipe.ctc_num : "Club " + equipe.num_club}</span>`,
          {
            permanent: false,
            direction: "top",
            offset: [0, -25],
            opacity: 0.95,
          },
        );
      } else {
        m.setIcon(createPinIcon("#888780", 0.25));
        m.setZIndexOffset(0);
      }
    });

    const pBounds = markers
      .filter((m) => idsPoule.has(m.equipeId))
      .map((m) => m.getLatLng());
    if (pBounds.length) {
      map.fitBounds(
        pBounds.map((ll) => [ll.lat, ll.lng]),
        { padding: [40, 40], maxZoom: 10 },
      );
      map.once("moveend", () => {
        map.panBy([0, -38]);
      });
    }
  }
  /*function highlightPoule(pouleIndex) {
    // Reclic sur la même poule → reset
    if (highlightPoule._actif === pouleIndex) {
      highlightPoule._actif = null;
      highlightToutesLesPoules();
      // fermer tous les tooltips
      markers.forEach((m) => m.closeTooltip());
      document
        .querySelectorAll(".pool-card")
        .forEach((c) => c.classList.remove("pool-card--active"));
      return;
    }

    highlightPoule._actif = pouleIndex;
    const poule = poulesActuelles[pouleIndex];
    const couleur = PALETTE[pouleIndex % PALETTE.length];
    const idsPoule = new Set(poule.equipes.map((e) => e.id));

    markers.forEach((m) => {
      if (idsPoule.has(m.equipeId)) {
        m.setIcon(createPinIcon(couleur, 1));
        m.setZIndexOffset(1000);
        m.openTooltip();
      } else {
        m.setIcon(createPinIcon("#888780", 0.2));
        m.setZIndexOffset(0);
        m.closeTooltip();
      }
    });

    document.querySelectorAll(".pool-card").forEach((card, i) => {
      card.classList.toggle("pool-card--active", i === pouleIndex);
    });

    // Recentre sur les équipes de la poule
    const pBounds = markers
      .filter((m) => idsPoule.has(m.equipeId))
      .map((m) => m.getLatLng());
    if (pBounds.length) {
      map.fitBounds(
        pBounds.map((ll) => [ll.lat, ll.lng]),
        { padding: [60, 60], maxZoom: 10 },
      );
    }
  }*/

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
    const bounds = markers.map((m) => m.getLatLng());
    if (bounds.length) {
      map.fitBounds(
        bounds.map((ll) => [ll.lat, ll.lng]),
        { padding: [40, 40] },
      );
      map.once("moveend", () => {
        map.panBy([0, -38]);
      });
    }
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

    // Mise à jour de l'icône et du texte selon l'état
    if (actif) {
      btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Terminer la modification</span>`;
    } else {
      btn.innerHTML = `
            <svg id="icon-swap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
            </svg>
            <span>Modifier les poules</span>`;
    }

    if (badge) badge.classList.toggle("visible", actif);
    if (overlay) overlay.classList.toggle("visible", actif);
    if (hint)
      hint.textContent = actif
        ? "Cliquez sur deux équipes pour les échanger."
        : "";

    if (actif) {
      // Affichage de la notification pour guider l'utilisateur
      toast(
        "Mode édition : Cliquez sur deux équipes dans la grille ou sur la carte pour les échanger.",
        "info",
      );

      highlightPoule._actif = null;
      document
        .querySelectorAll(".pool-card")
        .forEach((c) => c.classList.remove("pool-card--active"));
      afficherPoules();
    } else {
      markers.forEach((m) => m.off("click"));
      highlightToutesLesPoules();
      afficherPoules();
    }
  }

  function effectuerEchange(sel, pi, eid) {
    const pA = poulesActuelles[sel.pi];
    const pB = poulesActuelles[pi];
    if (!pA || !pB) return;

    const iA = pA.equipes.findIndex((e) => e.id === sel.eid);
    const iB = pB.equipes.findIndex((e) => e.id === eid);

    if (iA === -1 || iB === -1) return;

    if (
      pA.equipes[iA].num_club === pB.equipes[iB].num_club ||
      (!verifierClubDansPoule(pA, pB.equipes[iB]) &&
        !verifierClubDansPoule(pB, pA.equipes[iA]))
    ) {
      [poulesActuelles[sel.pi].equipes[iA], poulesActuelles[pi].equipes[iB]] = [
        poulesActuelles[pi].equipes[iB],
        poulesActuelles[sel.pi].equipes[iA],
      ];

      poulesActuelles[sel.pi].distance_moyenne = calculerDistanceMoyenne(
        poulesActuelles[sel.pi],
      );
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

      const hint = document.getElementById("edit-hint");
      if (hint) {
        hint.textContent = "✓ Échange effectué.";
        setTimeout(() => {
          if (modeEdition)
            hint.textContent = "Cliquez sur deux équipes pour les échanger.";
        }, 2500);
      }

      return { succes: true };
    } else {
      //toast("Une équipe de ce club appartient déjà à cette poule", "error");
      if (verifierClubDansPoule(pA, pB.equipes[iB]))
        return { succes: false, poule: sel.pi };
      else return { succes: false, poule: pi };
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

        // Même poule ou deux exempts → changer la sélection
        if (
          selection.pi === pi ||
          (selection.eid === "exempt" && eid === "exempt")
        ) {
          selection.el.classList.remove("selected");
          selection = { pi, eid, el };
          el.classList.add("selected");
          return;
        }

        // Cas exempt
        const isExemptA = selection.eid === "exempt";
        const isExemptB = eid === "exempt";

        if (isExemptA && isExemptB) {
          toast("Impossible d'échanger deux exempts", "error");
          return;
        }

        const sel = selection;
        el.classList.add("selected");

        setTimeout(() => {
          if (!sel) return;

          let conflitPoule = null;
          let erreurExempt = false;

          if (isExemptA || isExemptB) {
            // logique transfert exempt — inchangée
            const nb_max_equipes = Math.max(
              ...poulesActuelles.map((p) => p.nb_max),
            );
            const pA = poulesActuelles[sel.pi];
            const pB = poulesActuelles[pi];
            const sourcePoule = isExemptB ? pA : pB;
            const destPoule = isExemptB ? pB : pA;
            const equipeId = isExemptB ? sel.eid : eid;

            const idx = sourcePoule.equipes.findIndex((e) => e.id === equipeId);
            const equipeObj = sourcePoule.equipes[idx];

            if (nb_max_equipes === sourcePoule.nb_max) {
              if (!verifierClubDansPoule(destPoule, equipeObj)) {
                sourcePoule.equipes.splice(idx, 1);
                sourcePoule.distance_moyenne =
                  calculerDistanceMoyenne(sourcePoule);
                sourcePoule.barycentre = calculerBarycentre(
                  sourcePoule.equipes,
                );
                sourcePoule.nb_max--;
                destPoule.nb_max++;
                ajouterEquipeDansPoule(destPoule, equipeObj);
                finaliserStatistiquesPoules(poulesActuelles);
              } else {
                /*toast(
                  "Il existe déjà une équipe du même club dans la poule de destination",
                  "error",
                );*/
                conflitPoule = sel.pi;
              }
            } else {
              //toast("Pas plus d'un exempt dans une poule", "error");
              erreurExempt = true;
            }
          } else {
            let reponse = effectuerEchange(sel, pi, eid);
            if (!reponse.succes) conflitPoule = reponse.poule;
          }

          selection = null;
          afficherPoules();
          highlightToutesLesPoules();
          if (conflitPoule !== null) {
            signalerConflitClub(conflitPoule);
            //signalerConflitClub(sel.pi);
          }
          if (erreurExempt) {
            signalerErreurExempt(pi);
          }
        }, 120);
      });
    });
  }

  function attacherListenersMarqueurs() {
    markers.forEach((m) => {
      m.off("click");

      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);

        const eid = m.equipeId;
        const pi = poulesActuelles.findIndex((p) =>
          p.equipes.some((eq) => eq.id === eid),
        );
        if (pi === -1) return;

        if (!selection) {
          selection = { pi, eid, el: null };
          m.setIcon(createPinIcon("#f59e0b", 1));
          m.setZIndexOffset(2000);
          const hint = document.getElementById("edit-hint");
          if (hint)
            hint.textContent = "Maintenant cliquez sur l'équipe à échanger.";
          return;
        }

        // Même équipe → désélection
        if (selection.eid === eid && selection.pi === pi) {
          selection = null;
          highlightToutesLesPoules();
          const hint = document.getElementById("edit-hint");
          if (hint)
            hint.textContent = "Cliquez sur deux équipes pour les échanger.";
          return;
        }

        // Même poule → changer la sélection
        if (selection.pi === pi) {
          highlightToutesLesPoules();
          selection = { pi, eid, el: null };
          m.setIcon(createPinIcon("#f59e0b", 1));
          m.setZIndexOffset(2000);
          return;
        }

        // 2ème sélection → swap
        const sel = selection;

        setTimeout(() => {
          if (!sel) return;

          // ← appel à la fonction commune
          effectuerEchange(sel, pi, eid);

          selection = null;
          afficherPoules();
          highlightToutesLesPoules();
          if (modeEdition) {
            attacherListenersEdition();
            attacherListenersMarqueurs();
          }
        }, 120);
      });
    });
  }

  function signalerConflitClub(pouleIndex) {
    // Vibration de la card
    const card = document.querySelectorAll(".pool-card")[pouleIndex];
    if (card) {
      card.classList.add("card-shake");
      setTimeout(() => card.classList.remove("card-shake"), 500);
    }

    // Toast warn (pas error) — léger et non bloquant
    toast("Conflit de club — même club déjà présent dans cette poule", "warn");
  }

  function signalerErreurExempt(pouleIndex) {
    const card = document.querySelectorAll(".pool-card")[pouleIndex];
    if (card) {
      card.classList.add("card-shake");
      setTimeout(() => card.classList.remove("card-shake"), 500);
    }
    toast("Pas plus d'un exempt par poule", "warn");
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

    if (btnEchange && !document.getElementById("btn-switch")) {
      btnEchange.innerHTML = `
        <button id="btn-switch" class="btn-switch-style" style="display: inline-flex; align-items: center; justify-content: center;">
            <svg id="icon-swap" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
            </svg>
            <span>Modifier les poules</span>
        </button>`;

      document.getElementById("btn-switch").addEventListener("click", () => {
        setModeEdition(!modeEdition);
      });
    }

    const nb_max_equipes = Math.max(...poulesActuelles.map((p) => p.nb_max));
    const isModeNiveau = config.mode === "niveau";

    grid.innerHTML = poulesActuelles
      .map((poule, pi) => {
        const lettre = poule.nom || String.fromCharCode(65 + pi);
        const couleur = PALETTE[pi % PALETTE.length];

        // Calcul du poids de la poule (toujours calculé)
        const difficultePoule = poule.equipes.reduce((acc, e) => {
          const statut = (e.statut_niveau || "").toLowerCase();
          if (statut.includes("+") || statut === "montante") return acc - 1;
          if (statut.includes("-") || statut === "descendante") return acc + 1;
          return acc;
        }, 0);

        let lignes = poule.equipes
          .map((e) => {
            const statut = (e.statut_niveau || "").toLowerCase();

            // En mode niveau : icône statut à taille fixe (flex-shrink:0) à la place du dot
            // En mode normal : dot coloré classique
            let prefixeHtml = "";
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

            return `
                <div class="pool-team-row${modeEdition ? " clickable" : ""}"
                     data-poule-index="${pi}"
                     data-equipe-id="${e.id}"
                     style="display:flex; align-items:center;">
                    ${prefixeHtml}
                    <span class="pool-team-name" style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${e.type === "CTC" ? e.ctc_nom : e.nom_club} — ${e.numero}
                    </span>
                    <span class="pool-team-club" style="flex-shrink:0; margin-left:8px;">
                      ${parseFloat(e.distance_totale || 0).toFixed(0)} Km
                    </span>
                </div>
            `;
          })
          .join("");

        if (poule.equipes.length < nb_max_equipes) {
          lignes += `
        <div class="pool-team-row${modeEdition ? " clickable" : ""}"
             data-poule-index="${pi}"
             data-equipe-id="exempt"
             style="display:flex; align-items:center; background-color: rgba(0, 0, 0, 0.05); color: #888; font-style: italic;">
            <span class="pool-team-dot" style="flex-shrink:0; background: #ccc; opacity: 0.5;"></span>
            <span style="flex:1;">Exempt</span>
            <span class="pool-team-club" style="flex-shrink:0;">-</span>
        </div>`;
        }

        // En-tête : toujours distance moyenne + poids (tous modes)
        const affichagePoids = difficultePoule > 0 ? `+${difficultePoule}` : difficultePoule;
        const statsEnteteHtml = `
          <div style="text-align:right; line-height:1.4;">
            <div style="font-weight:600; font-size:.7rem; color:var(--clr-surface-600)">
              Dist.Moy: ${parseFloat(poule.distance_moyenne || 0).toFixed(0)} km
            </div>
            <div style="font-size:0.7rem; color:#888; font-weight:normal">
              σ: ${parseFloat(poule.ecart_type || 0).toFixed(0)} km
            </div>
            ${isModeNiveau ? `
            <div style="font-weight:600; font-size:.7rem; color:var(--clr-surface-600); margin-top:2px;">
              Poids : ${affichagePoids}
            </div>` : ""}
          </div>`;

        /*return `
    <div class="pool-card" data-poule-index="${pi}">
        <div class="pool-card-head">
            <span class="pool-dot" style="background:${couleur}"></span>
            Poule ${lettre}
            <button
                class="pool-card-map-btn ${modeEdition ? "hidden" : ""}"
                data-poule-index="${pi}"
                title="Voir sur la carte">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </button>
            <div style="text-align:right; margin-left:auto;">
                ${statsEnteteHtml}
            </div>
        </div>
        ${lignes}
    </div>`;*/
    return `
    <div class="pool-card" data-poule-index="${pi}">
        <div class="pool-card-head">
            <span class="pool-dot" style="background:${couleur}"></span>
            Poule ${lettre}
            <span class="pool-card-hint" data-poule-index="${pi}" ${modeEdition ? 'style="display:none"' : ''}>
                voir sur carte
            </span>
            <div style="text-align:right;">
                ${statsEnteteHtml}
            </div>
        </div>
        ${lignes}
    </div>`;
      })
      .join("");

    if (modeEdition) {
      attacherListenersEdition();
      attacherListenersMarqueurs();
    } else {
      // Mode normal : listener highlight carte sur les cards uniquement
      document.querySelectorAll(".pool-card-hint").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // évite la propagation vers la card
          const pi = parseInt(btn.dataset.pouleIndex);
          highlightPoule(pi);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    }
  }
  /* ── INIT ───────────────────────────────────────────────────────────────── */
  updateTitre();
  renderStepper();
  afficherClubIngores();

  setTimeout(() => map.invalidateSize(), 100);

  /* ── RESTAURATION ───────────────────────────────────────────────────────── */
  const cle1 = `${config.categorie}-${config.genre}-${config.niveauActuel}`;
  const poulesStockees = localStorage.getItem(cle1);
  const cle2 = `csv_equipes_niveau${config.niveauActuel}`;
  const equipesStockees = localStorage.getItem(cle2);

  if (equipesStockees) {
    const csvStocke = localStorage.getItem(
      `csv_equipes_niveau${config.niveauActuel}`,
    );
    const csvNom = localStorage.getItem(`csv_nom_niveau${config.niveauActuel}`);

    if (csvStocke && csvNom) {
      const blob = new Blob([csvStocke], { type: "text/csv" });
      const file = new File([blob], csvNom, { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileLabel.innerHTML = `✓ ${csvNom}`;
    }
    equipesActuelles = equipesStockees ? JSON.parse(equipesStockees) : [];
    afficherCarte(equipesActuelles);
    if (poulesStockees) {
      try {
        //const poules = JSON.parse(poulesStockees);
        poulesActuelles = poulesStockees ? JSON.parse(poulesStockees) : [];
        if (poulesActuelles.length > 0) {
          document.getElementById("nb_poules").value = poulesActuelles.length;
          document.getElementById("nb_max_equipes").value = Math.max(
            ...poulesActuelles.map((p) => p.nb_max),
          );
        }
        afficherPoules();
        highlightToutesLesPoules();
      } catch (err) {
        console.warn("Erreur lors de la restauration des poules :", err);
      }
    }
  }
});

/*if (poulesStockees) {
    try {
      //const poules = JSON.parse(poulesStockees);
      poulesActuelles = poulesStockees ? JSON.parse(poulesStockees) : [];
      if (poulesActuelles.length > 0) {
        document.getElementById("nb_poules").value = poulesActuelles.length;
        document.getElementById("nb_max_equipes").value = Math.max(
          ...poulesActuelles.map((p) => p.nb_max),
        );

        equipesActuelles = equipesStockees ? JSON.parse(equipesStockees) : [];
        afficherCarte(equipesActuelles);
        afficherPoules();
        highlightToutesLesPoules();

        const csvStocke = localStorage.getItem(
          `csv_equipes_niveau${config.niveauActuel}`,
        );
        const csvNom = localStorage.getItem(
          `csv_nom_niveau${config.niveauActuel}`,
        );

        if (csvStocke && csvNom) {
          const blob = new Blob([csvStocke], { type: "text/csv" });
          const file = new File([blob], csvNom, { type: "text/csv" });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileLabel.innerHTML = `✓ ${csvNom}`;
        }
        toast(`Poules déjà générées pour ce niveau`, "info");
      }
    } catch (err) {
      console.warn("Erreur lors de la restauration des poules :", err);
    }
  }
});*/

/*function attacherListenersEdition() {
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
            // normalement ce cas ne paut jamais arriver car on ne peut pas sélectionner deux exempts
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
  }*/
/*[pA.equipes[iA], pB.equipes[iB]] = [
                  pB.equipes[iB],
                  pA.equipes[iA],
                ];*/
