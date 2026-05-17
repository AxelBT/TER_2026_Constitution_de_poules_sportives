import { toast,afficherErreur } from "./toast.js";

let config = JSON.parse(localStorage.getItem("championnatConfig"));
const clubs = JSON.parse(localStorage.getItem("clubs"));
//import { clubs } from './clubs.js'
console.log(clubs);

if (!config) {
  window.location.href = "poule.html";
  // return;
}

import { distance } from "./matrice-distances.js";

function trouverNumeroEquipeDisponible(data, numClub, numEquipe, estCTC) {
  let num = parseInt(numEquipe);

  while (
    data.some(
      (e) =>
        e.num_club === numClub &&
        e.numero === num &&
        e.type === (estCTC ? "CTC" : "Club"), // on compare uniquement entre mêmes types
    )
  ) {
    num++;
  }

  return num;
}

function verifierCoherenceClub(data, numClub, nomClub) {
  const existant = data.find((e) => e.num_club === numClub);
  if (!existant) return true;
  return existant.nom_club.toLowerCase() === nomClub.toLowerCase();
}

function verifierCoherenceCTC(data, ctcNum, ctcNom) {
  const existant = data.find((e) => e.type === "CTC" && e.ctc_num === ctcNum);

  if (!existant) return true;

  return existant.ctc_nom.toLowerCase() === ctcNom.toLowerCase();
}

function determinerType(typeBrut) {
  const t = typeBrut.toLowerCase();

  // cas CLUB
  if (t === "club") {
    return "Club";
  }

  // cas CTC (formes acceptées)
  if (
    t === "ctc" ||
    t === "coopération territoriale club" ||
    t === "cooperation territoriale club"
  ) {
    return "CTC";
  }

  return null; // inconnu
}

