import {
  traiterCSV,
  definirCapacitesPoules,
  initialiserPoules,
  verifierClubDansPoule,
  calculerBarycentre,
  calculerDistanceMoyenne,
  finaliserStatistiquesPoules,
} from "./calcul-poules.js";

import { distance } from "./matrice-distances.js";

let config = JSON.parse(localStorage.getItem("championnatConfig"));

const ORDRE_STATUTS = ["-", "+", "="];

// --------- Comptage des occurrences de club -------------------------

function compterOccurrencesClub(equipes) {
  const occ = {};
  for (const e of equipes) {
    occ[e.nom_club] = (occ[e.nom_club] || 0) + 1;
  }
  return occ;
}

// --------- Calcul des quotas par statut -----------------------------

function calculerQuotasParStatut(equipes, nb_poules) {
  const compteurs = { "-": 0, "=": 0, "+": 0 };
  for (const eq of equipes) {
    if (eq.statut_niveau in compteurs) {
      compteurs[eq.statut_niveau]++;
    }
  }

  const quotas = {};
  ORDRE_STATUTS.forEach((statut) => {
    const total = compteurs[statut];
    const base = Math.floor(total / nb_poules);
    const reste = total % nb_poules;
    const brut = Array.from({ length: nb_poules }, (_, i) =>
      i < reste ? base + 1 : base,
    );
    quotas[statut] = brut;
  });

  return quotas;
}

// --------- Ajout d'une équipe dans une poule -------------------------

function ajouterEquipeDansPouleNiveau(poule, equipe) {
  if (!verifierClubDansPoule(poule, equipe)) {
    poule.equipes.push(equipe);
    poule.barycentre = calculerBarycentre(poule.equipes);
    poule.distance_moyenne = calculerDistanceMoyenne(poule);
    return true;
  }
  return false;
}

//Vérifie que les équipes montantes (+) et descendantes (-) sont en effectifs égaux.
 
 
function verifierEquilibreMontantesDescendantes(equipes) {
    const montantes = equipes.filter(e => e.statut_niveau === "+").length;
    const descendantes = equipes.filter(e => e.statut_niveau === "-").length;
    const ecart = Math.abs(montantes - descendantes);
    const equilibre = montantes === descendantes;

    return equilibre;
}

// --------- Distribution gloutonne par statut -------------------------

