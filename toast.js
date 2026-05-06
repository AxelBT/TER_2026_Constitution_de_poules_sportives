const toastContainer = document.getElementById("toast-container");

const ICONS = {
  success:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

export function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;

  // Bouton fermer uniquement pour les erreurs
  const btnFermer =
    type === "error"
      ? `<button class="toast-close" aria-label="Fermer">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                   <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
               </svg>
           </button>`
      : "";

  el.innerHTML = (ICONS[type] || "") + "<span>" + msg + "</span>" + btnFermer;
  toastContainer.appendChild(el);

  // disparition immédiate
  if (type === "error") {
    el.querySelector(".toast-close").addEventListener("click", () => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 300);
    });
    // Pas de disparition automatique pour les erreurs
    return;
  }

  // Durées selon le type
  const durees = {
    success: 4000,
    warn: 6000,
    info: 4000,
  };

  const duree = durees[type] || 4000;
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 300);
  }, duree);
}

export function afficherErreur(titre, message) {
    const overlay = document.getElementById("modal-erreur");
    document.getElementById("modal-erreur-titre").textContent = titre;
    document.getElementById("modal-erreur-message").textContent = message;
    overlay.style.display = "flex";

    document.getElementById("modal-erreur-btn").onclick = () => {
      overlay.style.display = "none";
    };
  }


/*export function toast(msg, type = "success") {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = (ICONS[type] || "") + "<span>" + msg + "</span>";
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }*/