export async function traiterCSV(contenu) {
  //console.log("Contenu reçu (longueur) :", contenu.length);
  const lignes = contenu.split("\n");
  const data = [];
  const equipesInconnues = [];

  const mapClubs = {};
  clubs.forEach((c) => {
    mapClubs[c.id_club] = c;
  });

  const headers = lignes[0].split(",").map((h) => h.trim().toUpperCase());

  const idx = {
    // n'importe quel ordre
    club_nom: headers.indexOf("CLUB_NOM"),
    club_num: headers.indexOf("CLUB_NUMERO"),
    type: headers.indexOf("TYPE_EQUIPE"),
    ctc_nom: headers.indexOf("CTC_NOM"),
    ctc_num: headers.indexOf("CTC_NUMERO"),
    equipe_num: headers.indexOf("EQUIPE_NUMERO"),
    niveau: headers.indexOf("NIVEAU"),
    statut_niveau: headers.indexOf("STATUT_NIVEAU"),
  };

  const colonnesManquantes = Object.entries(idx)
    .filter(([_, val]) => val === -1)
    .map(([cle, _]) => cle);

  if (colonnesManquantes.length > 0) {
    afficherErreur(
      "Fichier invalide",
      `Les colonnes suivantes sont introuvables : ${colonnesManquantes.join(", ")}. Vérifiez que vous déposez le bon fichier.`,
    );
    return { succes: false, tableau: [] };
  }

  for (let i = 1; i < lignes.length; i++) {
    if (lignes[i].trim() === "") continue; // ignorer les lignes vides

    const colonnes = lignes[i].split(",");
    const type = colonnes[idx.type]?.trim();
    const numClub = colonnes[idx.club_num]?.trim();
    const nomClub = colonnes[idx.club_nom]?.trim();
    const niveau = colonnes[idx.niveau]?.trim();
    const ctcNom = colonnes[idx.ctc_nom]?.trim();
    const ctcNum = colonnes[idx.ctc_num]?.trim();
    const numEquipeRaw = parseInt(colonnes[idx.equipe_num]?.trim());
    const statut = colonnes[idx.statut_niveau]?.trim();

    const verifier_type = determinerType(type);
    if (!verifier_type) {
      if(type!=="")
      afficherErreur(
        "Type d'équipe inconnu",
        `Ligne ${i + 1} : le type "${type}" n'est pas reconnu. Les valeurs acceptées sont "Club" et "Coopération Territoriale Club".`,
      );
      else
        afficherErreur(
        "Type d'équipe inconnu",
        `Ligne ${i + 1} : précisez un type. Les valeurs acceptées sont "Club" et "Coopération Territoriale Club".`,
      );
      return { succes: false, tableau: [] };
    }
    const estCTC = verifier_type === "CTC";

    // on vérifie si toutes les infos d'une équipe sont fournies
    let champManquant = !numClub || !nomClub || isNaN(numEquipeRaw) || !type;
    if (estCTC && (!ctcNom || !ctcNum)) champManquant = true;

    // Exception pour le niveau
    if (config.mode === "niveau" && !niveau) champManquant = true;
    if (config.mode === "niveau" && !statut) champManquant = true;

    if (champManquant) {
      afficherErreur(
        "Données incomplètes",
        `Ligne ${i + 1} : certains champs obligatoires sont manquants. Vérifiez le contenu de cette ligne dans votre fichier.`,
      );
      return { succes: false, tableau: [] };
    }

    const club = mapClubs[numClub];
    if (!club) {
      const nomAffiche = estCTC ? ctcNom || "Inconnue" : nomClub || "Inconnue";
      equipesInconnues.push({ nom: nomAffiche, id_club: numClub });
      continue;
    }

    // vérifier que pour le même numclub on a toujours le même nomclub
    if (!verifierCoherenceClub(data, numClub, nomClub)) {
      afficherErreur(
        "Incohérence dans le fichier",
        `Le numéro ${numClub} correspond à deux noms de clubs différents. Un même numéro doit toujours avoir le même nom.`,
      );
      return { succes: false, tableau: [] };
    }

    if (estCTC) {
      if (!verifierCoherenceCTC(data, ctcNum, ctcNom)) {
        afficherErreur(
    "Incohérence dans le fichier",
    `Le numéro ${numClub} correspond à deux noms de CTC différents. Un même numéro doit toujours avoir le même nom.`
);
        return { succes: false, tableau: [] };
      }
    }

    const numEquipe = trouverNumeroEquipeDisponible(
      data,
      numClub,
      numEquipeRaw,
      estCTC,
    );

    if (numEquipe !== numEquipeRaw) {
      toast(
        `Doublon détecté : club ${numClub}, équipe ${numEquipeRaw} → renommée en ${numEquipe}`,
        "warn",
      );
    }

    const equipe = {
      id: estCTC ? `${ctcNom}-${numEquipe}` : `${nomClub}-${numEquipe}`,
      num_club: numClub,
      nom_club: nomClub,
      numero: numEquipe,
      type: estCTC ? "CTC" : "Club",
      niveau: niveau,
      latitude: parseFloat(club.latitude),
      longitude: parseFloat(club.longitude),
      statut_niveau: statut,
    };

    if (estCTC) {
      equipe.ctc_nom = ctcNom;
      equipe.ctc_num = ctcNum;
    }

    data.push(equipe);
  }

  if (equipesInconnues.length > 0) {
    return { succes: false, tableau: equipesInconnues };
  }

  return { succes: true, tableau: data };
}

// Distance Haversine entre deux équipes (en km)

// Barycentre géographique d'un tableau d'équipes
export function calculerBarycentre(equipes) {
  if (equipes.length === 0) return null;

  const total = equipes.reduce(
    (acc, e) => {
      acc.lat += e.latitude;
      acc.lon += e.longitude;
      return acc;
    },
    { lat: 0, lon: 0 },
  );

  return {
    latitude: total.lat / equipes.length,
    longitude: total.lon / equipes.length,
  };
}

export function definirCapacitesPoules(nb_poules, total_equipes) {
  const base = Math.floor(total_equipes / nb_poules);
  const reste = total_equipes % nb_poules;
  let capacites = [
    ...Array(reste).fill(base + 1),
    ...Array(nb_poules - reste).fill(base),
  ];

  // Mélange aléatoire (Fisher-Yates)
  for (let i = capacites.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [capacites[i], capacites[j]] = [capacites[j], capacites[i]];
  }

  return capacites;
}

export function initialiserPoules(nb_poules, niveau, capacites) {
  const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: nb_poules }, (_, i) => ({
    nom: lettres[i],
    niveau: niveau,
    nb_max: capacites[i],
    equipes: [],
    distance_moyenne: 0,
    barycentre: null,
  }));
}

function trierParIsolement(equipes, centreGlobal) {
  return [...equipes].sort((a, b) => {
    const distA = distance(a, centreGlobal);
    const distB = distance(b, centreGlobal);
    return distB - distA;
  });
}