function distribuerEquipesNiveau(poules, equipes, quotas) {
  const quotasRestants = {};
  ORDRE_STATUTS.forEach((s) => {
    quotasRestants[s] = [...quotas[s]];
  });

  // Degré de contrainte de chaque équipe : un club partagé par plusieurs
  // équipes est plus difficile à répartir (conflits de poule). On place
  // ces équipes EN PREMIER, tant qu'il reste un maximum de poules libres.
  const occClub = compterOccurrencesClub(equipes);

  for (const statut of ORDRE_STATUTS) {
    // Tri : équipes les plus contraintes d'abord (club très partagé),
    // puis, à contrainte égale, par distance_totale décroissante pour
    // garder un comportement déterministe et stable.
    let restantes = equipes
      .filter((e) => e.statut_niveau === statut)
      .sort((a, b) => {
        const diffContrainte = occClub[b.nom_club] - occClub[a.nom_club];
        if (diffContrainte !== 0) return diffContrainte;
        return (
          parseFloat(b.distance_totale || 0) -
          parseFloat(a.distance_totale || 0)
        );
      });

    while (restantes.length > 0) {
      let placeeDansCeTour = false;

      // ── Tour normal : respect des quotas ──
      for (let p = 0; p < poules.length; p++) {
        if (quotasRestants[statut][p] <= 0) continue;
        if (poules[p].equipes.length >= poules[p].nb_max) continue;
        if (restantes.length === 0) break;

        const idxChoisi = restantes.findIndex(
          (eq) => !verifierClubDansPoule(poules[p], eq),
        );

        if (idxChoisi === -1) {
          const clubsDejaPresents = [
            ...new Set(poules[p].equipes.map((eq) => eq.nom_club)),
          ];
          console.warn(
            `[genererPoulesNiveau] Conflit club dans la poule "${poules[p].nom}" (statut "${statut}").\n` +
              `  → Clubs déjà présents : ${clubsDejaPresents.join(", ")}\n` +
              `  → Passage à la poule suivante.`,
          );
          continue;
        }

        const choix = restantes[idxChoisi];
        if (ajouterEquipeDansPouleNiveau(poules[p], choix)) {
          quotasRestants[statut][p]--;
          restantes.splice(idxChoisi, 1);
          placeeDansCeTour = true;
        }
      }

      if (placeeDansCeTour) continue;

      // ── Placement de secours ──
      // Plus aucune équipe ne rentre via les quotas. On lève la contrainte
      // de quota (qui n'est qu'indicative) tout en gardant `nb_max` et la
      // contrainte de club, qui sont des règles dures.
      console.warn(
        `[genererPoulesNiveau] ${restantes.length} équipe(s) "${statut}" non placée(s) ` +
          `par les quotas — placement de secours (quotas révisés).\n` +
          `  → Équipes : ${restantes.map((e) => `${e.nom_club} ${e.numero}`).join(", ")}`,
      );

      const nonPlacees = [];

      for (const eq of restantes) {
        // 1) Placement direct, quota ignoré : poule la moins remplie
        //    ayant de la place ET pas de conflit de club.
        let cible = -1;
        let minTaille = Infinity;
        for (let p = 0; p < poules.length; p++) {
          if (poules[p].equipes.length >= poules[p].nb_max) continue;
          if (verifierClubDansPoule(poules[p], eq)) continue;
          if (poules[p].equipes.length < minTaille) {
            minTaille = poules[p].equipes.length;
            cible = p;
          }
        }

        if (cible !== -1) {
          if (ajouterEquipeDansPouleNiveau(poules[cible], eq)) {
            // On décrémente le quota du statut sur cette poule si possible,
            // pour que la comptabilité reste cohérente (sans descendre < 0).
            if (quotasRestants[statut][cible] > 0) {
              quotasRestants[statut][cible]--;
            }
            console.info(
              `[genererPoulesNiveau] Secours direct (quota révisé) : ` +
                `"${eq.nom_club} ${eq.numero}" → poule "${poules[cible].nom}" ` +
                `[${poules[cible].equipes.length}/${poules[cible].nb_max}].`,
            );
            continue;
          }
        }

        // 2) Aucune poule directement compatible → swap (chaîne de déplacements)
        const swapReussi = tenterSwapSecours(poules, eq);
        if (swapReussi) continue;

        // 3) Ni placement direct, ni swap possible
        nonPlacees.push(eq);
      }

      if (nonPlacees.length > 0) {
        const etatPoules = poules.map(
          (p) =>
            `"${p.nom}" [${p.equipes.length}/${p.nb_max}] clubs: ` +
            `${[...new Set(p.equipes.map((e) => e.nom_club))].join(", ") || "—"}`,
        );
        console.error(
          `[genererPoulesNiveau] ÉCHEC CRITIQUE : ${nonPlacees.length} équipe(s) "${statut}" ` +
            `non plaçable(s), même avec échange en chaîne.\n` +
            `  → Équipes non placées : ${nonPlacees.map((e) => `${e.nom_club} ${e.numero}`).join(", ")}\n` +
            `  → État des poules :\n${etatPoules.map((l) => `      ${l}`).join("\n")}`,
        );
      }

      restantes = [];
    }
  }
}


