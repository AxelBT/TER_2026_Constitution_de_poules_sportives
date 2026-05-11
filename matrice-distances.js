import { toast } from "./toast.js";

let config = JSON.parse(localStorage.getItem("championnatConfig"));

const RATE_LIMIT_PER_SECOND = 4;
const ENDPOINT_ITINERAIRE = "https://data.geopf.fr/navigation/itineraire";

export async function calculerEtStockerMatrice(
  clubsUtilises,
  storageKey,
  onProgress,
) {
  const matrice = await calculerMatriceDistances(clubsUtilises, onProgress);
  localStorage.setItem(storageKey, JSON.stringify(matrice));
  console.log(
    `[matriceDistances] Stockée dans localStorage["${storageKey}"] (${clubsUtilises.length} clubs)`,
  );

  return matrice;
}


export function chargerMatrice(storageKey) {
  const brut = localStorage.getItem(storageKey);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch (err) {
    console.warn(
      `[matriceDistances] Échec parse localStorage["${storageKey}"] :`,
      err,
    );
    return null;
  }
}

export function effacerMatrice(storageKey) {
  localStorage.removeItem(storageKey);
}

export function extraireClubsUtilises(tousLesClubs, equipes) {
  const idsUtilises = new Set(equipes.map((eq) => eq.num_club).filter(Boolean));
  const utilises = tousLesClubs.filter((c) => idsUtilises.has(c.id_club));

  if (utilises.length < idsUtilises.size) {
    const trouves = new Set(utilises.map((c) => c.id_club));
    const manquants = [...idsUtilises].filter((id) => !trouves.has(id));
    console.warn(
      `[matriceDistances] ${manquants.length} club(s) absent(s) du CSV :`,
      manquants,
    );
  }

  console.log(
    `[matriceDistances] ${utilises.length}/${tousLesClubs.length} clubs utilisés (${equipes.length} équipes)`,
  );
  return utilises;
}

async function calculerMatriceDistances(clubs, onProgress) {
  const n = clubs.length;

  // Matrice indexée par id_club : matrice[idA][idB] = distance
  const matrice = {};
  for (const c of clubs) {
    matrice[c.id_club] = {};
    matrice[c.id_club][c.id_club] = 0; // diagonale
  }

  const paires = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      paires.push([clubs[i], clubs[j]]);
    }
  }

  console.log(
    `[matriceDistances] ${n} clubs → ${paires.length} paires uniques à interroger`,
  );

  const intervalMs = 1000 / RATE_LIMIT_PER_SECOND;
  let traitees = 0;

  for (const [clubA, clubB] of paires) {
    const debut = performance.now();

    try {
      const dist = await fetchDistance(clubA, clubB);
      matrice[clubA.id_club][clubB.id_club] = dist;
      matrice[clubB.id_club][clubA.id_club] = dist;
    } catch (err) {
      console.warn(
        `[matriceDistances] Échec ${clubA.nom} → ${clubB.nom} : ${err.message}. ` +
          `Distance mise à Infinity.`,
      );
      matrice[clubA.id_club][clubB.id_club] = Infinity;
      matrice[clubB.id_club][clubA.id_club] = Infinity;
    }

    traitees++;
    if (typeof onProgress === "function") {
      onProgress(traitees, paires.length);
    }
    if (traitees % 20 === 0 || traitees === paires.length) {
      console.log(
        `[matriceDistances] ${traitees}/${paires.length} paires traitées`,
      );
    }

    const ecoule = performance.now() - debut;
    if (ecoule < intervalMs && traitees < paires.length) {
      await new Promise((r) => setTimeout(r, intervalMs - ecoule));
    }
  }

  return matrice;
}

export function distance(e1, e2) {
  if (e2.num_club && config.typeDistance === "voiture") {
    return getDistance(e1.num_club, e2.num_club);
  }
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

export function getDistance(idA, idB) {
  const matrice = chargerMatrice(
    `matriceDistances:niveau${config.niveauActuel}`,
  );
  if (idA === idB) return 0;
  const dist = matrice?.[idA]?.[idB];
  if (dist === undefined) {
    console.warn(
      `[matriceDistances] Distance non trouvée entre "${idA}" et "${idB}"`,
    );
    return Infinity;
  }
  return dist;
}

async function fetchDistance(clubA, clubB) {
  const body = {
    start: `${clubA.longitude},${clubA.latitude}`,
    end: `${clubB.longitude},${clubB.latitude}`,
    resource: "bdtopo-osrm",
    profile: "car",
    optimization: "fastest",
    distanceUnit: "kilometer",
    timeUnit: "hour",
  };

  const response = await fetch(ENDPOINT_ITINERAIRE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  if (typeof data.distance !== "number") {
    throw new Error("Réponse sans champ distance");
  }
  return data.distance;
}
