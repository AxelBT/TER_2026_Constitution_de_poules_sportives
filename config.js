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

            reader.onload = function (event) {
                const contenu = event.target.result;
                const [clubs, clubs_ignores] = traiter_csv_clubs(contenu);

                if (clubs.length === 0) {
                    toast("Aucun club valide trouvé dans le fichier.", "error");
                    return;
                }

                const config = {
                    categorie: document.getElementById('cat-select').value,
                    niveaux: parseInt(document.getElementById('nb_niveaux').value),
                    genre: document.querySelector('input[name="genre"]:checked').value,
                    niveauActuel: 1,
                    mode: modeGeneration
                };

                const params = new URLSearchParams({
                    categorie: config.categorie,
                    niveaux: config.niveaux,
                    genre: config.genre,
                    niveauActuel: config.niveauActuel,
                    mode: config.mode
                });

                localStorage.setItem("clubs", JSON.stringify(clubs));
                localStorage.setItem('championnatConfig', JSON.stringify(config));
                localStorage.setItem('clubs_ignorés', JSON.stringify(clubs_ignores));
                document.getElementById('loader').style.display = 'flex';
                setTimeout(() => {
                    document.getElementById('loader').style.display = 'none';
                    }, 3000); 
                window.location.href = 'niveau.html?' + params.toString();
            };

            reader.readAsText(file);
        });
    }
});


function traiter_csv_clubs(contenu) {
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

        const id       = colonnes[0] || "";
        const nom      = colonnes[1] || "";
        const adresse  = colonnes[2] || "";
        const complement = colonnes[3] || "";
        const commune  = colonnes[4] || "";
        const codePostal = colonnes[5] || "";
        const type     = colonnes[6] || "club";
        const lng      = parseFloat(colonnes[7]);
        const lat      = parseFloat(colonnes[8]);

        if (!nom) {
            ignores.push(`ligne ${i + 1}`);
            continue;
        }

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`✗ ${nom} — coordonnées manquantes ou invalides`);
            ignores.push(nom);
            continue;
        }

        const rueEtComplement = [adresse, complement]
            .filter(part => part.length > 0)
            .join(" ");

        data.push({
            id_club: id,
            nom: nom,
            latitude: lat,
            longitude: lng,
            adresse: `${rueEtComplement} ${codePostal} ${commune}`.trim(),
            type: type.trim()
        });



        
        console.log(`✓ ${nom} (${lat}, ${lng})`);
    }

    console.log(`Résultat: ${data.length} clubs chargés, ${ignores.length} ignorés`);

    if (ignores.length > 0) {
        console.warn(`${ignores.length} club(s) ignoré(s) :`, ignores);
        const preview = ignores.slice(0, 3).join(', ');
        toast(`${ignores.length} club(s)sans coordonnées ignoré(s) : ${preview}${ignores.length > 3 ? '...' : ''}.`, 'warn');
    }

    return [data, ignores];
}