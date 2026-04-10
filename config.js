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
            console.log('Submit déclenché');

            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = function (e) {
                const contenu = e.target.result;
                const clubs = traiter_csv_clubs(contenu);

                const config = {
                    categorie: document.getElementById('cat-select').value,
                    niveaux: parseInt(document.getElementById('nb_niveaux').value),
                    genre: document.querySelector('input[name="genre"]:checked').value,
                    niveauActuel: 1
                };

                console.log('Config:', config);
                console.log('Clubs', clubs);

                const params = new URLSearchParams({
                    categorie: config.categorie,
                    niveaux: config.niveaux,
                    genre: config.genre,
                    niveauActuel: config.niveauActuel
                });
                localStorage.setItem("clubs", JSON.stringify(clubs));

                localStorage.setItem('championnatConfig', JSON.stringify(config));

                window.location.href = 'niveau.html?' + params.toString();
            };
            reader.readAsText(file);
        });
    }
});



function traiter_csv_clubs(contenu) {
    const lignes = contenu.split("\n");
    const data = [];
    const ignores = [];

    for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;

        const colonnes = lignes[i].split(";");

        const lat = parseFloat(colonnes[2]);
        const lng = parseFloat(colonnes[3]);

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            ignores.push(colonnes[1]?.trim() || `ligne ${i + 1}`);
            continue;
        }

        data.push({
            id: colonnes[0]?.trim(),
            nom: colonnes[1]?.trim(),
            latitude: lat,
            longitude: lng,
        });
    }

    if (ignores.length > 0) {
        console.warn(`${ignores.length} club(s) ignoré(s) (coordonnées manquantes ou nulles) :`, ignores);
        toast(`${ignores.length} club(s) ignoré(s) faute de coordonnées : ${ignores.join(', ')}.`, 'warn');
    }

    return data;
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