function tenterSwapSecours(poules, eq) {
  // ── Stratégie A : échange à trois ──
  const ciblesAvecPlace = poules
    .map((p, i) => ({ i, taille: p.equipes.length, nb_max: p.nb_max }))
    .filter((c) => c.taille < c.nb_max)
    .sort((a, b) => a.taille - b.taille);

  for (const { i: idxCible } of ciblesAvecPlace) {
    const pouleCible = poules[idxCible];

    // Si pas de conflit, le placement direct aurait suffi : rien à swapper.
    if (!verifierClubDansPoule(pouleCible, eq)) continue;

    for (let s = 0; s < pouleCible.equipes.length; s++) {
      const eqSortante = pouleCible.equipes[s];
      // On privilégie un échange à statut constant pour préserver l'équilibre.
      if (eqSortante.statut_niveau !== eq.statut_niveau) continue;

      const cibleSansSortante = {
        ...pouleCible,
        equipes: pouleCible.equipes.filter((_, k) => k !== s),
      };
      if (verifierClubDansPoule(cibleSansSortante, eq)) continue;

      for (let a = 0; a < poules.length; a++) {
        if (a === idxCible) continue;
        const pouleAccueil = poules[a];
        if (pouleAccueil.equipes.length >= pouleAccueil.nb_max) continue;
        if (verifierClubDansPoule(pouleAccueil, eqSortante)) continue;

        // Trio valide : on exécute.
        pouleCible.equipes.splice(s, 1);
        pouleAccueil.equipes.push(eqSortante);
        pouleCible.equipes.push(eq);

        [pouleCible, pouleAccueil].forEach((pl) => {
          pl.barycentre = calculerBarycentre(pl.equipes);
          pl.distance_moyenne = calculerDistanceMoyenne(pl);
        });

        console.info(
          `[genererPoulesNiveau] Secours par échange à trois : ` +
            `"${eqSortante.nom_club} ${eqSortante.numero}" déplacée de "${pouleCible.nom}" vers "${pouleAccueil.nom}", ` +
            `ce qui libère une place pour "${eq.nom_club} ${eq.numero}" dans "${pouleCible.nom}".`,
        );
        return true;
      }
    }
  }

  // ── Stratégie B : échange en chaîne ──
  // Toutes les poules où `eq` pourrait entrer sont pleines. On cherche, pour
  // chaque poule "cible" compatible (une fois une sortante retirée), une
  // chaîne de déplacements qui réabsorbe la sortante.
  for (let idxCible = 0; idxCible < poules.length; idxCible++) {
    const pouleCible = poules[idxCible];

    // Trie les sortantes candidates : même statut d'abord (équilibre), puis
    // statut différent en dernier recours.
    const indicesSortantes = pouleCible.equipes
      .map((_, s) => s)
      .sort((s1, s2) => {
        const m1 =
          pouleCible.equipes[s1].statut_niveau === eq.statut_niveau ? 0 : 1;
        const m2 =
          pouleCible.equipes[s2].statut_niveau === eq.statut_niveau ? 0 : 1;
        return m1 - m2;
      });

    for (const s of indicesSortantes) {
      const eqSortante = pouleCible.equipes[s];

      // `eq` doit pouvoir entrer dans la cible une fois la sortante retirée.
      const cibleSansSortante = {
        ...pouleCible,
        equipes: pouleCible.equipes.filter((_, k) => k !== s),
      };
      if (verifierClubDansPoule(cibleSansSortante, eq)) continue;

      // Cherche une chaîne de réabsorption pour la sortante.
      const chaine = trouverChaineReabsorption(
        poules,
        eqSortante,
        idxCible, // la poule cible est "réservée" pour eq, interdite à la chaîne
      );

      if (chaine) {
        // Exécution : on applique d'abord la chaîne (du dernier maillon vers
        // le premier n'est pas nécessaire ; chaque maillon i déplace l'équipe
        // de poules[chaine[i].depuis] vers poules[chaine[i].vers]).
        appliquerChaine(poules, chaine);

        // Puis on place eqSortante dans sa destination finale, et eq dans la cible.
        // La chaîne renvoyée gère déjà eqSortante : son premier maillon part
        // de la cible. On retire donc eqSortante de la cible ici n'est pas
        // requis car appliquerChaine l'a fait. On place juste eq.
        pouleCible.equipes.push(eq);
        pouleCible.barycentre = calculerBarycentre(pouleCible.equipes);
        pouleCible.distance_moyenne = calculerDistanceMoyenne(pouleCible);

        console.info(
          `[genererPoulesNiveau] Secours par échange en chaîne : ` +
            `"${eq.nom_club} ${eq.numero}" placée dans "${pouleCible.nom}" ` +
            `via une chaîne de ${chaine.length} déplacement(s).`,
        );
        return true;
      }
    }
  }

  return false;
}


function trouverChaineReabsorption(poules, equipe, idxInterdit) {
  // BFS sur les poules. Un "état" = (équipe à recaser, index de sa poule
  // actuelle, ensemble des poules déjà visitées, chaîne construite).
  const idxDepart = poules.findIndex((p) =>
    p.equipes.some((e) => e === equipe),
  );
  if (idxDepart === -1) return null;

  const file = [
    {
      equipe,
      idxActuel: idxDepart,
      visitees: new Set([idxDepart]),
      chaine: [],
    },
  ];

  while (file.length > 0) {
    const etat = file.shift();

    for (let dest = 0; dest < poules.length; dest++) {
      if (dest === etat.idxActuel) continue;
      if (dest === idxInterdit) continue;
      if (etat.visitees.has(dest)) continue;

      const pouleDest = poules[dest];
      if (verifierClubDansPoule(pouleDest, etat.equipe)) continue;

      const maillon = {
        equipe: etat.equipe,
        depuis: etat.idxActuel,
        vers: dest,
      };
      const nouvelleChaine = [...etat.chaine, maillon];

      // Cas terminal : la destination a de la place → chaîne complète.
      if (pouleDest.equipes.length < pouleDest.nb_max) {
        return nouvelleChaine;
      }

      // Sinon, la destination est pleine : il faut déloger une de ses
      // équipes pour continuer la chaîne.
      for (const eqAEvincer of pouleDest.equipes) {
        file.push({
          equipe: eqAEvincer,
          idxActuel: dest,
          visitees: new Set([...etat.visitees, dest]),
          chaine: nouvelleChaine,
        });
      }
    }
  }

  return null;
}