function choisirGrainesOptimisees(
  equipes,
  nb_poules,
  poules,
  barycentreGlobal,
) {
  const nonGraines = [...equipes]; // on travaille sur une copie

  let indexMax = 0;
  let distMax = -1;

  for (let i = 0; i < nonGraines.length; i++) {
    const d = distance(nonGraines[i], barycentreGlobal);
    if (d > distMax) {
      distMax = d;
      indexMax = i;
    }
  }

  ajouterEquipeDansPoule(poules[0], nonGraines[indexMax]);
  nonGraines.splice(indexMax, 1);

  for (let g = 1; g < nb_poules; g++) {
    const graines = poules.slice(0, g).map((p) => p.equipes[0]); // graines déjà placées

    let meilleurIndex = 0;
    let meilleurScore = -1; // on cherche le MAX

    for (let i = 0; i < nonGraines.length; i++) {
      const minDist = Math.min(
        ...graines.map((gr) => distance(nonGraines[i], gr)),
      );

      if (minDist > meilleurScore) {
        meilleurScore = minDist;
        meilleurIndex = i;
      }
    }

    ajouterEquipeDansPoule(poules[g], nonGraines[meilleurIndex]);
    nonGraines.splice(meilleurIndex, 1);
  }

  return nonGraines;
}

export function verifierClubDansPoule(poule, equipe) {
  return poule.equipes.some((e) => {
    if (equipe.type === "CTC" && e.type === "CTC") {
      if(e.ctc_num === equipe.ctc_num)
        return true;
    }
    return e.num_club === equipe.num_club;
  });
}

// Critère 1 — Barycentre le plus proche
// Choisir la poule dont le barycentre est géographiquement le plus proche de l'équipe.
function choisirMeilleurePoule(poules, equipe) {
  let meilleure = null;
  let minDist = Infinity;

  for (const p of poules) {
    if (p.equipes.length >= p.nb_max) continue;

    if (verifierClubDansPoule(p, equipe)) continue;

    const bary = p.barycentre;
    if (!bary) continue; // ne devrait pas arriver (graine toujours présente)

    const d = distance(equipe, bary);
    if (d < minDist) {
      minDist = d;
      meilleure = p;
    }
  }

  return meilleure;
}

// Critère 2 — Distance moyenne minimale après ajout
// Choisir la poule dont la distance moyenne est minimale après ajout simulé de l'équipe.
/*function choisirMeilleurePoule(poules, equipe) {
    let meilleure   = null;
    let minDistMoy  = Infinity;

    for (const p of poules) {
        if (p.equipes.length >= p.nb_max) continue;
        if (verifierClubDansPoule(p, equipe)) continue;

        // Approche 2 — simulation de l'ajout
        const distMoySimulee = calculerDistanceMoyenne({
            equipes: [...p.equipes, equipe]
        });

        if (distMoySimulee < minDistMoy) {
            minDistMoy = distMoySimulee;
            meilleure  = p;
        }
    }

    return meilleure;
}*/

// Critère 3 — Augmentation minimale de la distance moyenne
// Choisir la poule dont l'ajout de l'équipe dégrade le moins la cohésion géographique.
/*function choisirMeilleurePoule(poules, equipe) {
    let meilleure       = null;
    let minAugmentation = Infinity;

    for (const p of poules) {
        if (p.equipes.length >= p.nb_max) continue;
        if (verifierClubDansPoule(p, equipe)) continue;

        // Distance moyenne actuelle de la poule
        const distAvant = p.distance_moyenne;

        // Distance moyenne simulée après ajout de l'équipe
        const distApres = calculerDistanceMoyenne({
            equipes: [...p.equipes, equipe]
        });

        // Augmentation de la distance moyenne
        const augmentation = distApres - distAvant;

        if (augmentation < minAugmentation) {
            minAugmentation = augmentation;
            meilleure       = p;
        }
    }

    return meilleure;
}*/

export function ajouterEquipeDansPoule(poule, equipe) {
  poule.equipes.push(equipe);
  poule.barycentre = calculerBarycentre(poule.equipes);
  poule.distance_moyenne = calculerDistanceMoyenne(poule);
}

