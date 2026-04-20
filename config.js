import {toast} from "./toast.js";

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('form-config');
    const fileInput = document.getElementById('file_csv');
    const fileLabel = document.getElementById('file-label');


    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileLabel.innerText = "Fichier prêt : " + e.target.files[0].name;
            }
        });
    }

    
    if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const file = fileInput.files[0];
       
        if (!file) {
            alert("Veuillez importer un fichier CSV des clubs.");
            return; 
        }

        const selectedModeId = document.querySelector('input[name="generation-choice"]:checked').id;
        const modeGeneration = selectedModeId === 'gen-distance' ? 'distance' : 'niveau';

        const reader = new FileReader();
        
        reader.onload = async function (event) {
            const contenu = event.target.result;
            console.log('Submit déclenché');
            const [clubs, clubs_ignores] = await traiter_csv_clubs(contenu);

            const config = {
                categorie: document.getElementById('cat-select').value,
                niveaux: parseInt(document.getElementById('nb_niveaux').value),
                genre: document.querySelector('input[name="genre"]:checked').value,
                niveauActuel: 1,
                mode: modeGeneration 
            };

            console.log('Config:', config);
            console.log('Clubs', clubs);


            const params = new URLSearchParams({
                categorie: config.categorie,
                niveaux: config.niveaux,
                genre: config.genre,
                niveauActuel: config.niveauActuel,
                mode: config.mode 
            });

            localStorage.setItem("clubs", JSON.stringify(clubs));
            localStorage.setItem('championnatConfig', JSON.stringify(config));
            localStorage.setItem('clubsIgnorés', JSON.stringify(clubs_ignores));

            window.location.href = 'niveau.html?' + params.toString();
        };
        
        reader.readAsText(file);
    });
}
});



async function traiter_csv_clubs(contenu) {
    const data = [];
    const ignores = [];
    
    const lignes = contenu.trim().split("\n");
    console.log("Début du traitement");
    const parserLigneCsv = (ligne) => {
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        return ligne.split(regex).map(cell => cell.replace(/^"|"$/g, '').trim());
    };

    for (let i = 1; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;

        const colonnes = parserLigneCsv(lignes[i]);
        
        const id = colonnes[0] || "";
        const nom = colonnes[1] || "";
        const adresse = colonnes[2] || "";
        const complement = colonnes[3] || "";
        const commune = colonnes[4] || "";
        const codePostal = colonnes[5] || "";
        const type = colonnes[7] || "club";
        
        if (!commune) {
            ignores.push(nom || `ligne ${i + 1}`);
            continue;
        }
        
        const rueEtComplement = [adresse, complement]
            .filter(part => part.length > 0)
            .join(" ");
            
        const rechercheApi = rueEtComplement || commune;
        
        try {
            const coords = await geocoderAdresse(rechercheApi, codePostal);
            
            if (coords) {
                data.push({
                    id: id,
                    nom: nom,
                    latitude: coords.lat,
                    longitude: coords.lng,
                    adresse: `${rueEtComplement} ${codePostal} ${commune}`.trim(),
                    type : `${type}`.trim()
                    
                });
                console.log(`✓ ${nom} géocodé`);
            } else {
                ignores.push(nom || `ligne ${i + 1}`);
                console.warn(`✗ ${nom} non géocodé`);
            }
        } catch (error) {
            console.error(`Erreur géocodage pour ${nom}:`, error);
            ignores.push(nom || `ligne ${i + 1}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Résultat: ${data.length} clubs géocodés, ${ignores.length} ignorés`);

    if (ignores.length > 0) {
        console.warn(`${ignores.length} club(s) ignoré(s) (géocodage échoué) :`, ignores);
        const preview = ignores.slice(0, 3).join(', ');
        if (typeof toast !== 'undefined') {
            toast(`${ignores.length} club(s) ignoré(s) : ${preview}${ignores.length > 3 ? '...' : ''}.`, 'warn');
        }
    }

    return [data, ignores];
}

async function geocoderAdresse(adresse, codePostal = "") {
    try {
        let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`;
        
        if (codePostal) {
            url += `&postcode=${encodeURIComponent(codePostal)}`;
        }

        console.log("Tentative de fetch sur l'URL :", url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates;
            const score = data.features[0].properties.score;
            
            if (score > 0.3) {
                return { lat: coords[1], lng: coords[0] };
            }
        }
        return null;
    } catch (error) {
        console.error("Erreur lors du géocodage:", error);
        return null;
    }
}

/* async function traiter_csv_clubs(contenu) {
    const lignes = contenu.split("\n");
    const data = [];
    const ignores = [];

    for (let i = 1; i < lignes.length; i++) { // skip header
        if (lignes[i].trim() === "") continue;

        const colonnes = lignes[i].split(";");

        const id = colonnes[0]?.trim();
        const nom = colonnes[1]?.trim();
        const adresse = colonnes[2]?.trim();
        const ville = colonnes[4]?.trim();
        const codePostal = colonnes[5]?.trim();

        const adresseComplete = `${adresse}, ${codePostal} ${ville}, France`;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresseComplete)}`);
            const geo = await res.json();

            if (!geo || geo.length === 0) {
                ignores.push(nom);
                continue;
            }

            const lat = parseFloat(geo[0].lat);
            const lng = parseFloat(geo[0].lon);

            data.push({
                id,
                nom,
                latitude: lat,
                longitude: lng,
            });

        } catch (e) {
            ignores.push(nom);
        }
    }

    if (ignores.length > 0) {
        console.warn(`${ignores.length} club(s) ignoré(s) :`, ignores);
    }

    return data;
}*/