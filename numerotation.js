import { toast, afficherErreur } from "./toast.js";

//let ClubsMap = {};
let Souhaits = {};
let Niveaux = {};

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================================
     NAVIGATION
  ============================================================ */
  document.getElementById("btn-prev").addEventListener("click", () => {
    window.location.href = "poule.html";
  });

  /* ============================================================
     PARSING DES FICHIERS
  ============================================================ */

  /**
   * { "PDL0049126": "synchronise", ... }
   */
  function parseSouhaits(csvContent) {
    const lignes = csvContent.split("\n").slice(1);
    const souhaits = {};

    for (let i = 0; i < lignes.length; i++) {
      if (lignes[i].trim() === "") continue;
      const [numClub, souhait] = lignes[i].split(",").map((c) => c.trim());

      if (
        !["sans_preference", "synchronise", "reparti"].includes(
          souhait.toLowerCase(),
        )
      ) {
        return {
          succes: false,
          message: `Souhait inconnu ligne ${i + 2} : "${souhait}"`,
        };
      }
      if (numClub) souhaits[numClub.trim()] = souhait.toLowerCase();
    }
    return { succes: true, donnees: souhaits };
  }

  /**
   * {
   *   "PDL0049095": [
   *      { categorie: "senior", niveau: 2, poule: "B", nom: "CTC LOIRE ET PLAINE-2" },
   *      { categorie: "senior", niveau: 2, poule: "C", nom: "ETOILE ANGERS-2" },
   *      ...
   *   ]
   * }
   */
  /*function parseClubs(csvContent) {
    const lignes = csvContent.split("\n").slice(1);
    const clubsMap = {};

    lignes.forEach(ligne => {
      if (ligne.trim() === "") return;
      const [cat, niv, poule, nomEquipe, numClub] = ligne.split(",");
      if (!numClub) return{ succes: false, message: "Veuillez déposer un fichier valide" };

      const cleanClub = numClub.trim();
      if (!clubsMap[cleanClub]) clubsMap[cleanClub] = [];

      clubsMap[cleanClub].push({
        categorie: cat,
        niveau: niv,
        poule: poule,
        nom: nomEquipe,
        idUniquePoule: `${cat}-${niv}-${poule}`,
      });
    });
    return { succes: true, donnees: clubsMap };
  }*/

  /**
   * Parse le fichier des poules pour construire Niveaux
   * Niveaux[n] = { categorie, poules: { "A": [ { nomEquipe, numClub, numeroAttribue } ] } }
   */
  function parsePoules(csvContenu) {
    const lignes = csvContenu.split("\n").slice(1);
    const niveaux = {};

    for (let i = 0; i < lignes.length; i++) {
      if (lignes[i].trim() === "") continue;
      const [categorie, niveau, poule, nomEquipe, numClub] =
        lignes[i].split(",");

      if (!numClub)
        return { succes: false, message: "Veuillez déposer un fichier valide" };

      const niv = parseInt(niveau?.trim());
      if (isNaN(niv)) continue;

      if (!niveaux[niv])
        niveaux[niv] = { categorie: categorie?.trim(), poules: {} };
      if (!niveaux[niv].poules[poule?.trim()])
        niveaux[niv].poules[poule?.trim()] = [];

      niveaux[niv].poules[poule?.trim()].push({
        nomEquipe: nomEquipe?.trim(),
        numClub: numClub?.trim(),
        numeroAttribue: null,
      });
    }
    return { succes: true, donnees: niveaux };
  }

  /* ============================================================
     LISTENERS FICHIERS
  ============================================================ */

  const PoulesInput = document.getElementById("file-poules");
  const PoulesLabel = document.getElementById("label-poules");

  PoulesInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const contenu = evt.target.result;
      const resultat = parsePoules(contenu);
      if (!resultat.succes) {
        afficherErreur("Fichier Poules invalide", resultat.message);
        return;
      }
      //ClubsMap = resultat.donnees;
      Niveaux = resultat.donnees;
      PoulesLabel.innerHTML = `${file.name}`;
      //PoulesLabel.style.color = "#16a34a";
      //console.log("ClubsMap :", ClubsMap);
      console.log("Niveaux :", Niveaux);
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  const SouhaitsInput = document.getElementById("file-souhaits");
  const SouhaitsLabel = document.getElementById("label-souhaits");

  SouhaitsInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const contenu = evt.target.result;
      const resultat = parseSouhaits(contenu);
      if (!resultat.succes) {
        afficherErreur("Fichier Souhaits invalide", resultat.message);
        return;
      }
      Souhaits = resultat.donnees;
      SouhaitsLabel.innerHTML = `${file.name}`;
      //SouhaitsLabel.style.color = "#16a34a";
      console.log("Souhaits :", Souhaits);
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  /* ============================================================
     VÉRIFICATIONS
  ============================================================ */

  /**
   * Vérifie que toutes les poules (tous niveaux confondus) ont la même taille
   */
  function verifierTailleUniforme() {
    let tailleReference = -1;
    let NomPremierePoule = "";

    for (const niv in Niveaux) {
      for (const nomPoule in Niveaux[niv].poules) {
        const taille = Niveaux[niv].poules[nomPoule].length;
        if (tailleReference === -1) {
          tailleReference = taille;
          NomPremierePoule = `Poule ${nomPoule} niveau ${niv}`;
          continue;
        }
        if (taille !== tailleReference) {
          return {
            valide: false,
            titre: "Conflit de taille de poules",
            message: `La poule ${nomPoule} du niveau ${niv} a ${taille} équipe(s), alors que ${NomPremierePoule} en a ${tailleReference}. Toutes les poules doivent avoir la même taille.`,
          };
        }
      }
    }
    return { valide: true, tailleCommune: tailleReference };
  }

  /* ============================================================
     ALGORITHME DE NUMÉROTATION
  ============================================================ */

  /**
   * Attribue les numéros à toutes les équipes de toutes les poules.
   * Étapes :
   *   1. Clubs "synchronise"  → même numéro pour toutes leurs équipes
   *   2. Clubs "reparti"      → moitié dans [1..T/2], moitié dans [T/2+1..T]
   *   3. Clubs sans souhait + exempts → numéros restants libres
   */
  function attribuerNumeros(T) {
    // slots[idUniquePoule] = Set des numéros déjà pris dans cette poule
    const slotsOccupes = {};
    for (const niv in Niveaux) {
      for (const nomPoule in Niveaux[niv].poules) {
        const id = `${Niveaux[niv].categorie}-${niv}-${nomPoule}`;
        slotsOccupes[id] = new Set();
      }
    }

    // ── Helpers ─────────────────────────────────────────────────────

    /** Trouve un numéro libre dans une poule parmi une liste de candidats */
    function trouverSlotLibre(idPoule, candidats) {
      for (const n of candidats) {
        if (!slotsOccupes[idPoule].has(n)) return n;
      }
      return null;
    }

    /** Attribue un numéro à une équipe et marque le slot occupé */
    function attribuer(equipe, idPoule, numero) {
      equipe.numeroAttribue = numero;
      slotsOccupes[idPoule].add(numero);
    }

    /** Renvoie toutes les équipes d'un club dans Niveaux (avec référence directe) */
    function getEquipesClub(numClub) {
      const result = [];
      for (const niv in Niveaux) {
        for (const nomPoule in Niveaux[niv].poules) {
          for (const equipe of Niveaux[niv].poules[nomPoule]) {
            if (equipe.numClub === numClub) {
              result.push({
                equipe,
                idPoule: `${Niveaux[niv].categorie}-${niv}-${nomPoule}`,
              });
            }
          }
        }
      }
      return result;
    }

    // ── ÉTAPE 1 : Clubs "synchronise" ───────────────────────────────
    const clubsSynchro = Object.keys(Souhaits).filter(c => Souhaits[c] === "synchronise");

    for (const numClub of clubsSynchro) {
      const equipesClub = getEquipesClub(numClub);
      if (equipesClub.length === 0) continue; // club non présent dans les poules

      // Trouver un numéro libre dans TOUTES les poules de ce club simultanément
      let numeroChoisi = null;

      for (let n = 1; n <= T; n++) {
        // Ce numéro doit être libre dans toutes les poules où ce club a une équipe
        const librePartout = equipesClub.every(
          ({ idPoule }) => !slotsOccupes[idPoule].has(n),
        );
        if (librePartout) {
          numeroChoisi = n;
          break;
        }
      }

      if (numeroChoisi === null) {
        return {
          succes: false,
          message: `Impossible d'attribuer un numéro synchronisé au club ${numClub}. Veuillez modifier les souhaits de ce club ou des clubs en conflit.`,
        };
      }

      // Attribuer le même numéro à toutes ses équipes
      for (const { equipe, idPoule } of equipesClub) {
        attribuer(equipe, idPoule, numeroChoisi);
      }
    }

    // ── ÉTAPE 2 : Clubs "reparti" ────────────────────────────────────

    function combinaisons(tableau, k) {
      if (k === 0) return [[]];
      if (k === tableau.length) return [tableau];
      const [premier, ...reste] = tableau;
      const avecPremier = combinaisons(reste, k - 1).map(c => [premier, ...c]);
      const sansPremier = combinaisons(reste, k);
      return [...avecPremier, ...sansPremier];
    }

    const clubsReparti = Object.keys(Souhaits).filter(c => Souhaits[c] === "reparti");

    /*for (const numClub of clubsReparti) {
      const equipesClub = getEquipesClub(numClub)
        .filter(({ equipe }) => equipe.numeroAttribue === null);

      if (equipesClub.length === 0) continue;

      // Club avec une seule équipe sera traité en étape 3
      if (equipesClub.length === 1) continue;

      const demiT = Math.floor(T / 2);
      const nb = equipesClub.length;
      const nbImpair = nb % 2 !== 0;

      // Tailles des deux moitiés à tester
      // Si pair   : une seule combinaison de tailles (nb/2, nb/2)
      // Si impair : deux combinaisons de tailles (floor, ceil) et (ceil, floor)
      const taillesBas = nbImpair
        ? [Math.floor(nb / 2), Math.ceil(nb / 2)]
        : [nb / 2];

      let NumeroTrouve = false;

      for (const tailleBas of taillesBas) {
        if (NumeroTrouve) break;

        const tailleHaut = nb - tailleBas;

        // Toutes les combinaisons possibles pour la moitié basse
        const combsBas = combinaisons(equipesClub, tailleBas);

        for (const moitieBasse of combsBas) {
          if (NumeroTrouve) break;

          const moitieHaute = equipesClub.filter(e => !moitieBasse.includes(e));

          // Chercher une paire (n, n+T/2) libre dans toutes les poules concernées
          for (let n = 1; n <= demiT; n++) {
            const nOppose = n + demiT;

            const libreBasPartout = moitieBasse.every(({ idPoule }) => !slotsOccupes[idPoule].has(n));
            const libreHautPartout = moitieHaute.every(({ idPoule }) => !slotsOccupes[idPoule].has(nOppose));

            if (!libreBasPartout || !libreHautPartout) continue;

            // ── Bonne combinaison trouvée
            for (const { equipe, idPoule } of moitieBasse) {
              attribuer(equipe, idPoule, n);
            }
            for (const { equipe, idPoule } of moitieHaute) {
              attribuer(equipe, idPoule, nOppose);
            }

            NumeroTrouve = true;
            break;
          }
        }
      }

      if (!NumeroTrouve) {
        return {
          succes: false,
          message: `Impossible de répartir les équipes du club ${numClub} en numéros opposés quelle que soit la combinaison. Veuillez modifier les souhaits.`,
        };
      }
    }*/
    for (const numClub of clubsReparti) {
      const equipesClub = getEquipesClub(numClub)
        .filter(({ equipe }) => equipe.numeroAttribue === null);

      if (equipesClub.length === 0) continue;

      // Club avec une seule équipe sera traité en étape 3
      if (equipesClub.length === 1) continue;

      const demiT = Math.floor(T / 2);
      const nb = equipesClub.length;

      const tailleBas = Math.floor(nb / 2);
      const tailleHaut = nb - tailleBas;

      let NumeroTrouve = false;

      // Toutes les combinaisons possibles pour la moitié basse
      const combsBas = combinaisons(equipesClub, tailleBas);

      for (const moitieBasse of combsBas) {
        if (NumeroTrouve) break;

        const moitieHaute = equipesClub.filter(e => !moitieBasse.includes(e));

        // Chercher une paire (n, n+T/2) libre dans toutes les poules concernées
        for (let n = 1; n <= demiT; n++) {
          const nOppose = n + demiT;

          // On définit les deux configurations possibles à tester
          const configurations = [
            { bas: n, haut: nOppose },
            { bas: nOppose, haut: n }
          ];

          // On cherche la première configuration qui fonctionne
          const configValide = configurations.find(conf =>
            moitieBasse.every(({ idPoule }) => !slotsOccupes[idPoule].has(conf.bas)) &&
            moitieHaute.every(({ idPoule }) => !slotsOccupes[idPoule].has(conf.haut))
          );

          if (configValide) {
            // ── Une seule logique d'attribution pour les deux cas
            for (const { equipe, idPoule } of moitieBasse) {
              attribuer(equipe, idPoule, configValide.bas);
            }
            for (const { equipe, idPoule } of moitieHaute) {
              attribuer(equipe, idPoule, configValide.haut);
            }

            NumeroTrouve = true;
            break;
          }
        }
      }


      if (!NumeroTrouve) {
        return {
          succes: false,
          message: `Impossible de répartir les équipes du club ${numClub} en numéros opposés quelle que soit la combinaison. Veuillez modifier les souhaits.`,
        };
      }
    }

    // ── ÉTAPE 3 : Tous les restants (sans_preference + exempts) ─────
    for (const niv in Niveaux) {
      for (const nomPoule in Niveaux[niv].poules) {
        const idPoule = `${Niveaux[niv].categorie}-${niv}-${nomPoule}`;
        const tousSlots = Array.from({ length: T }, (_, i) => i + 1);

        for (const equipe of Niveaux[niv].poules[nomPoule]) {
          if (equipe.numeroAttribue !== null) continue; // déjà attribuée

          const slot = trouverSlotLibre(idPoule, tousSlots);
          if (slot === null) {
            return {
              succes: false,
              message: `Plus de slots disponibles dans la poule ${nomPoule} niveau ${niv}. Vérifiez la cohérence des données.`,
            };
          }
          attribuer(equipe, idPoule, slot);
        }
      }
    }

    return { succes: true };
  }

  /* ============================================================
     EXPORT CSV & Excel
  ============================================================ */
  function exporterResultatCSV() {
    const lignes = ["Catégorie,Niveau,Poule,N° Équipe,N° Club,Numéro"];

    for (const niv in Niveaux) {
      const { categorie, poules } = Niveaux[niv];
      for (const nomPoule in poules) {
        for (const equipe of poules[nomPoule]) {
          lignes.push(
            [
              categorie,
              niv,
              nomPoule,
              equipe.nomEquipe,
              equipe.numClub,
              equipe.numeroAttribue ?? "",
            ].join(","),
          );
        }
      }
    }

    const contenu = lignes.join("\n");
    const blob = new Blob(["\uFEFF" + contenu], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "poules_numerotees.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast("Fichier CSV exporté avec succès.", "success");
  }

  function exporterResultatExcel() {
    if (typeof XLSX === "undefined") {
      toast("Bibliothèque Excel non chargée.", "error");
      return;
    }

    const wb = XLSX.utils.book_new();
    const rows = [];
    rows.push([
      `Catégorie`,
      `Niveau`,
      `Poule`,
      `Équipe`,
      `Club`,
      `N° Équipe`
    ]);
    for (const niv in Niveaux) {
      const { categorie, poules } = Niveaux[niv];
      for (const nomPoule in poules) {
        for (const equipe of poules[nomPoule]) {
          rows.push([categorie, niv, nomPoule, equipe.nomEquipe, equipe.numClub, equipe.numeroAttribue ?? ""]);
        }
      }
    }

    // Créer la feuille
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Largeurs de colonnes
    ws["!cols"] = [{ wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 56 }, { wch: 15 }, { wch: 15 }];

    //const nomFeuille = `Équipes Numérotées`;
    XLSX.utils.book_append_sheet(wb, ws);

    // Téléchargement
    const nomFichier = `poules_numerotees.xlsx`;
    XLSX.writeFile(wb, nomFichier);
    toast("Fichier Excel exporté avec succès.", "success");
  }

  /* ============================================================
     BOUTON GÉNÉRER
  ============================================================ */

  document.getElementById("btn-generer").addEventListener("click", () => {
    if (Object.keys(Niveaux).length === 0) {
      toast("Veuillez d'abord déposer le fichier des poules générées.", "warn");
      return;
    }
    if (Object.keys(Souhaits).length === 0) {
      toast("Veuillez d'abord déposer le fichier des souhaits.", "warn");
      return;
    }

    // Vérification tailles uniformes
    const check = verifierTailleUniforme();
    if (!check.valide) {
      afficherErreur(check.titre, check.message);
      return;
    }

    // Réinitialiser tous les numéros attribués (en cas de re-génération)
    for (const niv in Niveaux) {
      for (const nomPoule in Niveaux[niv].poules) {
        for (const equipe of Niveaux[niv].poules[nomPoule]) {
          equipe.numeroAttribue = null;
        }
      }
    }

    // Lancer la numérotation
    const resultat = attribuerNumeros(check.tailleCommune);

    if (!resultat.succes) {
      afficherErreur("Impossible de générer la numérotation", resultat.message);
      return;
    }

    toast(`Numérotation générée avec succès.`, "success");
    console.log("Niveaux numérotés :", Niveaux);

    // Afficher le panel export
    const panelExport = document.getElementById("panel-export");
    if (panelExport) panelExport.style.display = "block";

    // Afficher le résultat dans l'interface
    afficherResultat();
  });

  /* ============================================================
     AFFICHAGE DU RÉSULTAT
  ============================================================ */

  function afficherResultat() {
    const container = document.getElementById("calendrier-content");
    const tabsBar = document.getElementById("tabs-bar");
    const niveauxIds = Object.keys(Niveaux).sort((a, b) => a - b);

    tabsBar.innerHTML = niveauxIds
      .map(
        (niv) => `
      <button class="tab-btn" data-niveau="${niv}">Niveau ${niv}</button>
    `,
      )
      .join("");

    let niveauActif = niveauxIds[0];

    function renderNiveau(niv) {
      const { categorie, poules } = Niveaux[niv];

      const blocsPoules = Object.entries(poules)
        .map(([nomPoule, equipes]) => {
          const lignes = equipes
            .map(
              (e) => {
                const estExempt = e.nomEquipe === "Exempt";
                const styleExempt = estExempt
                  ? 'style="background-color: rgba(0, 0, 0, 0.05); color: #888; font-style: italic;"'
                  : "";
                return `
          <tr ${styleExempt}>
            <td class="td-numero">${e.numeroAttribue ?? "—"}</td>
            <td class="td-nomEquipe">${e.nomEquipe}</td>
            <td class="td-club">${e.numClub}</td>
            <td class="td-souhait">${Souhaits[e.numClub] ?? "—"}</td>
          </tr>
        `;
              })
            .join("");

          const nombreEquipesReelles = equipes.filter(e => e.nomEquipe !== "Exempt").length;
          return `
          <div class="calendrier-bloc">
            <div class="calendrier-bloc-header">
              <span class="calendrier-bloc-title">Poule ${nomPoule}</span>
              <span style="font-size:.78rem;color:var(--clr-surface-400)">
                ${nombreEquipesReelles} équipes
              </span>
            </div>
            <table class="calendrier-table" style="table-layout:fixed">
              <thead>
                <tr>
                  <th style="text-align: center">Numéro</th>
                  <th>Équipe</th>
                  <th>Club</th>
                  <th>Souhait</th>
                </tr>
              </thead>
              <tbody>${lignes}</tbody>
            </table>
          </div>
        `;
        })
        .join("");

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">
          ${blocsPoules}
        </div>
      `;
    }

    // Render initial
    renderNiveau(niveauActif);

    // Activer le premier onglet
    tabsBar.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.niveau === String(niveauActif),
      );
      btn.addEventListener("click", () => {
        niveauActif = btn.dataset.niveau;
        tabsBar
          .querySelectorAll(".tab-btn")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.niveau === niveauActif),
          );
        renderNiveau(niveauActif);
      });
    });
  }

  /* ============================================================
     BOUTONS EXPORT
  ============================================================ */

  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    exporterResultatCSV();
  });

  document.getElementById("btn-export-excel")?.addEventListener("click", () => {
    //toast("Export Excel — à implémenter avec SheetJS.", "info");
    exporterResultatExcel();
  });
});