function tenterSauvetage(poules, equipe) {
  let meilleurEchange = null;
  let meilleurScore = Infinity;

  for (const p of poules) {
    if (verifierClubDansPoule(p, equipe)) continue;

    for (let i = 0; i < p.equipes.length; i++) {
      const equipeEchange = p.equipes[i];

      const equipesDansP_apresRetrait = p.equipes.filter((_, idx) => idx !== i);
      const nouveauBaryP = calculerBarycentre(equipesDansP_apresRetrait);
      const scoreP = nouveauBaryP ? distance(equipe, nouveauBaryP) : 0;

      for (const pCible of poules) {
        if (
          pCible !== p &&
          pCible.equipes.length < pCible.nb_max &&
          !verifierClubDansPoule(pCible, equipeEchange)
        ) {
          const scorePCible = pCible.barycentre
            ? distance(equipeEchange, pCible.barycentre)
            : 0;

          const score = scoreP + scorePCible;

          if (score < meilleurScore) {
            meilleurScore = score;
            meilleurEchange = { p, i, equipeEchange, pCible };
          }
        }
      }
    }
  }

  if (!meilleurEchange) return false;

  const { p, i, equipeEchange, pCible } = meilleurEchange;

  p.equipes.splice(i, 1);
  p.barycentre = calculerBarycentre(p.equipes);
  //p.distance_moyenne = calculerDistanceMoyenne(p);

  ajouterEquipeDansPoule(pCible, equipeEchange);
  ajouterEquipeDansPoule(p, equipe);

  return true;
}

export function verifierSaturationClub(equipes, nb_poules) {
  const count = {};

  for (const e of equipes) {
    count[e.num_club] = (count[e.num_club] || 0) + 1;
    if (e.type === "CTC") count[e.ctc_num] = (count[e.ctc_num] || 0) + 1;
  }
  for (const e of equipes) {
    if (count[e.num_club] > nb_poules) {
      return {
        ok: false,
        nomClub: e.nom_club,
        numClub: e.num_club,
        nbEquipes: count[e.num_club],
      };
    } else if (e.type === "CTC") {
      if (count[e.ctc_num] > nb_poules) {
        return {
          ok: false,
          nomClub: e.ctc_nom,
          numClub: e.ctc_num,
          nbEquipes: count[e.ctc_num],
        };
      }
    }
  }

  return { ok: true };
}

/*function verifierSaturationClub(equipes) {
  const count = {};

  equipes.forEach((e) => {
    count[e.num_club] = (count[e.num_club] || 0) + 1;
  });

  const max = Math.max(...Object.values(count));
  return max ;
}*/

/*function equilibrerDistancesMoyennes(poules) {
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let meilleurEchange = null;
    let meilleurEcartGlobal = calculerEcartGlobal(poules);

    //  parcourir toutes les paires de poules
    for (let a = 0; a < poules.length; a++) {
      for (let b = a + 1; b < poules.length; b++) {
        const pA = poules[a];
        const pB = poules[b];

        for (let i = 0; i < pA.equipes.length; i++) {
          for (let j = 0; j < pB.equipes.length; j++) {
            const eA = pA.equipes[i];
            const eB = pB.equipes[j];

            const pASans = pA.equipes.filter((_, idx) => idx !== i);
            const pBSans = pB.equipes.filter((_, idx) => idx !== j);

            // contrainte club
            if (pASans.some(e => e.num_club === eB.num_club)) continue;
            if (pBSans.some(e => e.num_club === eA.num_club)) continue;

            // simulation
            const nouvelleDistA = calculerDistanceMoyenne({
              equipes: [...pASans, eB],
            });

            const nouvelleDistB = calculerDistanceMoyenne({
              equipes: [...pBSans, eA],
            });

            // recalcul global
            const distancesSimulees = poules.map((p, idx) => {
              if (idx === a) return nouvelleDistA;
              if (idx === b) return nouvelleDistB;
              return p.distance_moyenne;
            });

            const nouvelEcart =
              Math.max(...distancesSimulees) -
              Math.min(...distancesSimulees);

            if (nouvelEcart < meilleurEcartGlobal) {
              meilleurEcartGlobal = nouvelEcart;
              meilleurEchange = { a, b, i, j, eA, eB };
            }
          }
        }
      }
    }

    //  aucun échange améliore → on arrête
    if (!meilleurEchange) break;

    // appliquer le meilleur échange global
    const { a, b, i, j, eA, eB } = meilleurEchange;

    poules[a].equipes.splice(i, 1);
    poules[b].equipes.splice(j, 1);

    ajouterEquipeDansPoule(poules[a], eB);
    ajouterEquipeDansPoule(poules[b], eA);
  }

  console.log(`Équilibrage terminé en ${iterations} itération(s)`);
  return poules;
}

function calculerEcartGlobal(poules) {
  const distances = poules.map(p => p.distance_moyenne);
  return Math.max(...distances) - Math.min(...distances);
}*/

