import { toast } from "./toast.js";

let config = JSON.parse(localStorage.getItem("championnatConfig"));
const clubs = JSON.parse(localStorage.getItem("clubs"));
//import { clubs } from './clubs.js'
console.log(clubs);

if (!config) {
  window.location.href = "poule.html";
  // return;
}

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
    toast(
      `Colonnes introuvables dans le fichier : ${colonnesManquantes.join(", ")}`,
      "error",
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
    if(!verifier_type){
        toast(`Type inconnu ligne ${i+1} : "${type}"`, "error");
    return { succes: false, tableau: [] };
    }
    const estCTC = verifier_type  === "CTC";

    // on vérifie si toutes les infos d'une équipe sont fournies
    let champManquant = !numClub || !nomClub || isNaN(numEquipeRaw) || !type;
    if (estCTC && (!ctcNom || !ctcNum)) champManquant = true;

    // Exception pour le niveau
    if (config.mode === "niveau" && !niveau) champManquant = true;
    if (config.mode === "niveau" && !statut) champManquant = true;

    if (champManquant) {
      toast(`Données incomplètes :  ligne ${i + 1}`, "error");
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
      toast(
        `Incohérence : le numéro ${numClub} correspond à deux noms de clubs différents.`,
        "error",
      );
      return { succes: false, tableau: [] };
    }

    if (estCTC) {
      if (!verifierCoherenceCTC(data, ctcNum, ctcNom)) {
        toast(
          `Incohérence : le numéro ${ctcNum} correspond à deux noms de CTC différents.`,
          "error",
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
    toast("Impossible de générer", "error");
    return { succes: false, tableau: equipesInconnues };
  }

  return { succes: true, tableau: data };
}

// Distance Haversine entre deux équipes (en km)
export function distance(e1, e2) {
  const R = 6371;
  const dLat = ((e2.latitude - e1.latitude) * Math.PI) / 180;
  const dLon = ((e2.longitude - e1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((e1.latitude * Math.PI) / 180) *
      Math.cos((e2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    if (equipe.type === "CTC" || e.type === "CTC") {
      return e.ctc_num === equipe.ctc_num;
    }
    return e.num_club === equipe.num_club;
  });
}

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

  equipes.forEach((e) => {
    count[e.num_club] = (count[e.num_club] || 0) + 1;
  });

  const max = Math.max(...Object.values(count));
  return max <= nb_poules;
}

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
            if (pASans.some(e => e.num_club === eB.num_club)) continue;
            if (pBSans.some(e => e.num_club === eA.num_club)) continue;

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
              (ancienneDistA + ancienneDistB) -
              (nouvelleDistA + nouvelleDistB);

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

export function generer_poules(equipes, nb_poules, nb_max) {
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


/*function verifierCTCClubPorteur(data, ctcNum, numClub) {
  const existant = data.find((e) => e.type === "CTC" && e.ctc_num === ctcNum);

  if (!existant) return true;

  return existant.num_club === numClub;
}*/

/*export function traiterCSV(contenu) {
    const lignes = contenu.split("\n");
    const data = [];
    
    
    const mapClubs = {};
    clubs.forEach(c => { mapClubs[c.id] = c; });

    for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;
        
        const colonnes = lignes[i].split(";");
        const idClubEquipe = colonnes[1]; // L'ID club renseigné pour l'équipe

        if (!mapClubs[idClubEquipe]) {
            const nomEquipe = colonnes[2] || "Inconnue";
            // On affiche le toast d'erreur
            toast(`Erreur : Le club (ID: ${idClubEquipe}) de l'équipe "${nomEquipe}" est introuvable dans le fichier des clubs.`, "error");
            console.error(`Coordonnées manquantes pour l'équipe : ${nomEquipe}`);
            
            
            toast("imposssible de générer","error");
            return; 
        }

        data.push({
            id: colonnes[0],
            id_club: idClubEquipe,
            nom: colonnes[2],
            niveau: parseInt(colonnes[3]),
            effectif: parseInt(colonnes[4]),
            latitude: parseFloat(mapClubs[idClubEquipe].latitude),
            longitude: parseFloat(mapClubs[idClubEquipe].longitude)
        });
    }

    return data;
}*/

/*export function traiterCSV(contenu) {
    const lignes = contenu.split("\n");
    const data = [];
    const equipesInconnues = [];
    
    const mapClubs = {};
    clubs.forEach(c => { mapClubs[c.id] = c; });

    for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;
        
        const colonnes = lignes[i].split(";");
        const idClubEquipe = colonnes[1];

        if (!mapClubs[idClubEquipe]) {
            const nomEquipe = colonnes[2] || "Inconnue";
            equipesInconnues.push({ nom: nomEquipe, id_club: idClubEquipe });
            continue;
        }
        data.push({
            id: colonnes[0],
            id_club: idClubEquipe,
            nom: colonnes[2],
            niveau: parseInt(colonnes[3]),
            effectif: parseInt(colonnes[4]),
            latitude: parseFloat(mapClubs[idClubEquipe].latitude),
            longitude: parseFloat(mapClubs[idClubEquipe].longitude)
        });
    }

    if (equipesInconnues.length > 0) {
        toast("Impossible de générer", "error");
        return { succes: false, tableau: equipesInconnues };
    }

    return { succes: true, tableau: data };
}*/

/*function definirCapacitesPoules(nb_poules, total_equipes) {
    const base = Math.floor(total_equipes / nb_poules);
    const reste = total_equipes % nb_poules;

    let capacites = [];

    for (let i = 0; i < nb_poules; i++) {
        if (i < reste) {
            capacites.push(base + 1);
        } else {
            capacites.push(base);
        }
    }

    return capacites;
}*/

/*function trierParTailleClub(equipes) {
    const count = {};
    equipes.forEach(e => {
        count[e.id_club] = (count[e.id_club] || 0) + 1;
    });

    // trier
    return equipes.sort((a, b) => {
        return count[b.id_club] - count[a.id_club];
    });
}*/

/*export function traiterCSV(contenu) {
    const lignes = contenu.split("\n");
    const data = [];

    for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;
        console.log(lignes[i]);
        const colonnes = lignes[i].split(";");

        data.push({
            id: colonnes[0],
            id_club: colonnes[1],
            nom: colonnes[2],
            niveau: parseInt(colonnes[3]),//à voir 
            effectif: parseInt(colonnes[4])
        });
    }

    // ajouter longitude et latitude aux équipes 
    const mapClubs = {};
    clubs.forEach(c => {mapClubs[c.id] = c;});
    
    return data.map(e => ({
        ...e,
        latitude: mapClubs[e.id_club].latitude,
        longitude: mapClubs[e.id_club].longitude
    }));

}*/

/*function choisirMeilleurePoule(poules, equipe) {
    let meilleure = null;
    let minDistance = Infinity;

    for (let p of poules) {

        if (p.effectif >= p.nb_max) continue;

        if (verifierClubDansPoule(p, equipe)) continue;

        const dist = simulerAjout(p, equipe);

        if (dist < minDistance) {
            minDistance = dist;
            meilleure = p;
        }
    }

    return meilleure;
}*/

/*function trierEquipesParDistanceAuCentre(equipes, centre) {
    return equipes
        .map(e => ({
            ...e,
            dist: distance(e, centre)
        }))
        .sort((a, b) => b.dist - a.dist);
}*/

/*function choisirGraines(equipesTriees, nb_poules, poules) {
    for (let i = 0; i < nb_poules; i++) {
        ajouterEquipeDansPoule(poules[i], equipesTriees[i]);
    }

    return equipesTriees.slice(nb_poules);
}*/

/*function simulerAjout(poule, equipe) {
    const copie = [...poule.equipes, equipe];

    return calculerDistanceMoyenne({ equipes: copie });
}*/

/*function tenterSauvetage(poules, equipe) {
    for (const p of poules) {
        if (verifierClubDansPoule(p, equipe)) continue;
 
        for (let i = 0; i < p.equipes.length; i++) {
            const equipeEchange = p.equipes[i];
 
            for (const pCible of poules) {
                if (
                    pCible !== p &&
                    pCible.equipes.length < pCible.nb_max &&
                    !verifierClubDansPoule(pCible, equipeEchange)
                ) {
                    p.equipes.splice(i, 1);
                    //p.barycentre       = calculerBarycentre(p.equipes);
                    //p.distance_moyenne = calculerDistanceMoyenne(p);
 
                    ajouterEquipeDansPoule(pCible, equipeEchange);
                    ajouterEquipeDansPoule(p, equipe);
                    return true;
                }
            }
        }
    }
    return false;
}*/

/*export function generer_poules(equipes,nb_poules,nb_max){
    const nb_equipes = equipes.length;
    //console.log(nb_equipes);
    if (nb_poules*nb_max < nb_equipes){
        toast('Nombre d\'équipes et de poules trop bas', 'error');
        console.log("On ne peut pas générer des poules 1 ");}
    else if(nb_equipes <= nb_poules*(nb_max-1))
        {toast('On ne peut pas générer des poules 2', 'error');
        console.log("on ne peut pas générer des poules 2 ");}
    else if(!verifierContraintes(equipes,nb_poules)){
        toast('On ne peut pas générer des poules 3', 'error');
        console.log("On ne peut pas générer des poules 3 ");
    }else{

        const capacites = definirCapacitesPoules(nb_poules, equipes.length);
        let poules = initialiserPoules(nb_poules, config.niveauActuel, capacites)
        let barycentre = calculerBarycentre(equipes);

        let equipesTriees = trierEquipesParDistanceAuCentre(equipes, barycentre);
        let restantes = choisirGraines(equipesTriees, nb_poules, poules);
        restantes = trierParTailleClub(restantes);
        
        for (let equipe of restantes) {
            let meilleure = choisirMeilleurePoule(poules, equipe);

            if (meilleure) {
                ajouterEquipeDansPoule(meilleure, equipe);
            } else {
                
                console.log("Tentative de sauvetage pour :", equipe.nom);
                
                let placementTrouve = false;
                // On cherche une poule qui n'a pas le club (même si elle est pleine)
                for (let p of poules) {
                    if (!verifierClubDansPoule(p, equipe)) {
                        // On cherche dans cette poule 'p' une équipe 'e' qu'on peut déplacer
                        for (let i = 0; i < p.equipes.length; i++) {
                            let equipeEchange = p.equipes[i];
                            
                            // Est-ce que equipeEchange peut aller dans une AUTRE poule qui a de la place ?
                            for (let pAutre of poules) {
                                if (pAutre !== p && 
                                    pAutre.effectif < pAutre.nb_max && 
                                    !verifierClubDansPoule(pAutre, equipeEchange)) {
                                    
                                    // On déplace l'équipe échange
                                    p.equipes.splice(i, 1);
                                    p.effectif--;
                                    ajouterEquipeDansPoule(pAutre, equipeEchange);
                                    
                                    // On place l'équipe qui était bloquée
                                    ajouterEquipeDansPoule(p, equipe);
                                    placementTrouve = true;
                                    break;
                                }
                            }
                            if (placementTrouve) break;
                        }
                    }
                    if (placementTrouve) break;
                }

                if (!placementTrouve) {
                    toast(`Échec critique : ${equipe.nom} ne peut pas être placée sans violer les règles.`, 'error');
                }
            }
        }

        console.log(poules);
        return poules;
    }
    

}*/

/*function equilibrerDistancesMoyennes(poules) {
    let changementGlobal = true;
    let iterations = 0;
    const MAX_ITERATIONS = 20;

    while (changementGlobal && iterations < MAX_ITERATIONS) {
        changementGlobal = false;
        iterations++;

        for (let i = 0; i < poules.length; i++) {
            for (let j = i + 1; j < poules.length; j++) {
                let p1 = poules[i];
                let p2 = poules[j];

                let meilleurEchange = null;
                let plusGrandGain = 0;

                for (let idx1 = 0; idx1 < p1.equipes.length; idx1++) {
                    for (let idx2 = 0; idx2 < p2.equipes.length; idx2++) {
                        let e1 = p1.equipes[idx1];
                        let e2 = p2.equipes[idx2];

                        // 1. Vérification des contraintes de club
                        if (verifierClubDansPoule(p1, e2) || verifierClubDansPoule(p2, e1)) continue;

                        // 2. Création des copies pour simuler le mouvement
                        let copieEquipes1 = [...p1.equipes];
                        let copieEquipes2 = [...p2.equipes];

                        // On effectue l'échange dans les copies
                        copieEquipes1.splice(idx1, 1, e2); // remplace e1 par e2
                        copieEquipes2.splice(idx2, 1, e1); // remplace e2 par e1

                        // 3. Recalcul des barycentres virtuels
                        let barycentreVirtuel1 = calculerBarycentre(copieEquipes1);
                        let barycentreVirtuel2 = calculerBarycentre(copieEquipes2);

                        // 4. Comparaison des distances
                        // Situation AVANT : e1 vs centre actuel de p1 + e2 vs centre actuel de p2
                        let distAvant = distance(e1, p1.barycentre) + distance(e2, p2.barycentre);
                        
                        // Situation APRÈS : e2 vs son futur centre + e1 vs son futur centre
                        let distApres = distance(e2, barycentreVirtuel1) + distance(e1, barycentreVirtuel2);

                        let gain = distAvant - distApres;

                        if (gain > plusGrandGain) {
                            plusGrandGain = gain;
                            meilleurEchange = { idx1, idx2 };
                        }
                    }
                }

                if (meilleurEchange) {
                    const { idx1, idx2 } = meilleurEchange;
                    // Application réelle de l'échange
                    let e1 = p1.equipes[idx1];
                    let e2 = p2.equipes[idx2];

                    p1.equipes[idx1] = e2;
                    p2.equipes[idx2] = e1;

                    // Mise à jour des vrais barycentres
                    p1.barycentre = calculerBarycentre(p1.equipes);
                    p2.barycentre = calculerBarycentre(p2.equipes);

                    changementGlobal = true;
                }
            }
        }
    }
}*/

/*function scoreGlobal(poules) {
    const distances = poules.map(p => parseFloat(p.distance_moyenne));

    const moyenne = distances.reduce((a, b) => a + b, 0) / distances.length;

    const variance = distances.reduce((acc, d) => acc + (d - moyenne) ** 2, 0);

    return variance;
}

function recalculerDistanceMoyenne(poule) {
    let total = 0;
    let count = 0;

    const n = poule.equipes.length;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            total += distance(poule.equipes[i], poule.equipes[j]);
            count++;
        }
    }

    poule.distance_moyenne = count > 0 ? total / count : 0;
}

function equilibrerDistancesMoyennes(poules) {
    let amelioration = true;
    let iterations = 0;
    const MAX_ITER = 50;

    while (amelioration && iterations < MAX_ITER) {
        amelioration = false;
        iterations++;

        // 1. Trier les poules (pire en premier)
        poules.sort((a, b) => b.distance_moyenne - a.distance_moyenne);

        let scoreAvantGlobal = scoreGlobal(poules);

        // 2. On prend la pire poule
        const pire = poules[0];

        let meilleurMouvement = null;
        let meilleurGain = 0;

        // 3. Tester chaque équipe de la pire poule
        for (let i = 0; i < pire.equipes.length; i++) {
            const equipe = pire.equipes[i];

            // --- TEST : déplacement simple ---
            for (const pCible of poules) {
                if (pCible === pire) continue;

                if (pCible.equipes.length >= pCible.nb_max) continue;
                if (verifierClubDansPoule(pCible, equipe)) continue;

                // simulation
                pire.equipes.splice(i, 1);
                pCible.equipes.push(equipe);

                recalculerDistanceMoyenne(pire);
                recalculerDistanceMoyenne(pCible);

                let scoreApres = scoreGlobal(poules);
                let gain = scoreAvantGlobal - scoreApres;

                // rollback
                pCible.equipes.pop();
                pire.equipes.splice(i, 0, equipe);

                recalculerDistanceMoyenne(pire);
                recalculerDistanceMoyenne(pCible);

                if (gain > meilleurGain) {
                    meilleurGain = gain;
                    meilleurMouvement = {
                        type: "move",
                        from: pire,
                        to: pCible,
                        index: i
                    };
                }
            }

            // --- TEST : échange ---
            for (const p2 of poules) {
                if (p2 === pire) continue;

                for (let j = 0; j < p2.equipes.length; j++) {
                    const e2 = p2.equipes[j];

                    if (
                        verifierClubDansPoule(pire, e2) ||
                        verifierClubDansPoule(p2, equipe)
                    ) continue;

                    // simulation
                    pire.equipes[i] = e2;
                    p2.equipes[j] = equipe;

                    recalculerDistanceMoyenne(pire);
                    recalculerDistanceMoyenne(p2);

                    let scoreApres = scoreGlobal(poules);
                    let gain = scoreAvantGlobal - scoreApres;

                    // rollback
                    pire.equipes[i] = equipe;
                    p2.equipes[j] = e2;

                    recalculerDistanceMoyenne(pire);
                    recalculerDistanceMoyenne(p2);

                    if (gain > meilleurGain) {
                        meilleurGain = gain;
                        meilleurMouvement = {
                            type: "swap",
                            p1: pire,
                            p2: p2,
                            i,
                            j
                        };
                    }
                }
            }
        }

        // 4. Appliquer le meilleur mouvement trouvé
        if (meilleurMouvement && meilleurGain > 0) {
            if (meilleurMouvement.type === "move") {
                const { from, to, index } = meilleurMouvement;
                const equipe = from.equipes.splice(index, 1)[0];
                to.equipes.push(equipe);

                recalculerDistanceMoyenne(from);
                recalculerDistanceMoyenne(to);
            }

            if (meilleurMouvement.type === "swap") {
                const { p1, p2, i, j } = meilleurMouvement;
                const temp = p1.equipes[i];
                p1.equipes[i] = p2.equipes[j];
                p2.equipes[j] = temp;

                recalculerDistanceMoyenne(p1);
                recalculerDistanceMoyenne(p2);
            }

            amelioration = true;
        }
    }
}*/

/*function finaliserStatistiquesPoules(poules) {
    poules.forEach(poule => {
        let sommeDistancesPoule = 0;
        let nbPaires = 0;
        const n = poule.equipes.length;

        //poule.equipes.forEach(e => e.distance_totale = 0);

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const d = distance(poule.equipes[i], poule.equipes[j]);
                
                poule.equipes[i].distance_totale += d;
                poule.equipes[j].distance_totale += d;

                //sommeDistancesPoule += d;
                //nbPaires++;
            }
        }

        //poule.distance_moyenne = nbPaires > 0 ? (sommeDistancesPoule / nbPaires).toFixed(2) : 0;
        
        poule.equipes.forEach(e => {
            e.distance_totale = e.distance_totale.toFixed(2);
        });
    });
}*/

/*function equilibrerDistancesMoyennes(poules) {
  let changement = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changement && iterations < MAX_ITERATIONS) {
    changement = false;
    iterations++;

    // Identifie la poule la plus chère et la moins chère
    const pMax = poules.reduce((a, b) =>
      a.distance_moyenne > b.distance_moyenne ? a : b,
    );
    const pMin = poules.reduce((a, b) =>
      a.distance_moyenne < b.distance_moyenne ? a : b,
    );

    // Si l'écart est déjà faible, inutile de continuer
    if (pMax.distance_moyenne - pMin.distance_moyenne < 10) break;

    let meilleurEchange = null;
    let meilleurEcart = pMax.distance_moyenne - pMin.distance_moyenne;

    // On cherche le meilleur échange entre pMax et pMin UNIQUEMENT
    for (let i = 0; i < pMax.equipes.length; i++) {
      for (let j = 0; j < pMin.equipes.length; j++) {
        const eMax = pMax.equipes[i];
        const eMin = pMin.equipes[j];

        const pMaxSansEMax = pMax.equipes.filter((_, idx) => idx !== i);
        const pMinSansEMin = pMin.equipes.filter((_, idx) => idx !== j);

        if (pMaxSansEMax.some((e) => e.num_club === eMin.num_club)) continue;
        if (pMinSansEMin.some((e) => e.num_club === eMax.num_club)) continue;

        // Simule l'échange
        const nouvelleDistMax = calculerDistanceMoyenne({
          equipes: [...pMaxSansEMax, eMin],
        });
        const nouvelleDistMin = calculerDistanceMoyenne({
          equipes: [...pMinSansEMin, eMax],
        });

        // Nouvel écart global après cet échange
        const distancesSimulees = poules.map((p) => {
          if (p === pMax) return nouvelleDistMax;
          if (p === pMin) return nouvelleDistMin;
          return p.distance_moyenne;
        });
        const nouvelEcart =
          Math.max(...distancesSimulees) - Math.min(...distancesSimulees);

        if (nouvelEcart < meilleurEcart) {
          meilleurEcart = nouvelEcart;
          meilleurEchange = { i, j, eMax, eMin };
        }
      }
    }

    if (meilleurEchange) {
      const { i, j, eMax, eMin } = meilleurEchange;

      pMax.equipes.splice(i, 1);
      pMin.equipes.splice(j, 1);

      //pMax.barycentre       = calculerBarycentre(pMax.equipes);
      //pMax.distance_moyenne = calculerDistanceMoyenne(pMax);
      //pMin.barycentre       = calculerBarycentre(pMin.equipes);
      //pMin.distance_moyenne = calculerDistanceMoyenne(pMin);

      ajouterEquipeDansPoule(pMax, eMin);
      ajouterEquipeDansPoule(pMin, eMax);

      changement = true;
    }
    // Si aucun échange entre pMax et pMin n'améliore → on arrête
    // (l'écart actuel est le minimum atteignable sous contrainte club)
  }

  console.log(`Équilibrage terminé en ${iterations} itération(s)`);
  return poules;
}*/

/*function equilibrerDistancesMoyennes(poules) {
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let meilleurEchange = null;

    // parcourir toutes les paires de poules
    for (let a = 0; a < poules.length; a++) {
      for (let b = a + 1; b < poules.length; b++) {
        const pA = poules[a];
        const pB = poules[b];

        let ecart = Math.abs(pA.distance_moyenne - pB.distance_moyenne);

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


            const nouvelEcart = Math.abs(nouvelleDistA - nouvelleDistB);

            if (nouvelEcart < ecart) {
              ecart = nouvelEcart;
              meilleurEchange = { a, b, i, j, eA, eB };
            }
          }
        }
      }
    }

    // ❌ aucun échange améliore → on arrête
    if (!meilleurEchange) break;

    // ✅ appliquer le meilleur échange global
    const { a, b, i, j, eA, eB } = meilleurEchange;

    poules[a].equipes.splice(i, 1);
    poules[b].equipes.splice(j, 1);

    ajouterEquipeDansPoule(poules[a], eB);
    ajouterEquipeDansPoule(poules[b], eA);
  }

  console.log(`Équilibrage terminé en ${iterations} itération(s)`);
  return poules;
}*/
