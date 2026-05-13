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

function calculerQuotasParStatut(equipes, nb_poules) {
  const compteurs = { "-": 0, "=": 0, "+": 0 };
  for (const eq of equipes) {
    if (eq.statut_niveau in compteurs) {
      compteurs[eq.statut_niveau]++;
    }
  }

  const quotas = {};
  ORDRE_STATUTS.forEach((statut, si) => {
    const total = compteurs[statut];
    const base = Math.floor(total / nb_poules);
    const reste = total % nb_poules;
    const brut = Array.from({ length: nb_poules }, (_, i) =>
      i < reste ? base + 1 : base,
    );
    //const decalage = si % nb_poules;
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

// --------- Distribution gloutonne par statut -------------------------

function distribuerEquipesNiveau(poules, equipes, quotas) {
  const quotasRestants = {};
  ORDRE_STATUTS.forEach((s) => {
    quotasRestants[s] = [...quotas[s]];
  });

  for (const statut of ORDRE_STATUTS) {
    let restantes = equipes.filter((e) => e.statut_niveau === statut);

    while (restantes.length > 0) {
      let placeeDansCeTour = false;

      for (let p = 0; p < poules.length; p++) {
        if (quotasRestants[statut][p] <= 0) continue;
        if (poules[p].equipes.length >= poules[p].nb_max) continue;
        if (restantes.length === 0) break;

        let idxChoisi = restantes.findIndex(
          (eq) => !verifierClubDansPoule(poules[p], eq),
        );

        if (idxChoisi === -1) {
        
          const clubsEnConflit = [
            ...new Set(restantes.map((eq) => eq.nom_club)),
          ];
          const clubsDejaPresents = [
            ...new Set(poules[p].equipes.map((eq) => eq.nom_club)),
          ];
          const conflits = clubsEnConflit.filter((c) =>
            clubsDejaPresents.includes(c),
          );
          console.warn(
            `[genererPoulesNiveau] Impossible de placer une équipe "${statut}" dans la poule "${poules[p].nom}" ` +
              `sans violer la contrainte club.\n` +
              `  → Clubs en conflit : ${conflits.join(", ")}\n` +
              `  → Clubs déjà dans la poule : ${clubsDejaPresents.join(", ")}\n` +
              `  → Équipes restantes à placer : ${restantes.map((e) => `${e.nom_club} ${e.numero}`).join(", ")}\n` +
              `  → Passage à la poule suivante.`,
          );
          continue; // ← on ne place rien, on tente la poule suivante
        }

        const choix = restantes[idxChoisi];
        if (ajouterEquipeDansPouleNiveau(poules[p], choix)) {
          quotasRestants[statut][p]--;
          restantes.splice(idxChoisi, 1);
          placeeDansCeTour = true;
        }
      }

      if (!placeeDansCeTour) {
        // Aucune poule n'a pu absorber les équipes restantes dans ce tour
        console.warn(
          `[genererPoulesNiveau] ${restantes.length} équipe(s) "${statut}" ` +
            `non placée(s) après un tour complet — tentative de placement de secours.\n` +
            `  → Équipes concernées : ${restantes.map((e) => `${e.nom_club} ${e.numero}`).join(", ")}`,
        );

        for (const eq of restantes) {
          // Placement de secours : poule la moins remplie respectant la contrainte club
          let cible = -1;
          let minTaille = Infinity;
          for (let p = 0; p < poules.length; p++) {
            console.log(poules.length,p ,verifierClubDansPoule(poules[p], eq));     
            if (poules[p].equipes.length >= poules[p].nb_max &&!verifierClubDansPoule(poules[p], eq) && poules[p].equipes.length < minTaille) {
              minTaille = poules[p].equipes.length;
              cible = p;
            }
          }

          if (cible !== -1) {
            console.info(
              `[genererPoulesNiveau] Placement de secours : "${eq.nom_club} ${eq.numero}" → poule "${poules[cible].nom}".`,
            );
            poules[cible].equipes.push(eq);
          } else {
            // Vraiment impossible : toutes les poules ont déjà ce club OU sont pleines
            const etatPoules = poules.map(
              (p) =>
                `"${p.nom}" [${p.equipes.length}/${p.nb_max}] clubs: ${[...new Set(p.equipes.map((e) => e.nom_club))].join(", ") || "—"}`,
            );
            console.error(
              `[genererPoulesNiveau] ÉCHEC CRITIQUE : impossible de placer "${eq.nom_club} ${eq.numero}" (statut "${statut}") ` +
                `dans une poule sans violer la contrainte club et sans dépasser la capacité.\n` +
                `  → État des poules :\n${etatPoules.map((l) => `      ${l}`).join("\n")}\n` +
                `  → L'équipe n'est PAS placée. Vérifiez la configuration des poules et des quotas.`,
            );
            // On n'ajoute PAS l'équipe — la contrainte club n'est jamais relâchée
          }
        }
        restantes = [];
      }
    }
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

export function genererPoulesNiveau(equipes, nb_poules) {
  const niveauActuel = config.niveauActuel || 1;
  const total_equipes = equipes.length;
  const capacites = definirCapacitesPoules(nb_poules, total_equipes);
  const poules = initialiserPoules(nb_poules, niveauActuel, capacites);
  const quotas = calculerQuotasParStatut(equipes, nb_poules);
  distribuerEquipesNiveau(poules, equipes, quotas);
  optimiserDistances(poules);
  console.log("Poules après optimisation:", poules);
  finaliserStatistiquesPoules(poules);
  return poules;
}
