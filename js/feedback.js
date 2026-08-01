/* ══════════════════ retours des étudiants ══════════════════
   Bouton flottant + boîte de dialogue présents sur toutes les pages.
   Le site est statique (GitHub Pages) : les retours sont enregistrés dans
   un fichier JSON partagé hébergé en ligne, et tout le monde peut les
   consulter sur la page « Retours » (feedbacks.html). */
(function(){
"use strict";

/* le fichier JSON partagé — remplacer REPLACE_ME par l'identifiant du bin */
const STORE = "https://api.npoint.io/d9cc13a49b8a005484cc";

/* les pages du dossier chapitres/ sont un niveau plus bas que la racine */
const ROOT = /\/chapitres\//.test(location.pathname) ? "../" : "";

const TYPES = [
  "Erreur dans le cours, un exercice ou une carte",
  "Point pas clair / question",
  "Suggestion d'amélioration",
  "Autre remarque"
];

const css = `
.fb-open{
  position:fixed; right:18px; bottom:18px; z-index:60;
  display:inline-flex; align-items:center; gap:8px;
  font-family:var(--mono); font-size:11.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink-2); background:var(--surface); border:1px solid var(--line);
  border-radius:999px; padding:9px 16px; cursor:pointer; box-shadow:var(--shadow);
}
.fb-open:hover{ color:var(--ink); border-color:var(--ink-3) }
.fb-dlg{
  border:1px solid var(--line); border-radius:14px; padding:0;
  background:var(--surface); color:var(--ink); box-shadow:var(--shadow);
  width:min(480px, calc(100vw - 32px));
}
.fb-dlg::backdrop{ background:rgba(10,18,24,.45) }
.fb-body{ padding:22px 22px 18px }
.fb-tag{
  display:block; font-family:var(--mono); font-size:10.5px; letter-spacing:.15em;
  text-transform:uppercase; color:var(--ink-3); margin-bottom:6px;
}
.fb-h{ font-family:var(--serif); font-weight:400; font-size:1.45rem; margin:0 0 4px }
.fb-sub{ font-size:13.5px; color:var(--ink-2); margin:0 0 16px }
.fb-body label{
  display:block; font-family:var(--mono); font-size:10.5px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--ink-3); margin:12px 0 5px;
}
.fb-body select,.fb-body input,.fb-body textarea{
  width:100%; box-sizing:border-box; font:inherit; font-size:14px; color:var(--ink);
  background:var(--surface-2); border:1px solid var(--line); border-radius:8px; padding:8px 10px;
}
.fb-body textarea{ min-height:96px; resize:vertical }
.fb-body select:focus,.fb-body input:focus,.fb-body textarea:focus{
  outline:none; border-color:var(--glass);
}
.fb-actions{ display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; align-items:center }
.fb-btn{
  font-family:var(--mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase;
  border:1px solid var(--line); border-radius:8px; background:var(--surface-2);
  color:var(--ink-2); padding:9px 14px; cursor:pointer;
}
.fb-btn:hover{ color:var(--ink); border-color:var(--ink-3) }
.fb-btn:disabled{ opacity:.55; cursor:default }
.fb-btn.main{ background:var(--beam-soft); border-color:var(--beam); color:var(--ink) }
.fb-cancel{ margin-left:auto }
.fb-view{
  font-family:var(--mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ink-3); text-decoration:none; padding:9px 2px;
}
.fb-view:hover{ color:var(--ink) }
.fb-note{ font-size:12.5px; color:var(--ink-3); margin:12px 0 0; min-height:1em }
.fb-note b,.fb-note a{ color:var(--ink-2) }
.fb-flink{
  display:inline-block; margin-top:12px;
  font-family:var(--mono); font-size:11.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink-2); text-decoration:none; border-bottom:1px solid var(--line);
}
.fb-flink:hover{ color:var(--ink); border-color:var(--ink-3) }
@media (max-width:720px){ .fb-open{ right:12px; bottom:12px; padding:8px 13px } }
@media print{ .fb-open,.fb-dlg,.fb-flink{ display:none } }
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

/* ——— accès au fichier JSON partagé ——— */
async function loadAll(){
  const r = await fetch(STORE, {cache:"no-store"});
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  return (data && Array.isArray(data.feedbacks)) ? data : {feedbacks:[]};
}
async function saveAll(data){
  const r = await fetch(STORE, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data)
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
}
/* partagé avec la page feedbacks.html */
window.FB = {STORE, loadAll, TYPES};

/* ——— bouton flottant ——— */
const btn = document.createElement("button");
btn.type = "button";
btn.className = "fb-open";
btn.innerHTML = "✉ Un avis&nbsp;?";
btn.setAttribute("aria-haspopup", "dialog");
document.body.appendChild(btn);

/* ——— lien « retours » dans le pied de page ——— */
const foot = document.querySelector("footer .wrap");
if (foot && !/feedbacks\.html$/.test(location.pathname)){
  const a = document.createElement("a");
  a.className = "fb-flink";
  a.href = ROOT + "feedbacks.html";
  a.textContent = "→ Retours des étudiants";
  foot.appendChild(a);
}

/* ——— boîte de dialogue ——— */
const dlg = document.createElement("dialog");
dlg.className = "fb-dlg";
dlg.innerHTML = `
  <form class="fb-body" method="dialog">
    <span class="fb-tag">Retour d'étudiant</span>
    <h3 class="fb-h">Aide-nous à améliorer le cours</h3>
    <p class="fb-sub">Une erreur, un passage obscur, une idée&nbsp;? Dis-le ici :
    ta remarque est enregistrée et visible par tous sur la page
    <a href="${ROOT}feedbacks.html">Retours</a>.</p>

    <label for="fb-type">Type de remarque</label>
    <select id="fb-type">${TYPES.map(t => `<option>${t}</option>`).join("")}</select>

    <label for="fb-where">Où&nbsp;? (page, chapitre, n° de carte ou d'exercice)</label>
    <input id="fb-where" type="text">

    <label for="fb-msg">Ta remarque</label>
    <textarea id="fb-msg" required placeholder="Décris ce que tu as vu, le plus précisément possible…"></textarea>

    <label for="fb-name">Ton nom (facultatif)</label>
    <input id="fb-name" type="text" autocomplete="name">

    <div class="fb-actions">
      <button type="button" class="fb-btn main" id="fb-send">Envoyer</button>
      <a class="fb-view" href="${ROOT}feedbacks.html">Voir les retours</a>
      <button type="submit" class="fb-btn fb-cancel" value="cancel">Fermer</button>
    </div>
    <p class="fb-note" id="fb-note"></p>
  </form>`;
document.body.appendChild(dlg);

/* les raccourcis clavier de la page (cartes de révision…) ne doivent pas
   réagir pendant que l'étudiant écrit dans la boîte de dialogue */
dlg.addEventListener("keydown", e => e.stopPropagation());

const $ = id => dlg.querySelector("#" + id);
const note = $("fb-note");

/* la page où l'étudiant se trouvait, pré-remplie mais modifiable */
const pageName = (document.title || "").replace(/\s*—\s*Optique géométrique\s*$/i, "");

btn.addEventListener("click", () => {
  $("fb-where").value = $("fb-where").value || pageName;
  note.textContent = "";
  dlg.showModal();
  $("fb-msg").focus();
});

function compose(){
  const msg = $("fb-msg").value.trim();
  if (!msg){
    note.textContent = "Écris d'abord ta remarque dans le champ « Ta remarque ».";
    $("fb-msg").focus();
    return null;
  }
  return {
    date: new Date().toISOString(),
    page: $("fb-where").value.trim() || pageName,
    type: $("fb-type").value,
    message: msg,
    nom: $("fb-name").value.trim()
  };
}

$("fb-send").addEventListener("click", async () => {
  const entry = compose();
  if (!entry) return;
  const b = $("fb-send");
  b.disabled = true; b.textContent = "Envoi…"; note.textContent = "";
  try {
    /* lecture du fichier, ajout à la fin, réécriture */
    const data = await loadAll();
    data.feedbacks.push(entry);
    await saveAll(data);
    $("fb-msg").value = ""; $("fb-name").value = "";
    note.innerHTML = "Merci&nbsp;! Ta remarque est enregistrée — " +
      "<a href='" + ROOT + "feedbacks.html'>voir tous les retours</a>.";
  } catch(e){
    note.textContent = "Échec de l'envoi (" + e.message +
      "). Vérifie ta connexion et réessaie — ton texte est conservé.";
  }
  b.disabled = false; b.textContent = "Envoyer";
});
})();
