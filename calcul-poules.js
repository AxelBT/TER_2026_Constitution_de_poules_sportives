let config = JSON.parse(localStorage.getItem('championnatConfig'));
const clubs = JSON.parse(localStorage.getItem("clubs"));

//console.log(clubs);

if (!config) {
    window.location.href = 'poule.html'; 
   // return;
}


 const toastContainer = document.getElementById('toast-container');

    const ICONS = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    };

    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = (ICONS[type] || '') + '<span>' + msg + '</span>';
        toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }


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

export function traiterCSV(contenu) {
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
            
            // On peut décider de stopper le traitement ou d'ignorer l'équipe
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

    return data;
}

// Distance Haversine entre deux équipes (en km)
function distance(e1, e2) {
    const R = 6371;
    const dLat = (e2.latitude - e1.latitude) * Math.PI/180;
    const dLon = (e2.longitude - e1.longitude) * Math.PI/180;

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(e1.latitude * Math.PI/180) *
        Math.cos(e2.latitude * Math.PI/180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculerDistanceMoyenne(poule) {
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

// Barycentre géographique d'un tableau d'équipes
function calculerBarycentre(equipes) {
    if (equipes.length === 0) return null;

    const total = equipes.reduce((acc, e) => {
        acc.lat += e.latitude;
        acc.lon += e.longitude;
        return acc;
    }, { lat: 0, lon: 0 });

    return {
        latitude: total.lat / equipes.length,
        longitude: total.lon / equipes.length
    };
}

function definirCapacitesPoules(nb_poules, total_equipes) {
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
}

function initialiserPoules(nb_poules, niveau, capacites) {
    const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    return Array.from({ length: nb_poules }, (_, i) => ({
        nom: lettres[i],
        niveau: niveau,
        nb_max: capacites[i],
        equipes: [],
        distance_moyenne: 0,
        barycentre: null
    }));
}

function trierParTailleClub(equipes) {
    const count = {};
    equipes.forEach(e => {
        count[e.id_club] = (count[e.id_club] || 0) + 1;
    });

    // trier
    return equipes.sort((a, b) => {
        return count[b.id_club] - count[a.id_club];
    });
}

function choisirGrainesOptimisees(equipes, nb_poules, poules) {
    const nonGraines = [...equipes]; // on travaille sur une copie
 
    const barycentreGlobal = calculerBarycentre(equipes);
    let indexMax = 0;
    let distMax  = -1;
 
    for (let i = 0; i < nonGraines.length; i++) {
        const d = distance(nonGraines[i], barycentreGlobal);
        if (d > distMax) { distMax = d; indexMax = i; }
    }
 
    ajouterEquipeDansPoule(poules[0], nonGraines[indexMax]);
    nonGraines.splice(indexMax, 1);
 
    for (let g = 1; g < nb_poules; g++) {
        const graines = poules.slice(0, g).map(p => p.equipes[0]); // graines déjà placées
 
        let meilleurIndex = 0;
        let meilleurScore = -1; // on cherche le MAX
 
        for (let i = 0; i < nonGraines.length; i++) {
            const minDist = Math.min(...graines.map(gr => distance(nonGraines[i], gr)));
 
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

function verifierClubDansPoule(poule, equipe) {
    return poule.equipes.some(e => e.id_club === equipe.id_club);
}

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
function choisirMeilleurePoule(poules, equipe) {
    let meilleure    = null;
    let minDist      = Infinity;
 
    for (const p of poules) {
        
        if (p.equipes.length >= p.nb_max) continue;
 
        
        if (verifierClubDansPoule(p, equipe)) continue;
 
        
        const bary = p.barycentre;
        if (!bary) continue; // ne devrait pas arriver (graine toujours présente)
 
        const d = distance(equipe, bary);
        if (d < minDist) {
            minDist   = d;
            meilleure = p;
        }
    }
 
    return meilleure;
}


function ajouterEquipeDansPoule(poule, equipe) {
    poule.equipes.push(equipe);
    poule.barycentre = calculerBarycentre(poule.equipes);
    poule.distance_moyenne = calculerDistanceMoyenne(poule);
}

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

function tenterSauvetage(poules, equipe) {
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
}

function verifierContraintes(equipes, nb_poules) {
    const count = {};

    equipes.forEach(e => {
        count[e.id_club] = (count[e.id_club] || 0) + 1;
    });

    const max = Math.max(...Object.values(count));
    return max <= nb_poules;
}

function finaliserStatistiquesPoules(poules) {
    poules.forEach(poule => {
        let sommeDistancesPoule = 0;
        let nbPaires = 0;
        const n = poule.equipes.length;

        poule.equipes.forEach(e => e.distance_totale = 0);

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const d = distance(poule.equipes[i], poule.equipes[j]);
                
                poule.equipes[i].distance_totale += d;
                poule.equipes[j].distance_totale += d;

                sommeDistancesPoule += d;
                nbPaires++;
            }
        }

        poule.distance_moyenne = nbPaires > 0 ? (sommeDistancesPoule / nbPaires).toFixed(2) : 0;
        
        poule.equipes.forEach(e => {
            e.distance_totale = e.distance_totale.toFixed(2);
        });
    });
}


export function generer_poules(equipes, nb_poules, nb_max) {
    const nb_equipes = equipes.length;
 
    if (nb_poules * nb_max < nb_equipes) {
        toast("Capacité insuffisante : augmente le nombre de poules ou la taille max.", "error");
        return;
    }
 
    if (nb_equipes <= nb_poules * (nb_max - 1)) {
        toast("Trop peu d'équipes : réduis le nombre de poules ou la taille max.", "error");
        return;
    }
    
    if (!verifierContraintes(equipes, nb_poules)) {
        toast("Trop d\'équipes d\'un même club pour le nombre de poules.", "error");
        return;
    }
 
    
    const capacites = definirCapacitesPoules(nb_poules, nb_equipes);
    const poules    = initialiserPoules(nb_poules, config.niveauActuel, capacites);
 
    let restantes = choisirGrainesOptimisees(equipes, nb_poules, poules);
    restantes = trierParTailleClub(restantes);

    for (const equipe of restantes) {
        const meilleure = choisirMeilleurePoule(poules, equipe);
 
        if (meilleure) {
            ajouterEquipeDansPoule(meilleure, equipe);
        } else {
            console.warn("Sauvetage nécessaire pour :", equipe.nom);
            const succes = tenterSauvetage(poules, equipe);
 
            if (!succes) {
                toast(`Échec critique : "${equipe.nom}" ne peut pas être placée.`, "error");
            }
        }
    }


    finaliserStatistiquesPoules(poules);
    console.log("Poules générées :", poules);
    return poules;
}

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






