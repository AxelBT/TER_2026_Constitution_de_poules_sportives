document.addEventListener('DOMContentLoaded', () => {
    let config = JSON.parse(localStorage.getItem('championnatConfig'));
    
    if (!config) {
        window.location.href = 'poule.html'; // Retour au début si erreur
        return;
    }

    const titre = document.getElementById('titre-niveau');
    titre.innerText = `Niveau ${config.niveauActuel} / ${config.niveaux}`;

    const map = L.map('map').setView([46.6033, 1.8883], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const btnPrev = document.getElementById('btn-prev');
    if (config.niveauActuel === 1) {
        btnPrev.style.display = 'none'; // Cache le bouton au niveau 1
    }

    btnPrev.addEventListener('click', () => {
        if (config.niveauActuel > 1) {
            config.niveauActuel--; 
            localStorage.setItem('championnatConfig', JSON.stringify(config));
            window.location.reload(); 
        }
    });

    
    const btnNext = document.getElementById('btn-next');
    
    // Si on est au dernier niveau, on change le texte
    if (config.niveauActuel === config.niveaux) {
        btnNext.innerText = "Voir le récapitulatif 🎉";
        btnNext.style.background = "#7c3aed"; 
    }

    btnNext.addEventListener('click', () => {
        if (config.niveauActuel < config.niveaux) {
            config.niveauActuel++; // On incrémente
            localStorage.setItem('championnatConfig', JSON.stringify(config));
            window.location.reload();
        } else {
            window.location.href = 'récapitulatif.html';
        }
    });

    // 6. Logique du bouton GÉNÉRER (Simulée)
    document.getElementById('btn-generer').addEventListener('click', () => {
        const resultsContainer = document.getElementById('pool-results');
        resultsContainer.innerHTML = '<div class="pool-card"><h4>Poule A</h4><p>Équipes générées...</p></div>';
        document.getElementById('stats-content').innerText = "Poules générées avec succès.";
    });
});