function equilibrerDistancesMoyennes(poules) {
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let meilleurEchange = null;
    let meilleurGain = 0;

    for (let a = 0; a < poules.length; a++) {
      for (let b = a + 1; b < poules.length; b++) {
        const pA = poules[a];
        const pB = poules[b];

        for (let i = 0; i < pA.equipes.length; i++) {
          for (let j = 0; j < pB.equipes.length; j++) {
            const eA = pA.equipes[i];
            const eB = pB.equipes[j];

            const pASans = pA.equipes.filter((_, idx) => idx !== i);
            const pBSans = pB.equipes.filter((_, idx) => idx !== j);

            // contrainte club
            if (pASans.some((e) => e.num_club === eB.num_club)) continue;
            if (pBSans.some((e) => e.num_club === eA.num_club)) continue;

            const ancienneDistA = pA.distance_moyenne;
            const ancienneDistB = pB.distance_moyenne;

            const nouvelleDistA = calculerDistanceMoyenne({
              equipes: [...pASans, eB],
            });

            const nouvelleDistB = calculerDistanceMoyenne({
              equipes: [...pBSans, eA],
            });

            //  gain global (ce que TU veux)
            const gain =
              ancienneDistA + ancienneDistB - (nouvelleDistA + nouvelleDistB);

            if (gain > meilleurGain) {
              meilleurGain = gain;
              meilleurEchange = { a, b, i, j, eA, eB };
            }
          }
        }
      }
    }

    // aucun échange n'améliore → stop
    if (!meilleurEchange) break;

    // appliquer le meilleur échange
    const { a, b, i, j, eA, eB } = meilleurEchange;

    poules[a].equipes.splice(i, 1);
    poules[b].equipes.splice(j, 1);

    ajouterEquipeDansPoule(poules[a], eB);
    ajouterEquipeDansPoule(poules[b], eA);
  }

  console.log(`Optimisation terminée en ${iterations} itérations`);
  return poules;
}

export function calculerDistanceMoyenne(poule) {
  if (poule.equipes.length <= 1) return 0;

  let total = 0;
  let count = 0;

  for (let i = 0; i < poule.equipes.length; i++) {
    for (let j = i + 1; j < poule.equipes.length; j++) {
      total += distance(poule.equipes[i], poule.equipes[j]);
      count++;
    }
  }

  return total / count;
}

export function finaliserStatistiquesPoules(poules) {
  poules.forEach((poule) => {
    const n = poule.equipes.length;
    const distancesAuCentre = poule.equipes.map((e) =>
      distance(e, poule.barycentre),
    );
    const moyDistCentre =
      distancesAuCentre.reduce((s, d) => s + d, 0) / (n || 1);
    const variance =
      distancesAuCentre.reduce(
        (s, d) => s + Math.pow(d - moyDistCentre, 2),
        0,
      ) / (n || 1);
    poule.ecart_type = Math.sqrt(variance);
    poule.equipes.forEach((e) => (e.distance_totale = 0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = distance(poule.equipes[i], poule.equipes[j]);

        poule.equipes[i].distance_totale += d;
        poule.equipes[j].distance_totale += d;
      }
    }

    poule.equipes.forEach((e) => {
      e.distance_totale = e.distance_totale.toFixed(2);
    });
  });
}

export function generer_poules(equipes, nb_poules) {
  const nb_equipes = equipes.length;

  const barycentre = calculerBarycentre(equipes);
  const capacites = definirCapacitesPoules(nb_poules, nb_equipes);
  const poules = initialiserPoules(nb_poules, config.niveauActuel, capacites);

  let restantes = choisirGrainesOptimisees(
    equipes,
    nb_poules,
    poules,
    barycentre,
  );
  restantes = trierParIsolement(restantes, barycentre);

  for (const equipe of restantes) {
    console.log(equipe.id);
    const meilleure = choisirMeilleurePoule(poules, equipe);

    if (meilleure) {
      ajouterEquipeDansPoule(meilleure, equipe);
    } else {
      console.warn("Sauvetage nécessaire pour :", equipe.nom);
      const succes = tenterSauvetage(poules, equipe);

      if (!succes) {
        toast(
          `Échec critique : "${equipe.nom}" ne peut pas être placée.`,
          "error",
        );
      }
    }
  }
  equilibrerDistancesMoyennes(poules);
  finaliserStatistiquesPoules(poules);
  console.log("Poules générées :", poules);
  return poules;
}
