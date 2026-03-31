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

    console.log(form);
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const config = {
                nom: document.getElementById('nom_championnat').value,
                niveaux: parseInt(document.getElementById('nb_niveaux').value),
                genre: document.querySelector('input[name="genre"]:checked').value,
                niveauActuel: 1
            };

            localStorage.setItem('championnatConfig', JSON.stringify(config));
            window.location.href = 'niveau.html';
        });
    }
});