function appliquerChaine(poules, chaine) {
  const poulesTouchees = new Set();

  for (let i = chaine.length - 1; i >= 0; i--) {
    const { equipe, depuis, vers } = chaine[i];
    const pouleDepuis = poules[depuis];
    const pouleVers = poules[vers];

    const idx = pouleDepuis.equipes.indexOf(equipe);
    if (idx !== -1) {
      pouleDepuis.equipes.splice(idx, 1);
    }
    pouleVers.equipes.push(equipe);

    poulesTouchees.add(depuis);
    poulesTouchees.add(vers);
  }

  for (const idx of poulesTouchees) {
    poules[idx].barycentre = calculerBarycentre(poules[idx].equipes);
    poules[idx].distance_moyenne = calculerDistanceMoyenne(poules[idx]);
  }
}

function sommeDistancesPoule(poule) {
  let total = 0;
  const eqs = poule.equipes;
  for (let i = 0; i < eqs.length; i++) {
    for (let j = i + 1; j < eqs.length; j++) {
      total += distance(eqs[i], eqs[j]);
    }
  }
  return total;
}

function sommeDistancesGlobale(poules) {
  return poules.reduce((s, p) => s + sommeDistancesPoule(p), 0);
}

// --------- Optimisation par échanges intra-statut --------------------

function optimiserDistances(poules, maxPasses = 20) {
  let scoreCourant = sommeDistancesGlobale(poules);
  let passe = 0;

  while (passe < maxPasses) {
    let ameliore = false;

    for (let pa = 0; pa < poules.length; pa++) {
      for (let pb = pa + 1; pb < poules.length; pb++) {
        const eqsA = poules[pa].equipes;
        const eqsB = poules[pb].equipes;

        for (let ia = 0; ia < eqsA.length; ia++) {
          for (let ib = 0; ib < eqsB.length; ib++) {
            const eqA = eqsA[ia];
            const eqB = eqsB[ib];

            if (eqA.statut_niveau !== eqB.statut_niveau) continue;

            const pouleASansA = {
              ...poules[pa],
              equipes: eqsA.filter((_, k) => k !== ia),
            };
            const pouleBSansB = {
              ...poules[pb],
              equipes: eqsB.filter((_, k) => k !== ib),
            };
            if (verifierClubDansPoule(pouleASansA, eqB)) continue;
            if (verifierClubDansPoule(pouleBSansB, eqA)) continue;

            const avant =
              sommeDistancesPoule(poules[pa]) + sommeDistancesPoule(poules[pb]);

            eqsA[ia] = eqB;
            eqsB[ib] = eqA;

            const apres =
              sommeDistancesPoule(poules[pa]) + sommeDistancesPoule(poules[pb]);

            if (apres < avant) {
              scoreCourant = scoreCourant - avant + apres;
              ameliore = true;
            } else {
              eqsA[ia] = eqA;
              eqsB[ib] = eqB;
            }
          }
        }
      }
    }

    passe++;
    if (!ameliore) break;
  }

  return { poules, score: scoreCourant, passes: passe };
}

// --------- Contrôle d'intégrité final --------------------------------


function verifierIntegritePoules(poules, equipesInitiales) {
  const totalReparties = poules.reduce((s, p) => s + p.equipes.length, 0);
  if (totalReparties !== equipesInitiales.length) {
    const idsRepartis = new Set(
      poules.flatMap((p) => p.equipes.map((e) => e.id)),
    );
    const manquantes = equipesInitiales.filter((e) => !idsRepartis.has(e.id));
    console.error(
      `[genererPoulesNiveau] INTÉGRITÉ : ${totalReparties}/${equipesInitiales.length} équipes réparties.\n` +
        `  → Équipes manquantes : ${manquantes.map((e) => `${e.nom_club} ${e.numero}`).join(", ") || "—"}`,
    );
    return false;
  }
  return true;
}

export function genererPoulesNiveau(equipes, nb_poules) {
  if (!verifierEquilibreMontantesDescendantes(equipes)) {
    console.warn(
      "[genererPoulesNiveau] Déséquilibre détecté : le nombre d'équipes montantes (+) et descendantes (-) n'est pas égal. " +
        "Cela peut entraîner des poules moins équilibrées. Vérifiez la configuration des équipes.",
    );
  }
  const niveauActuel = config.niveauActuel || 1;
  const total_equipes = equipes.length;
  const capacites = definirCapacitesPoules(nb_poules, total_equipes);
  const poules = initialiserPoules(nb_poules, niveauActuel, capacites);
  const quotas = calculerQuotasParStatut(equipes, nb_poules);
  distribuerEquipesNiveau(poules, equipes, quotas);
  optimiserDistances(poules);
  verifierIntegritePoules(poules, equipes);
  console.log("Poules après optimisation:", poules);
  finaliserStatistiquesPoules(poules);
  return poules;
}