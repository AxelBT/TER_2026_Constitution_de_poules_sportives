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

    for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].trim() === "") continue;

        const colonnes = lignes[i].split(";");

        data.push({
            id: colonnes[0],
            nom: colonnes[1],
            latitude: parseFloat(colonnes[2]),
            longitude: parseFloat(colonnes[3])
        });
    }

    return data;
};