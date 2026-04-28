import {
  traiterCSV,
  definirCapacitesPoules,
  initialiserPoules,
  verifierClubDansPoule,
} from "./calcul-poules.js";



const ORDRE_STATUTS = ["-", "=", "+"]; 


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
      i < reste ? base + 1 : base
    );
    const decalage = si % nb_poules;
    quotas[statut] = brut.slice(decalage).concat(brut.slice(0, decalage));
  });

  return quotas;
}

// --------- Ajout d'une équipe dans une poule -------------------------

function ajouterEquipeDansPouleNiveau(poule, equipe) {
  if (!verifierClubDansPoule(poule, equipe)) {
    poule.equipes.push(equipe);
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
          (eq) => !verifierClubDansPoule(poules[p], eq)
        );

        if (idxChoisi === -1) {
      
          console.warn(
            `[genererPoulesNiveau] Contrainte club relâchée — poule ${poules[p].nom}, statut ${statut}`
          );
          idxChoisi = 0;
          const choix = restantes[idxChoisi];
          poules[p].equipes.push(choix);
          quotasRestants[statut][p]--;
          restantes.splice(idxChoisi, 1);
          placeeDansCeTour = true;
          continue;
        }

        const choix = restantes[idxChoisi];
        if (ajouterEquipeDansPouleNiveau(poules[p], choix)) {
          quotasRestants[statut][p]--;
          restantes.splice(idxChoisi, 1);
          placeeDansCeTour = true;
        }
      }

      if (!placeeDansCeTour) {
   
        console.error(
          `[genererPoulesNiveau] ${restantes.length} équipe(s) "${statut}" ` +
            `non placée(s) par les quotas — placement de secours.`
        );
        for (const eq of restantes) {
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
          if (cible === -1) {
            cible = poules
              .map((p, i) => ({ i, n: p.equipes.length }))
              .sort((a, b) => a.n - b.n)[0].i;
            console.warn(
              `[genererPoulesNiveau] Contrainte club relâchée pour ${eq.nom_club} ${eq.numero}`
            );
          }
          poules[cible].equipes.push(eq);
        }
        restantes = [];
      }
    }
  }
}


export function genererPoulesNiveau(equipes, nb_poules) {
  const total_equipes = equipes.length;
  const capacites = definirCapacitesPoules(nb_poules, total_equipes);
  const poules = initialiserPoules(nb_poules, "Niveau", capacites);
  const quotas = calculerQuotasParStatut(equipes, nb_poules);
  console.log("Quotas par statut :", quotas);
  distribuerEquipesNiveau(poules, equipes, quotas);
  return poules;
}