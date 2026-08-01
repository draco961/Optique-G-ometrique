/* ══════════════════ helpers ══════════════════ */
const RAD = Math.PI / 180;
const fmt = (x, d = 1) => {
  if (!isFinite(x)) return "∞";
  const s = Math.abs(x).toFixed(d).replace(".", ",");
  return (x < 0 ? "−" : "") + s;
};
const sgn = (x, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d).replace(".", ",");
const esc = s => String(s);

/* extend a ray from p along direction d until it leaves the rect */
function edge(p, d, r) {
  let t = Infinity;
  if (d.x > 1e-9) t = Math.min(t, (r.x2 - p.x) / d.x);
  if (d.x < -1e-9) t = Math.min(t, (r.x1 - p.x) / d.x);
  if (d.y > 1e-9) t = Math.min(t, (r.y2 - p.y) / d.y);
  if (d.y < -1e-9) t = Math.min(t, (r.y1 - p.y) / d.y);
  if (!isFinite(t) || t < 0) t = 0;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}
const norm = d => { const m = Math.hypot(d.x, d.y) || 1; return { x: d.x / m, y: d.y / m }; };
const L = (a, b, cls, extra = "") =>
  `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" class="${cls}" ${extra}/>`;
const T = (x, y, txt, cls, anchor = "middle") =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="${anchor}">${txt}</text>`;
const DOT = (x, y, cls, r = 4) =>
  `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" class="${cls}"/>`;

/* shared <defs>: markers + svg-local styling */
function defs(id) {
  const mk = (name, cls) =>
    `<marker id="${id}-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
       markerHeight="6" orient="auto-start-reverse">
       <path d="M0 0 L10 5 L0 10 z" class="mk ${cls}"/></marker>`;
  return `<defs>
    ${mk("beam", "mk-beam")}${mk("obj", "mk-obj")}${mk("img", "mk-img")}
    ${mk("axis", "mk-axis")}${mk("dim", "mk-dim")}
    <clipPath id="${id}-clip"><rect x="0" y="0" width="800" height="400"/></clipPath>
  </defs>
  <style>
    .mk-beam{fill:var(--beam)} .mk-obj{fill:var(--obj)} .mk-img{fill:var(--img)}
    .mk-axis{fill:var(--ink-3)} .mk-dim{fill:var(--ink-3)}
    .axis{stroke:var(--ink-3); stroke-width:1; stroke-dasharray:7 5; opacity:.75}
    .beam{stroke:var(--beam); stroke-width:1.9; fill:none; stroke-linecap:round}
    .beam-v{stroke:var(--beam); stroke-width:1.4; fill:none; stroke-dasharray:5 5; opacity:.8}
    .beam-dim{stroke:var(--beam); stroke-width:1.3; fill:none; opacity:.5}
    .obj{stroke:var(--obj); stroke-width:2.6; stroke-linecap:round}
    .img{stroke:var(--img); stroke-width:2.6; stroke-linecap:round}
    .img-v{stroke:var(--img); stroke-width:2.2; stroke-dasharray:6 4; stroke-linecap:round}
    .glass{stroke:var(--glass); stroke-width:2; fill:color-mix(in srgb,var(--glass) 14%,transparent)}
    .glass-l{stroke:var(--glass); stroke-width:1.6; fill:none}
    .hair{stroke:var(--ink-3); stroke-width:1; opacity:.5}
    .hair-d{stroke:var(--ink-3); stroke-width:1; stroke-dasharray:3 4; opacity:.55}
    .arc{stroke:var(--beam); stroke-width:1.2; fill:none; opacity:.85}
    .dot-obj{fill:var(--obj)} .dot-img{fill:var(--img)} .dot-key{fill:var(--ink-2)}
    .dot-beam{fill:var(--beam)}
    text{font-family:var(--sans); font-size:13px; fill:var(--ink-2)}
    .pt{font-family:var(--serif); font-size:15px; font-style:italic; fill:var(--ink)}
    .pt-obj{font-family:var(--serif); font-size:15px; font-style:italic; fill:var(--obj)}
    .pt-img{font-family:var(--serif); font-size:15px; font-style:italic; fill:var(--img)}
    .tag{font-family:var(--mono); font-size:11.5px; fill:var(--ink-3); letter-spacing:.04em}
    .tag-b{font-family:var(--mono); font-size:11.5px; fill:var(--beam); letter-spacing:.04em}
    .tag-o{font-family:var(--mono); font-size:11.5px; fill:var(--obj); letter-spacing:.04em}
    .tag-i{font-family:var(--mono); font-size:11.5px; fill:var(--img); letter-spacing:.04em}
    .tag-w{font-family:var(--mono); font-size:11.5px; fill:var(--warn); letter-spacing:.04em}
    .ang{font-family:var(--serif); font-size:14px; font-style:italic; fill:var(--beam)}
    .med{font-family:var(--mono); font-size:12px; fill:var(--ink-3)}
    .zone-1{fill:var(--glass); opacity:.07}
    .zone-2{fill:var(--beam); opacity:.05}
    .warnfill{fill:var(--warn); opacity:.85}
  </style>`;
}

/* ══════════════════ 1. SNELL ══════════════════ */
(function () {
  const svg = document.getElementById("sv-snell");
  if (!svg) return;   /* banc absent de cette page */
  const MEDIA = [
    { n: 1.0, name: "Air" }, { n: 1.33, name: "Eau" },
    { n: 1.5, name: "Verre" }, { n: 2.42, name: "Diamant" }
  ];
  const st = { i1: 50, n1: 2, n2: 0 };

  /* build the two medium selectors */
  ["n1", "n2"].forEach(key => {
    document.getElementById("c-" + key).innerHTML = MEDIA.map((m, i) =>
      `<label><input type="radio" name="${key}" value="${i}" ${st[key] === i ? "checked" : ""}>${m.name}</label>`
    ).join("");
    document.getElementById("c-" + key).addEventListener("change", e => {
      st[key] = +e.target.value; render();
    });
  });
  document.getElementById("c-i1").addEventListener("input", e => { st.i1 = +e.target.value; render(); });
  document.getElementById("p-snell").addEventListener("click", e => {
    const p = e.target.closest("button"); if (!p) return;
    const set = { dense: [30, 0, 1], rasant: [41, 2, 0], totale: [58, 2, 0], diam: [35, 3, 0] }[p.dataset.p];
    st.i1 = set[0]; st.n1 = set[1]; st.n2 = set[2];
    document.getElementById("c-i1").value = st.i1;
    document.querySelector(`input[name=n1][value="${st.n1}"]`).checked = true;
    document.querySelector(`input[name=n2][value="${st.n2}"]`).checked = true;
    render();
  });

  const Ix = 380, Iy = 200;
  const BOX = { x1: 16, y1: 16, x2: 744, y2: 404 };
  /* direction unitaire à l'angle a depuis la normale, vers le haut (up) ou le bas */
  const dir = (a, up) => ({ x: Math.sin(a * RAD) * (up ? 1 : 1), y: up ? -Math.cos(a * RAD) : Math.cos(a * RAD) });
  /* point situé à la fraction t du segment I→bord, décalé de (ox,oy) */
  const along = (p, d, t, ox = 0, oy = 0) => {
    const e = edge(p, d, BOX);
    return { x: p.x + (e.x - p.x) * t + ox, y: p.y + (e.y - p.y) * t + oy };
  };

  function render() {
    const n1 = MEDIA[st.n1].n, n2 = MEDIA[st.n2].n, i1 = st.i1;
    const sin2 = n1 * Math.sin(i1 * RAD) / n2;
    const total = sin2 > 1;
    const i2 = total ? null : Math.asin(sin2) / RAD;
    const lam = n1 > n2 ? Math.asin(n2 / n1) / RAD : null;

    const I = { x: Ix, y: Iy };
    const dInc = dir(i1, true);                                  /* I → source */
    const dRefl = { x: Math.sin(i1 * RAD), y: -Math.cos(i1 * RAD) };
    const inc = edge(I, { x: -dInc.x, y: dInc.y }, BOX);          /* point de départ, en haut à gauche */
    const refl = edge(I, dRefl, BOX);

    let g = defs("sn");
    /* media zones + interface */
    g += `<rect class="zone-1" x="0" y="0" width="760" height="${Iy}"/>`;
    g += `<rect class="zone-2" x="0" y="${Iy}" width="760" height="${420 - Iy}"/>`;
    g += L({ x: 20, y: Iy }, { x: 740, y: Iy }, "", 'stroke="var(--ink-2)" stroke-width="2"');
    /* hatching under the interface */
    for (let x = 24; x < 740; x += 22)
      g += L({ x, y: Iy }, { x: x - 9, y: Iy + 9 }, "hair");
    /* normal */
    g += L({ x: Ix, y: 22 }, { x: Ix, y: 408 }, "axis");
    g += T(Ix + 8, 34, "normale", "tag", "start");

    /* media labels */
    g += T(30, Iy - 22, `milieu 1 — ${MEDIA[st.n1].name}`, "med", "start");
    g += T(30, Iy - 6, `n₁ = ${fmt(n1, 2)}`, "med", "start");
    g += T(30, Iy + 22, `milieu 2 — ${MEDIA[st.n2].name}`, "med", "start");
    g += T(30, Iy + 38, `n₂ = ${fmt(n2, 2)}`, "med", "start");

    /* rays — toujours prolongés jusqu'au bord du cadre, jamais tronqués */
    g += L(inc, I, "beam", `marker-end="url(#sn-beam)"`);
    g += L(I, refl, total ? "beam" : "beam-dim", `marker-end="url(#sn-beam)"`);
    {
      const p = along(I, dRefl, 0.78, i1 > 55 ? 0 : 14, i1 > 55 ? -14 : 4);
      g += T(p.x, p.y, "réfléchi", total ? "tag-b" : "tag", "start");
    }
    if (!total) {
      const d2 = { x: Math.sin(i2 * RAD), y: Math.cos(i2 * RAD) };
      g += L(I, edge(I, d2, BOX), "beam", `marker-end="url(#sn-beam)"`);
      const p = along(I, d2, 0.66, i2 > 50 ? 0 : 16, i2 > 50 ? 20 : 4);
      g += T(p.x, p.y, `i₂ = ${fmt(i2)}°`, "tag-b", "start");
    }
    g += DOT(Ix, Iy, "dot-beam", 4.5);
    g += T(Ix - 12, Iy + 20, "I", "pt", "end");

    /* angle arcs */
    const arc = (a0, a1, r, cls) => {
      const p = a => ({ x: Ix + r * Math.sin(a * RAD), y: Iy - r * Math.cos(a * RAD) });
      const A = p(a0), B = p(a1);
      return `<path d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} A ${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${B.x.toFixed(1)} ${B.y.toFixed(1)}" class="${cls}"/>`;
    };
    g += arc(0, -i1, 62, "arc");
    g += T(Ix - 34 - 8 * Math.sin(i1 * RAD / 2), Iy - 66, `i₁`, "ang", "end");
    if (!total) {
      const p = a => ({ x: Ix + 62 * Math.sin(a * RAD), y: Iy + 62 * Math.cos(a * RAD) });
      const A = p(0), B = p(i2);
      g += `<path d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} A 62 62 0 0 0 ${B.x.toFixed(1)} ${B.y.toFixed(1)}" class="arc"/>`;
      g += T(Ix + 34, Iy + 78, `i₂`, "ang", "start");
    }
    /* repère de l'angle limite λ, du côté du rayon incident */
    if (lam !== null) {
      const dL = { x: -Math.sin(lam * RAD), y: -Math.cos(lam * RAD) };
      g += L(I, edge(I, dL, BOX), "hair-d");
      const p = along(I, dL, 0.72, -8, -8);
      g += T(p.x, p.y, `λ = ${fmt(lam)}°`, "tag", "end");
    }
    /* bandeau d'état */
    if (total) {
      g += T(Ix + 34, Iy + 56, "RÉFLEXION TOTALE", "tag-w", "start");
      g += T(Ix + 34, Iy + 74, "aucun rayon réfracté", "tag", "start");
    }
    svg.innerHTML = g;

    /* readouts */
    document.getElementById("v-i1").textContent = i1 + "°";
    document.getElementById("v-n1").textContent = fmt(n1, 2);
    document.getElementById("v-n2").textContent = fmt(n2, 2);

    const calc = document.getElementById("ro-snell-calc");
    let c = `<div class="step">n₁ sin i₁ = n₂ sin i₂</div>`;
    c += `<div class="step">${fmt(n1, 2)} × sin ${i1}° = ${fmt(n2, 2)} × sin i₂</div>`;
    c += `<div class="step">sin i₂ = <b>${fmt(sin2, 3)}</b></div>`;
    c += total
      ? `<div class="step">sin i₂ &gt; 1 → <b>impossible</b></div>`
      : `<div class="step">i₂ = <b>${fmt(i2)}°</b></div>`;
    calc.innerHTML = c;

    let v = `<dt>Angle d'incidence i₁</dt><dd>${fmt(i1, 0)}°</dd>`;
    v += `<dt>Angle réfléchi</dt><dd>${fmt(i1, 0)}°</dd>`;
    v += `<dt>Angle réfracté i₂</dt><dd>${total ? "—" : fmt(i2) + "°"}</dd>`;
    v += `<dt>Angle limite λ</dt><dd>${lam === null ? "n'existe pas" : fmt(lam) + "°"}</dd>`;
    document.getElementById("ro-snell-vals").innerHTML = v;

    const chips = [];
    if (n1 < n2) chips.push(`<span class="chip neutral">se rapproche de la normale</span>`);
    else if (n1 > n2) chips.push(`<span class="chip neutral">s'éloigne de la normale</span>`);
    else chips.push(`<span class="chip neutral">aucune déviation</span>`);
    if (total) chips.push(`<span class="chip warn">réflexion totale — i₁ ≥ λ</span>`);
    else if (lam !== null && i1 >= lam - 1.5) chips.push(`<span class="chip warn">réfraction rasante — i₂ → 90°</span>`);
    else chips.push(`<span class="chip ok">réfraction + réflexion partielle</span>`);
    if (lam === null && n1 < n2) chips.push(`<span class="chip neutral">pas de réflexion totale possible dans ce sens</span>`);
    document.getElementById("ro-snell-chips").innerHTML = chips.join("");
  }
  render();
})();

/* ══════════════════ 2. LENTILLE MINCE ══════════════════ */
(function () {
  const svg = document.getElementById("sv-lens");
  if (!svg) return;   /* banc absent de cette page */
  const st = { OA: -30, fp: 10, conv: true };
  const Ox = 400, y0 = 195, HOBJ = 52, CLIP = { x1: 4, y1: 4, x2: 796, y2: 396 };

  const cOA = document.getElementById("c-oa"), cFP = document.getElementById("c-fp");
  cOA.addEventListener("input", e => { st.OA = +e.target.value; render(); });
  cFP.addEventListener("input", e => { st.fp = +e.target.value; render(); });
  document.getElementById("c-lenstype").addEventListener("change", e => {
    st.conv = e.target.value === "conv"; render();
  });
  document.getElementById("p-lens").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (!st.conv) { st.conv = true; document.querySelector('input[name=lenstype][value=conv]').checked = true; }
    const f = st.fp;
    st.OA = { far: -3.1 * f, two: -2 * f, between: -1.5 * f, atf: -f, loupe: -0.55 * f }[b.dataset.p];
    st.OA = Math.max(-200, Math.min(-1, Math.round(st.OA * 2) / 2));
    cOA.value = st.OA; render();
  });

  /* drag the object along the axis */
  svg.addEventListener("pointerdown", e => {
    const cm = toCm(e);
    if (Math.abs(cm - st.OA) > 22 / scale) return;
    svg.setPointerCapture(e.pointerId);
    svg.dataset.drag = "1"; e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (svg.dataset.drag !== "1") return;
    st.OA = Math.max(-200, Math.min(-1, Math.round(toCm(e) * 2) / 2));
    cOA.value = st.OA; render();
  });
  const stop = e => { svg.dataset.drag = "0"; };
  svg.addEventListener("pointerup", stop); svg.addEventListener("pointercancel", stop);
  function toCm(e) {
    const r = svg.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width * 800 - Ox) / scale;
  }

  let scale = 4;

  function render() {
    const fp = st.conv ? st.fp : -st.fp;
    const OA = st.OA;
    const invOAp = 1 / fp + 1 / OA;
    const atInf = Math.abs(invOAp) < 1e-6;
    const OAp = atInf ? Infinity : 1 / invOAp;
    const gam = atInf ? Infinity : OAp / OA;

    /* échelle adaptative : objet, foyers et image finie tiennent dans le cadre */
    let ext = Math.max(Math.abs(OA), 2.2 * Math.abs(fp));
    if (isFinite(OAp) && Math.abs(OAp) <= 140) ext = Math.max(ext, Math.abs(OAp));
    ext *= 1.16;
    scale = Math.max(0.4, Math.min(26, 372 / ext));
    const X = cm => Ox + cm * scale;

    const xA = X(OA), xFp = X(fp), xF = X(-fp);
    const B = { x: xA, y: y0 - HOBJ };

    let g = defs("ln");
    /* axis */
    g += L({ x: 10, y: y0 }, { x: 792, y: y0 }, "hair");
    /* lens body */
    const lh = 128, bulge = 26;
    if (st.conv) {
      g += `<path d="M${Ox} ${y0 - lh} C ${Ox + bulge} ${y0 - lh * .4} ${Ox + bulge} ${y0 + lh * .4} ${Ox} ${y0 + lh}
                     C ${Ox - bulge} ${y0 + lh * .4} ${Ox - bulge} ${y0 - lh * .4} ${Ox} ${y0 - lh} z" class="glass"/>`;
    } else {
      const w = 15;
      g += `<path d="M${Ox - w} ${y0 - lh} C ${Ox + 10} ${y0 - 30} ${Ox + 10} ${y0 + 30} ${Ox - w} ${y0 + lh}
                     L ${Ox + w} ${y0 + lh} C ${Ox - 10} ${y0 + 30} ${Ox - 10} ${y0 - 30} ${Ox + w} ${y0 - lh} z" class="glass"/>`;
    }
    g += L({ x: Ox, y: y0 - lh - 14 }, { x: Ox, y: y0 + lh + 14 }, "hair-d");

    /* key points */
    const key = (x, label, sub) => {
      let s = DOT(x, y0, "dot-key", 3.5) + T(x, y0 + 22, label, "pt");
      if (sub) s += T(x, y0 + 38, sub, "tag");
      return s;
    };
    g += key(Ox, "O", "");
    g += key(xFp, "F′", `${sgn(fp)} cm`);
    g += key(xF, "F", `${sgn(-fp)} cm`);

    /* objet — la lettre se place à côté de l'axe pour ne jamais heurter F / O / F′ */
    g += L({ x: xA, y: y0 }, B, "obj", `marker-end="url(#ln-obj)"`);
    g += DOT(xA, y0, "dot-obj", 4);
    g += T(xA - 10, y0 - 7, "A", "pt-obj", "end");
    g += T(B.x, B.y - 12, "B", "pt-obj");
    g += `<circle cx="${xA}" cy="${y0 - HOBJ / 2}" r="17" fill="transparent" style="cursor:grab"/>`;

    /* ---- the three construction rays ---- */
    let rays = "";
    /* 1 · parallel to axis → through F′ */
    const P1 = { x: Ox, y: B.y };
    rays += L(B, P1, "beam", `marker-mid="url(#ln-beam)"`);
    const dirF = { x: xFp - P1.x, y: y0 - P1.y };
    const d1 = norm(dirF.x > 0 ? dirF : { x: -dirF.x, y: -dirF.y });
    rays += L(P1, edge(P1, d1, CLIP), "beam", `marker-end="url(#ln-beam)"`);
    if (!st.conv) rays += L(P1, edge(P1, { x: -d1.x, y: -d1.y }, CLIP), "beam-v");

    /* 2 · through the optical centre → undeviated */
    const O = { x: Ox, y: y0 };
    const d2 = norm({ x: O.x - B.x, y: O.y - B.y });
    rays += L(B, O, "beam");
    rays += L(O, edge(O, d2, CLIP), "beam", `marker-end="url(#ln-beam)"`);

    /* 3 · through F → emerges parallel */
    if (Math.abs(xA - xF) > 1.5) {
      const y3 = B.y + (Ox - B.x) * (y0 - B.y) / (xF - B.x);
      const P3 = { x: Ox, y: y3 };
      if (Math.abs(y3 - y0) < 900) {
        rays += L(B, P3, "beam-dim");
        rays += L(P3, edge(P3, { x: 1, y: 0 }, CLIP), "beam-dim", `marker-end="url(#ln-beam)"`);
      }
    }
    g += `<g clip-path="url(#ln-clip)">${rays}</g>`;

    /* ---- image ---- */
    if (atInf) {
      g += T(640, y0 - 128, "les rayons sortent parallèles", "tag-b", "middle");
      g += T(640, y0 - 110, "image à l'infini", "tag-b", "middle");
    } else {
      const xAp = X(OAp);
      let hp = gam * HOBJ, clamped = false;
      if (Math.abs(hp) > 168) { hp = Math.sign(hp) * 168; clamped = true; }
      const real = OAp > 0;
      const onScreen = xAp > 8 && xAp < 792;
      if (onScreen) {
        g += L({ x: xAp, y: y0 }, { x: xAp, y: y0 - hp }, real ? "img" : "img-v",
          `marker-end="url(#ln-img)"`);
        g += DOT(xAp, y0, "dot-img", 4);
        g += T(xAp + 10, y0 - 7, "A′", "pt-img", "start");
        g += T(xAp + (real ? 14 : -14), y0 - hp + (hp > 0 ? -6 : 16), "B′", "pt-img", real ? "start" : "end");
        /* dashed back-extensions that build a virtual image */
        if (!real) {
          const vg = [];
          vg.push(L({ x: Ox, y: B.y }, { x: xAp, y: y0 - hp }, "beam-v"));
          vg.push(L({ x: Ox, y: y0 }, { x: xAp, y: y0 - hp }, "beam-v"));
          g += `<g clip-path="url(#ln-clip)">${vg.join("")}</g>`;
        }
        if (clamped) g += T(xAp, y0 - hp - (hp > 0 ? 24 : -34), "(hauteur tronquée)", "tag");
      } else {
        g += T(784, 34, `image hors cadre : ${sgn(OAp)} cm`, "tag-i", "end");
      }
    }
    svg.innerHTML = g;

    /* ---- readouts ---- */
    document.getElementById("v-oa").textContent = sgn(OA) + " cm";
    document.getElementById("v-fp").textContent = sgn(fp) + " cm";

    let c = `<div class="step">1/OA′ − 1/OA = 1/f′</div>`;
    c += `<div class="step">1/OA′ = 1/(${sgn(fp)}) + 1/(${sgn(OA)})</div>`;
    c += `<div class="step">1/OA′ = ${fmt(invOAp, 4)} cm⁻¹</div>`;
    c += atInf
      ? `<div class="step">OA′ → <b>∞</b></div>`
      : `<div class="step">OA′ = <b>${sgn(OAp)} cm</b></div>`;
    if (!atInf) c += `<div class="step">γ = OA′/OA = <b>${sgn(gam, 2)}</b></div>`;
    document.getElementById("ro-lens-calc").innerHTML = c;

    let v = `<dt>Objet <span class="ov">OA</span></dt><dd>${sgn(OA)} cm</dd>`;
    v += `<dt>Image <span class="ov">OA′</span></dt><dd>${atInf ? "∞" : sgn(OAp) + " cm"}</dd>`;
    v += `<dt>Grandissement γ</dt><dd>${atInf ? "—" : sgn(gam, 2)}</dd>`;
    v += `<dt>Vergence C</dt><dd>${sgn(100 / fp, 2)} δ</dd>`;
    document.getElementById("ro-lens-vals").innerHTML = v;

    const vd = document.getElementById("ro-lens-verdict");
    const chips = [];
    if (atInf) {
      vd.className = "verdict"; vd.textContent = "Objet au foyer : aucune image à distance finie.";
      chips.push(`<span class="chip warn">image à l'infini</span>`);
    } else {
      const real = OAp > 0, up = gam > 0, big = Math.abs(gam) > 1.001, same = Math.abs(Math.abs(gam) - 1) < 0.001;
      vd.className = "verdict";
      vd.textContent = `Image ${real ? "réelle" : "virtuelle"}, ${up ? "droite" : "renversée"}, ` +
        (same ? "de même taille" : big ? "agrandie" : "réduite") + ".";
      chips.push(`<span class="chip ${real ? "real" : "virt"}">${real ? "réelle — projetable" : "virtuelle — non projetable"}</span>`);
      chips.push(`<span class="chip neutral">${up ? "droite" : "renversée"}</span>`);
      chips.push(`<span class="chip neutral">|γ| = ${Math.abs(gam).toFixed(2).replace(".", ",")}</span>`);
      if (!real && st.conv) chips.push(`<span class="chip neutral">principe de la loupe</span>`);
      if (!st.conv) chips.push(`<span class="chip neutral">divergente : jamais d'image réelle</span>`);
    }
    document.getElementById("ro-lens-chips").innerHTML = chips.join("");
  }
  render();
})();

/* ══════════════════ 3. MIROIR SPHÉRIQUE ══════════════════ */
(function () {
  const svg = document.getElementById("sv-mirror");
  if (!svg) return;   /* banc absent de cette page */
  const st = { SA: -60, R: 40, concave: true };
  const Sx = 560, y0 = 195, HOBJ = 52, CLIP = { x1: 4, y1: 4, x2: 796, y2: 396 };
  const ROOM_L = Sx - 46, ROOM_R = 800 - Sx - 44;
  let scale = 4;

  const cSA = document.getElementById("c-sa"), cR = document.getElementById("c-R");
  cSA.addEventListener("input", e => { st.SA = +e.target.value; render(); });
  cR.addEventListener("input", e => { st.R = +e.target.value; render(); });
  document.getElementById("c-mirtype").addEventListener("change", e => {
    st.concave = e.target.value === "concave"; render();
  });
  document.getElementById("p-mir").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (!st.concave) { st.concave = true; document.querySelector('input[name=mirtype][value=concave]').checked = true; }
    const R = st.R, f = R / 2;
    st.SA = { beyondC: -1.7 * R, atC: -R, CF: -0.75 * R, atF: -f, FS: -0.55 * f }[b.dataset.p];
    st.SA = Math.max(-200, Math.min(-1, Math.round(st.SA * 2) / 2));
    cSA.value = st.SA; render();
  });
  svg.addEventListener("pointerdown", e => {
    if (Math.abs(toCm(e) - st.SA) > 22 / scale) return;
    svg.setPointerCapture(e.pointerId); svg.dataset.drag = "1"; e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (svg.dataset.drag !== "1") return;
    st.SA = Math.max(-200, Math.min(-1, Math.round(toCm(e) * 2) / 2));
    cSA.value = st.SA; render();
  });
  const stop = () => { svg.dataset.drag = "0"; };
  svg.addEventListener("pointerup", stop); svg.addEventListener("pointercancel", stop);
  function toCm(e) {
    const r = svg.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width * 800 - Sx) / scale;
  }

  function render() {
    const R = st.concave ? -st.R : st.R;
    const f = R / 2, SA = st.SA;
    const invSAp = 1 / f - 1 / SA;
    const atInf = Math.abs(invSAp) < 1e-6;
    const SAp = atInf ? Infinity : 1 / invSAp;
    const gam = atInf ? Infinity : -SAp / SA;

    /* deux extensions distinctes : devant le miroir (gauche) et derrière (droite) */
    let extL = Math.abs(SA);
    if (R < 0) extL = Math.max(extL, Math.abs(R));
    if (isFinite(SAp) && SAp < 0 && Math.abs(SAp) <= 140) extL = Math.max(extL, Math.abs(SAp));
    let extR = 2;
    if (R > 0) extR = Math.max(extR, R);
    if (isFinite(SAp) && SAp > 0 && SAp <= 140) extR = Math.max(extR, SAp);
    scale = Math.max(0.4, Math.min(26, Math.min(ROOM_L / (extL * 1.14), ROOM_R / (extR * 1.12))));
    const X = cm => Sx + cm * scale;

    const xC = X(R), xF = X(f), xA = X(SA);
    const B = { x: xA, y: y0 - HOBJ };

    let g = defs("mr");
    g += L({ x: 8, y: y0 }, { x: 780, y: y0 }, "hair");

    /* mirror surface as a quadratic whose vertex sits exactly on S */
    const half = 132;
    const Rpx = Math.abs(R) * scale;
    let dx = Rpx > half ? Rpx - Math.sqrt(Rpx * Rpx - half * half) : Rpx;
    dx = Math.min(dx, 76);
    const xEdge = st.concave ? Sx - dx : Sx + dx;
    const ctrl = 2 * Sx - xEdge;
    const path = `M${xEdge} ${y0 - half} Q${ctrl} ${y0} ${xEdge} ${y0 + half}`;
    /* face argentée : toujours du côté opposé à la lumière, donc à droite */
    const off = 7;
    g += `<path d="M${xEdge + off} ${y0 - half} Q${ctrl + off} ${y0} ${xEdge + off} ${y0 + half}"
            fill="none" stroke="var(--glass)" stroke-width="7" opacity=".22"/>`;
    g += `<path d="${path}" fill="none" stroke="var(--glass)" stroke-width="2.4"/>`;
    g += L({ x: Sx, y: y0 - half - 16 }, { x: Sx, y: y0 + half + 16 }, "hair-d");

    const key = (x, label, sub) => DOT(x, y0, "dot-key", 3.5) + T(x, y0 + 22, label, "pt") +
      (sub ? T(x, y0 + 38, sub, "tag") : "");
    g += key(Sx, "S", "");
    g += key(xF, "F", `${sgn(f)} cm`);
    g += key(xC, "C", `${sgn(R)} cm`);

    /* objet */
    g += L({ x: xA, y: y0 }, B, "obj", `marker-end="url(#mr-obj)"`);
    g += DOT(xA, y0, "dot-obj", 4);
    g += T(xA - 10, y0 - 7, "A", "pt-obj", "end");
    g += T(B.x, B.y - 12, "B", "pt-obj");
    g += `<circle cx="${xA}" cy="${y0 - HOBJ / 2}" r="17" fill="transparent" style="cursor:grab"/>`;

    /* rays — paraxial: reflect at the plane x = Sx */
    let rays = "";
    /* 1 · parallel → through F */
    const P1 = { x: Sx, y: B.y };
    rays += L(B, P1, "beam");
    const dF = { x: xF - P1.x, y: y0 - P1.y };
    const d1 = norm(dF.x < 0 ? dF : { x: -dF.x, y: -dF.y });
    rays += L(P1, edge(P1, d1, CLIP), "beam", `marker-end="url(#mr-beam)"`);
    if (!st.concave) rays += L(P1, edge(P1, { x: -d1.x, y: -d1.y }, CLIP), "beam-v");

    /* 2 · through F → reflected parallel */
    if (Math.abs(xA - xF) > 1.5) {
      const y2 = B.y + (Sx - B.x) * (y0 - B.y) / (xF - B.x);
      if (Math.abs(y2 - y0) < 900) {
        const P2 = { x: Sx, y: y2 };
        rays += L(B, P2, "beam-dim");
        rays += L(P2, edge(P2, { x: -1, y: 0 }, CLIP), "beam-dim", `marker-end="url(#mr-beam)"`);
      }
    }
    /* 3 · through C → back on itself */
    if (Math.abs(xA - xC) > 1.5) {
      const y3 = B.y + (Sx - B.x) * (y0 - B.y) / (xC - B.x);
      if (Math.abs(y3 - y0) < 900) {
        const P3 = { x: Sx, y: y3 };
        rays += L(B, P3, "beam", `marker-start="url(#mr-beam)" marker-end="url(#mr-beam)"`);
        rays += L({ x: xC, y: y0 }, P3, "hair-d");
      }
    }
    g += `<g clip-path="url(#mr-clip)">${rays}</g>`;

    /* image */
    if (atInf) {
      g += T(300, y0 - 150, "rayons réfléchis parallèles → image à l'infini", "tag-b");
      g += T(300, y0 - 132, "c'est le projecteur / le phare de voiture", "tag");
    } else {
      const xAp = X(SAp);
      let hp = gam * HOBJ, clamped = false;
      if (Math.abs(hp) > 168) { hp = Math.sign(hp) * 168; clamped = true; }
      const real = SAp < 0;                     /* in front of the mirror = real */
      if (xAp > 8 && xAp < 792) {
        g += L({ x: xAp, y: y0 }, { x: xAp, y: y0 - hp }, real ? "img" : "img-v",
          `marker-end="url(#mr-img)"`);
        g += DOT(xAp, y0, "dot-img", 4);
        g += T(xAp + 10, y0 - 7, "A′", "pt-img", "start");
        const bo = Math.abs(hp) < 26 ? 16 : 6;   /* petite image : on écarte l'étiquette */
        g += T(xAp + 14, y0 - hp + (hp > 0 ? -bo : bo + 10), "B′", "pt-img", "start");
        if (!real) {
          const vg = [L({ x: Sx, y: B.y }, { x: xAp, y: y0 - hp }, "beam-v")];
          vg.push(L({ x: Sx, y: y0 }, { x: xAp, y: y0 - hp }, "beam-v"));
          g += `<g clip-path="url(#mr-clip)">${vg.join("")}</g>`;
        }
        if (clamped) g += T(xAp, y0 - hp - (hp > 0 ? 24 : -34), "(hauteur tronquée)", "tag");
      } else {
        g += T(784, 34, `image hors cadre : ${sgn(SAp)} cm`, "tag-i", "end");
      }
    }
    svg.innerHTML = g;

    /* readouts */
    document.getElementById("v-sa").textContent = sgn(SA) + " cm";
    document.getElementById("v-R").textContent = fmt(st.R) + " cm";

    let c = `<div class="step">1/SA′ + 1/SA = 1/f&nbsp;&nbsp;avec f = R/2</div>`;
    c += `<div class="step">f = ${sgn(R)}/2 = <b>${sgn(f)} cm</b></div>`;
    c += `<div class="step">1/SA′ = 1/(${sgn(f)}) − 1/(${sgn(SA)})</div>`;
    c += atInf
      ? `<div class="step">1/SA′ = 0 → SA′ → <b>∞</b></div>`
      : `<div class="step">SA′ = <b>${sgn(SAp)} cm</b></div>`;
    if (!atInf) c += `<div class="step">γ = −SA′/SA = <b>${sgn(gam, 2)}</b></div>`;
    document.getElementById("ro-mir-calc").innerHTML = c;

    let v = `<dt>Rayon <span class="ov">SC</span> = R</dt><dd>${sgn(R)} cm</dd>`;
    v += `<dt>Focale f = R/2</dt><dd>${sgn(f)} cm</dd>`;
    v += `<dt>Objet <span class="ov">SA</span></dt><dd>${sgn(SA)} cm</dd>`;
    v += `<dt>Image <span class="ov">SA′</span></dt><dd>${atInf ? "∞" : sgn(SAp) + " cm"}</dd>`;
    v += `<dt>Grandissement γ</dt><dd>${atInf ? "—" : sgn(gam, 2)}</dd>`;
    document.getElementById("ro-mir-vals").innerHTML = v;

    const vd = document.getElementById("ro-mir-verdict");
    const chips = [`<span class="chip neutral">${st.concave ? "concave — convergent" : "convexe — divergent"}</span>`];
    if (atInf) {
      vd.className = "verdict"; vd.textContent = "Objet au foyer : les rayons ressortent parallèles.";
      chips.push(`<span class="chip warn">image à l'infini</span>`);
    } else {
      const real = SAp < 0, up = gam > 0, same = Math.abs(Math.abs(gam) - 1) < 0.001;
      vd.className = "verdict";
      vd.textContent = `Image ${real ? "réelle" : "virtuelle"}, ${up ? "droite" : "renversée"}, ` +
        (same ? "de même taille" : Math.abs(gam) > 1 ? "agrandie" : "réduite") + ".";
      chips.push(`<span class="chip ${real ? "real" : "virt"}">${real ? "réelle — devant le miroir" : "virtuelle — derrière le miroir"}</span>`);
      chips.push(`<span class="chip neutral">${up ? "droite" : "renversée"}</span>`);
      chips.push(`<span class="chip neutral">|γ| = ${Math.abs(gam).toFixed(2).replace(".", ",")}</span>`);
    }
    document.getElementById("ro-mir-chips").innerHTML = chips.join("");
  }
  render();
})();

/* ══════════════════ 4. L'ŒIL ══════════════════ */
(function () {
  const svg = document.getElementById("sv-eye");
  if (!svg) return;   /* banc absent de cette page */
  const st = { defect: "emme", dslider: 72, sev: 0, corr: false };

  const L_M = 0.017;            /* longueur axiale de l'œil, en mètres */
  const AMP_NORM = 4;           /* amplitude d'accommodation, en dioptries */
  const AMP_PRESB = 2;

  const Lx = 470, Rx = 646, y0 = 200;   /* plan du cristallin / rétine */
  const PUP = 30;                        /* demi-ouverture de la pupille, px */
  const PXMM = (Rx - Lx) / (L_M * 1000); /* px par mm à l'intérieur de l'œil */
  const K = 8;                           /* amplification des écarts */

  const sliderToM = v => (v > 100 ? Infinity : 0.10 * Math.pow(1.0475, v));

  document.getElementById("c-defect").addEventListener("change", e => {
    st.defect = e.target.value;
    st.sev = st.defect === "myope" ? 2 : st.defect === "hyper" ? 2 : 0;
    document.getElementById("c-sev").value = st.sev;
    render();
  });
  document.getElementById("c-dobj").addEventListener("input", e => { st.dslider = +e.target.value; render(); });
  document.getElementById("c-sev").addEventListener("input", e => { st.sev = +e.target.value; render(); });
  document.getElementById("c-corr").addEventListener("change", e => { st.corr = e.target.checked; render(); });

  function render() {
    /* D > 0 : œil trop convergent (myope) — D < 0 : pas assez (hypermétrope) */
    const D = st.defect === "myope" ? st.sev : st.defect === "hyper" ? -st.sev : 0;
    const AMP = st.defect === "presb" ? AMP_PRESB : AMP_NORM;
    const V0 = 1 / L_M + D;                 /* vergence au repos */
    const dObj = sliderToM(st.dslider);

    /* verre correcteur : annule le défaut, ou rend l'accommodation manquante */
    const Vc = st.corr ? (Math.abs(D) > 1e-6 ? -D : Math.max(0, AMP_NORM - AMP)) : 0;
    const Vmin = V0 + Vc, Vmax = V0 + Vc + AMP;

    /* vergence nécessaire pour poser l'image sur la rétine */
    const Vneed = 1 / L_M + (isFinite(dObj) ? 1 / dObj : 0);
    const V = Math.min(Vmax, Math.max(Vmin, Vneed));
    const acc = V - Vmin;                    /* accommodation utilisée */
    const sharp = Math.abs(V - Vneed) < 1e-4;

    /* distance image réelle, en mm */
    const objVerg = isFinite(dObj) ? 1 / dObj : 0;
    const imgM = 1 / (V - objVerg);
    const imgMM = imgM * 1000;
    const devMM = imgMM - L_M * 1000;        /* + : derrière la rétine */

    /* punctum remotum / proximum */
    const dPR = Vmin - 1 / L_M > 1e-6 ? 1 / (Vmin - 1 / L_M) : Infinity;
    const behindPR = Vmin - 1 / L_M < -1e-6;
    const dPP = 1 / (Vmax - 1 / L_M);

    /* ---------- dessin ---------- */
    let g = defs("ey");
    const cx = Lx + 88, cy = y0, Rg = 92;

    /* globe + rétine + cristallin */
    g += `<circle cx="${cx}" cy="${cy}" r="${Rg}" fill="var(--surface-2)" stroke="var(--ink-3)" stroke-width="1.6" opacity=".95"/>`;
    g += `<path d="M ${cx + Rg * Math.cos(-1.15)} ${cy + Rg * Math.sin(-1.15)}
                  A ${Rg} ${Rg} 0 0 1 ${cx + Rg * Math.cos(1.15)} ${cy + Rg * Math.sin(1.15)}"
            fill="none" stroke="var(--warn)" stroke-width="4.5" opacity=".9"/>`;
    g += T(cx + Rg + 14, cy - 62, "rétine", "tag-w", "start");
    /* cornée */
    g += `<path d="M ${Lx - 6} ${cy - 66} A 78 78 0 0 0 ${Lx - 6} ${cy + 66}"
            fill="none" stroke="var(--glass)" stroke-width="3" opacity=".55"/>`;
    /* cristallin : se bombe avec l'accommodation */
    const bulge = 13 + 15 * (AMP > 0 ? acc / AMP : 0);
    g += `<path d="M${Lx} ${cy - 52} C ${Lx + bulge} ${cy - 20} ${Lx + bulge} ${cy + 20} ${Lx} ${cy + 52}
                   C ${Lx - bulge} ${cy + 20} ${Lx - bulge} ${cy - 20} ${Lx} ${cy - 52} z" class="glass"/>`;
    g += T(Lx - 4, cy + 116, "cristallin", "tag", "middle");
    g += T(Lx - 4, cy + 132, acc > 0.4 ? "bombé — accommode" : "aplati — au repos", "tag", "middle");
    /* axe optique */
    g += L({ x: 20, y: y0 }, { x: cx + Rg + 6, y: y0 }, "hair");

    /* verre correcteur */
    const Gx = Lx - 150;
    if (st.corr && Math.abs(Vc) > 1e-6) {
      const conv = Vc > 0, h = 62;
      g += conv
        ? `<path d="M${Gx} ${cy - h} C ${Gx + 13} ${cy - 22} ${Gx + 13} ${cy + 22} ${Gx} ${cy + h}
                    C ${Gx - 13} ${cy + 22} ${Gx - 13} ${cy - 22} ${Gx} ${cy - h} z"
             stroke="var(--img)" stroke-width="2" fill="color-mix(in srgb,var(--img) 14%,transparent)"/>`
        : `<path d="M${Gx - 11} ${cy - h} C ${Gx + 8} ${cy - 22} ${Gx + 8} ${cy + 22} ${Gx - 11} ${cy + h}
                    L ${Gx + 11} ${cy + h} C ${Gx - 8} ${cy + 22} ${Gx - 8} ${cy - 22} ${Gx + 11} ${cy - h} z"
             stroke="var(--img)" stroke-width="2" fill="color-mix(in srgb,var(--img) 14%,transparent)"/>`;
      g += T(Gx, cy + h + 20, "verre", "tag-i", "middle");
      g += T(Gx, cy + h + 36, `${sgn(Vc, 2)} δ · ${Vc > 0 ? "convergent" : "divergent"}`, "tag-i", "middle");
    }

    /* objet */
    const Ax = 60;
    if (isFinite(dObj)) {
      g += L({ x: Ax, y: y0 }, { x: Ax, y: y0 - 46 }, "obj", `marker-end="url(#ey-obj)"`);
      g += DOT(Ax, y0, "dot-obj", 4);
      g += T(Ax, y0 + 24, `objet à ${dObj < 1 ? fmt(dObj * 100, 0) + " cm" : fmt(dObj, 2) + " m"}`, "tag-o", "middle");
    } else {
      g += T(Ax + 6, y0 - 54, "objet à l'infini", "tag-o", "start");
      g += T(Ax + 6, y0 - 38, "rayons parallèles", "tag", "start");
    }

    /* point image, position exagérée */
    let Ix = Rx + K * devMM * PXMM;
    Ix = Math.max(Lx + 26, Math.min(cx + Rg + 118, Ix));

    /* faisceau : objet → (verre) → pupille → point image → rétine */
    const rays = [];
    const worn = st.corr && Math.abs(Vc) > 1e-6;
    /* le verre casse la trajectoire : convergent → le rayon rentre vers l'axe,
       divergent → il s'en écarte avant d'atteindre la pupille */
    const kink = Vc > 0 ? 1.24 : 0.78;
    [-PUP, 0, PUP].forEach(dy => {
      const P = { x: Lx, y: y0 + dy };
      const start = isFinite(dObj) ? { x: Ax, y: y0 } : { x: 20, y: y0 + dy * (worn ? kink : 1) };
      if (worn) {
        const Gp = { x: Gx, y: y0 + dy * kink };
        rays.push(L(start, Gp, "beam"));
        rays.push(L(Gp, P, "beam"));
      } else {
        rays.push(L(start, P, "beam"));
      }
      /* dans l'œil : vers le point image, puis prolongement jusqu'à la rétine */
      const dir = norm({ x: Ix - P.x, y: y0 - P.y });
      const tRet = (Rx - P.x) / dir.x;
      const tImg = (Ix - P.x) / dir.x;
      const tEnd = Math.min(tRet, tImg) > 0 ? Math.min(tRet, tImg) : tRet;
      const E = { x: P.x + dir.x * tEnd, y: P.y + dir.y * tEnd };
      rays.push(L(P, E, "beam"));
      if (tImg < tRet) {
        const E2 = { x: P.x + dir.x * tRet, y: P.y + dir.y * tRet };
        rays.push(L(E, E2, "beam"));
      }
    });
    g += `<g clip-path="url(#ey-clip)">${rays.join("")}</g>`;

    /* tache image sur la rétine */
    const blur = PUP * Math.abs(Rx - Ix) / Math.max(1, Ix - Lx);
    /* verdict en haut à droite, étiquette courte près de la rétine */
    if (sharp) {
      g += DOT(Rx, y0, "dot-beam", 5);
      g += T(788, 40, "image nette, pile sur la rétine", "tag-b", "end");
      g += T(Rx + 14, y0 - 12, "image nette", "tag-b", "start");
    } else {
      const bh = Math.max(5, blur);      /* toujours visible, même pour un écart minime */
      g += `<rect x="${Rx - 4}" y="${(y0 - bh).toFixed(1)}" width="8" height="${(2 * bh).toFixed(1)}"
              rx="4" class="warnfill" stroke="var(--sunk)" stroke-width="1.5"/>`;
      g += DOT(Ix, y0, "dot-beam", 4.5);
      g += L({ x: Ix, y: y0 - 10 }, { x: Ix, y: y0 - 30 }, "hair-d");
      g += T(788, 40, `image ${devMM < 0 ? "en avant" : "en arrière"} de la rétine`, "tag-w", "end");
      g += T(788, 58, `${sgn(devMM, 2)} mm`, "tag-w", "end");
      g += T(Rx + 14, y0 - 12, "tache floue", "tag-w", "start");
    }

    /* règle PP / PR */
    const ry = 372;
    g += L({ x: 40, y: ry }, { x: 700, y: ry }, "hair");
    g += T(40, ry - 26, "zone de vision nette", "tag", "start");
    /* PP et PR sous la règle, l'objet au-dessus : aucune superposition possible */
    const mark = (frac, label, cls) => {
      const x = 40 + frac * 660;
      return L({ x, y: ry - 6 }, { x, y: ry + 6 }, cls === "w" ? "img-v" : "obj") +
        T(x, cls === "w" ? ry + 22 : ry - 11, label, cls === "w" ? "tag-i" : "tag-o", "middle");
    };
    const posOf = d => !isFinite(d) ? 1 : Math.max(0, Math.min(1,
      Math.log(Math.max(0.05, d) / 0.05) / Math.log(30 / 0.05)));
    g += mark(posOf(dPP), `PP ${dPP > 0 ? (dPP < 1 ? fmt(dPP * 100, 0) + " cm" : fmt(dPP, 2) + " m") : "—"}`, "w");
    g += mark(posOf(dPR), behindPR ? "PR virtuel" : (isFinite(dPR) ? `PR ${dPR < 1 ? fmt(dPR * 100, 0) + " cm" : fmt(dPR, 2) + " m"}` : "PR ∞"), "w");
    if (isFinite(dObj)) g += mark(posOf(dObj), "objet", "o");
    else g += mark(1, "objet ∞", "o");

    svg.innerHTML = g;

    /* ---------- panneau ---------- */
    document.getElementById("v-dobj").textContent =
      isFinite(dObj) ? (dObj < 1 ? fmt(dObj * 100, 0) + " cm" : fmt(dObj, 2) + " m") : "∞";
    document.getElementById("v-sev").textContent = fmt(st.sev, 2) + " δ";
    document.getElementById("lab-sev").textContent =
      st.defect === "presb" ? "Sévérité (sans effet : presbytie)" :
      st.defect === "emme" ? "Sévérité (sans effet : œil normal)" : "Sévérité du défaut";
    document.getElementById("c-sev").disabled = (st.defect === "emme" || st.defect === "presb");

    const vd = document.getElementById("ro-eye-verdict");
    vd.className = "verdict " + (sharp ? "good" : "bad");
    vd.textContent = sharp
      ? "Image nette sur la rétine."
      : `Image floue — elle se forme ${devMM < 0 ? "en avant" : "en arrière"} de la rétine (${sgn(devMM, 2)} mm).`;

    let v = `<dt>Vergence au repos</dt><dd>${fmt(Vmin, 1)} δ</dd>`;
    v += `<dt>Accommodation utilisée</dt><dd>${fmt(acc, 2)} / ${fmt(AMP, 1)} δ</dd>`;
    v += `<dt>Vergence nécessaire</dt><dd>${fmt(Vneed, 1)} δ</dd>`;
    v += `<dt>Punctum remotum</dt><dd>${behindPR ? "virtuel" : (isFinite(dPR) ? (dPR < 1 ? fmt(dPR * 100, 0) + " cm" : fmt(dPR, 2) + " m") : "∞")}</dd>`;
    v += `<dt>Punctum proximum</dt><dd>${dPP > 0 ? (dPP < 1 ? fmt(dPP * 100, 0) + " cm" : fmt(dPP, 2) + " m") : "—"}</dd>`;
    document.getElementById("ro-eye-vals").innerHTML = v;

    const chips = [];
    const NAME = { emme: "emmétrope", myope: "myope", hyper: "hypermétrope", presb: "presbyte" };
    chips.push(`<span class="chip neutral">${NAME[st.defect]}</span>`);
    if (st.corr && Math.abs(Vc) > 1e-6) chips.push(`<span class="chip real">verre ${sgn(Vc, 2)} δ porté</span>`);
    if (!sharp) {
      if (acc >= AMP - 1e-4 && devMM > 0) chips.push(`<span class="chip warn">objet plus près que le PP</span>`);
      else if (devMM < 0) chips.push(`<span class="chip warn">objet au-delà du PR — flou de loin</span>`);
    } else if (acc > AMP * 0.75) chips.push(`<span class="chip neutral">net, mais accommodation forcée</span>`);
    else chips.push(`<span class="chip ok">confortable</span>`);
    document.getElementById("ro-eye-chips").innerHTML = chips.join("");

    const calc = document.getElementById("ro-eye-calc");
    let c = "";
    if (st.defect === "myope") {
      c += `<div class="step">PR fini à ${isFinite(dPR0()) ? fmt(dPR0(), 2) + " m" : "∞"} → myopie</div>`;
      c += `<div class="step">C = −1/d<sub>PR</sub> = −1/${fmt(dPR0(), 2)}</div>`;
      c += `<div class="step">C = <b>${sgn(-D, 2)} δ</b> → verre <b>divergent</b></div>`;
    } else if (st.defect === "hyper") {
      c += `<div class="step">PR virtuel → hypermétropie</div>`;
      c += `<div class="step">il manque ${fmt(Math.abs(D), 2)} δ</div>`;
      c += `<div class="step">C = <b>${sgn(-D, 2)} δ</b> → verre <b>convergent</b></div>`;
    } else if (st.defect === "presb") {
      c += `<div class="step">amplitude tombée à ${fmt(AMP_PRESB, 1)} δ</div>`;
      c += `<div class="step">PP à ${fmt(1 / (V0 + AMP_PRESB - 1 / L_M) * 100, 0)} cm au lieu de 25 cm</div>`;
      c += `<div class="step">C = <b>${sgn(AMP_NORM - AMP_PRESB, 2)} δ</b> → lunettes de <b>lecture</b></div>`;
    } else {
      c += `<div class="step">PR à l'infini, PP à 25 cm</div>`;
      c += `<div class="step"><b>aucune correction nécessaire</b></div>`;
    }
    calc.innerHTML = c;

    function dPR0() { const q = V0 - 1 / L_M; return q > 1e-6 ? 1 / q : Infinity; }
  }
  render();
})();


/* ══════════════════ 5. MIROIR PLAN ══════════════════ */
(function () {
  const svg = document.getElementById("sv-flat");
  if (!svg) return;   /* banc absent de cette page */
  const st = { d: 60, h: 30, eye: -40 };
  const Mx = 430, y0 = 200, CLIP = { x1: 4, y1: 4, x2: 796, y2: 396 };
  let scale = 4;

  const cD = document.getElementById("c-fd"), cH = document.getElementById("c-fh"),
        cE = document.getElementById("c-fe");
  cD.addEventListener("input", e => { st.d = +e.target.value; render(); });
  cH.addEventListener("input", e => { st.h = +e.target.value; render(); });
  cE.addEventListener("input", e => { st.eye = +e.target.value; render(); });

  svg.addEventListener("pointerdown", e => {
    if (Math.abs(toCm(e) - st.d) > 26 / scale) return;
    svg.setPointerCapture(e.pointerId); svg.dataset.drag = "1"; e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (svg.dataset.drag !== "1") return;
    st.d = Math.max(10, Math.min(140, Math.round(toCm(e))));
    cD.value = st.d; render();
  });
  const stop = () => { svg.dataset.drag = "0"; };
  svg.addEventListener("pointerup", stop); svg.addEventListener("pointercancel", stop);
  function toCm(e) {
    const r = svg.getBoundingClientRect();
    return (Mx - (e.clientX - r.left) / r.width * 800) / scale;
  }

  function render() {
    const d = st.d;
    scale = Math.max(1.6, Math.min(7, 320 / d));
    const xA = Mx - d * scale, xAp = Mx + d * scale;
    const hpx = Math.min(150, st.h * scale);
    const B = { x: xA, y: y0 - hpx }, Bp = { x: xAp, y: y0 - hpx };
    const eye = { x: Math.max(62, xA - 64), y: y0 + st.eye * 1.35 };

    let g = defs("fl");
    /* miroir */
    g += L({ x: Mx, y: 26 }, { x: Mx, y: 374 }, "", `stroke="var(--glass)" stroke-width="3"`);
    for (let y = 32; y < 374; y += 20)
      g += L({ x: Mx, y }, { x: Mx + 10, y: y - 8 }, "", `stroke="var(--glass)" stroke-width="1.1" opacity=".45"`);
    g += T(Mx + 22, 24, "miroir", "tag", "start");
    g += L({ x: 20, y: y0 }, { x: 780, y: y0 }, "hair");

    /* objet et image */
    g += L({ x: xA, y: y0 }, B, "obj", `marker-end="url(#fl-obj)"`);
    g += DOT(xA, y0, "dot-obj", 4);
    g += T(xA - 11, y0 - 7, "A", "pt-obj", "end");
    g += T(B.x - 4, B.y - 12, "B", "pt-obj", "end");
    g += `<circle cx="${xA}" cy="${y0 - hpx / 2}" r="18" fill="transparent" style="cursor:grab"/>`;
    g += L({ x: xAp, y: y0 }, Bp, "img-v", `marker-end="url(#fl-img)"`);
    g += DOT(xAp, y0, "dot-img", 4);
    g += T(xAp + 11, y0 - 7, "A′", "pt-img", "start");
    g += T(Bp.x + 6, Bp.y - 12, "B′", "pt-img", "start");

    /* deux rayons de B vers l'œil, via leurs prolongements issus de B′ */
    const rays = [];
    [-13, 13].forEach(dy => {
      const Tg = { x: eye.x, y: eye.y + dy };
      const t = (Mx - Bp.x) / (Tg.x - Bp.x);
      const P = { x: Mx, y: Bp.y + (Tg.y - Bp.y) * t };
      rays.push(L(B, P, "beam"));
      rays.push(L(P, Tg, "beam", `marker-end="url(#fl-beam)"`));
      rays.push(L(P, Bp, "beam-v"));
    });
    g += `<g clip-path="url(#fl-clip)">${rays.join("")}</g>`;

    /* œil */
    g += `<circle cx="${eye.x}" cy="${eye.y}" r="16" fill="var(--surface)" stroke="var(--ink-3)" stroke-width="1.5"/>`;
    g += DOT(eye.x, eye.y, "dot-key", 5);
    g += T(eye.x, eye.y + 34, "œil", "tag", "middle");

    /* cotes égales de part et d'autre du miroir */
    const yc = 350;
    [[xA, Mx, "obj"], [Mx, xAp, "img"]].forEach(([x1, x2, cls]) => {
      g += L({ x: x1, y: yc }, { x: x2, y: yc }, cls === "obj" ? "obj" : "img-v",
        `stroke-width="1.2" stroke-dasharray="5 4"`);
      g += L({ x: x1, y: yc - 7 }, { x: x1, y: yc + 7 }, "hair");
      g += L({ x: x2, y: yc - 7 }, { x: x2, y: yc + 7 }, "hair");
      g += T((x1 + x2) / 2, yc - 10, `${d} cm`, cls === "obj" ? "tag-o" : "tag-i", "middle");
    });
    svg.innerHTML = g;

    document.getElementById("v-fd").textContent = d + " cm";
    document.getElementById("v-fh").textContent = st.h + " cm";
    document.getElementById("v-fe").textContent = sgn(st.eye, 0) + " cm";

    document.getElementById("ro-flat-calc").innerHTML =
      `<div class="step">image symétrique de l'objet</div>` +
      `<div class="step">distance derrière = <b>${d} cm</b></div>` +
      `<div class="step">γ = A′B′/AB = <b>+1,00</b></div>`;
    document.getElementById("ro-flat-vals").innerHTML =
      `<dt>Objet ↔ miroir</dt><dd>${d} cm</dd>` +
      `<dt>Miroir ↔ image</dt><dd>${d} cm</dd>` +
      `<dt>Taille objet</dt><dd>${st.h} cm</dd>` +
      `<dt>Taille image</dt><dd>${st.h} cm</dd>` +
      `<dt>Grandissement γ</dt><dd>+1,00</dd>`;
    const vd = document.getElementById("ro-flat-verdict");
    vd.className = "verdict";
    vd.textContent = "Image virtuelle, droite, de même taille.";
    document.getElementById("ro-flat-chips").innerHTML =
      `<span class="chip virt">virtuelle — non projetable</span>` +
      `<span class="chip neutral">droite</span>` +
      `<span class="chip neutral">|γ| = 1</span>`;
  }
  render();
})();

/* ══════════════════ 6. LA LOUPE ══════════════════ */
(function () {
  const svg = document.getElementById("sv-loupe");
  if (!svg) return;   /* banc absent de cette page */
  const st = { fp: 5, v: -50 };            /* v : OA en % de f′ */
  const Ox = 360, y0 = 196, HOBJ = 46, CLIP = { x1: 4, y1: 4, x2: 796, y2: 396 };
  let scale = 8;

  const cF = document.getElementById("c-lpf"), cA = document.getElementById("c-lpa");
  cF.addEventListener("input", e => { st.fp = +e.target.value; render(); });
  cA.addEventListener("input", e => { st.v = +e.target.value; render(); });
  document.getElementById("p-lp").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.p === "foyer") st.v = -100;
    else if (b.dataset.p === "avant") st.v = -78;
    else {                                   /* image virtuelle ramenée à 25 cm */
      const f = st.fp, OA = -25 * f / (25 + f);
      st.v = Math.max(-150, Math.min(-5, Math.round(OA / f * 100)));
    }
    cA.value = st.v; render();
  });
  svg.addEventListener("pointerdown", e => {
    const cm = toCm(e), OA = st.v * st.fp / 100;
    if (Math.abs(cm - OA) > 24 / scale) return;
    svg.setPointerCapture(e.pointerId); svg.dataset.drag = "1"; e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (svg.dataset.drag !== "1") return;
    st.v = Math.max(-150, Math.min(-5, Math.round(toCm(e) / st.fp * 100)));
    cA.value = st.v; render();
  });
  const stop = () => { svg.dataset.drag = "0"; };
  svg.addEventListener("pointerup", stop); svg.addEventListener("pointercancel", stop);
  function toCm(e) {
    const r = svg.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width * 800 - Ox) / scale;
  }

  function render() {
    const fp = st.fp, OA = st.v * fp / 100;
    const inv = 1 / fp + 1 / OA;
    const atInf = Math.abs(inv) < 1e-4;
    const OAp = atInf ? Infinity : 1 / inv;
    const gam = atInf ? Infinity : OAp / OA;
    const G = 25 / fp;                       /* grossissement commercial */

    let ext = Math.max(Math.abs(OA), fp * 1.5);
    if (isFinite(OAp) && Math.abs(OAp) < 90) ext = Math.max(ext, Math.abs(OAp));
    scale = Math.max(1.2, Math.min(30, 300 / (ext * 1.15)));
    const X = cm => Ox + cm * scale;
    const xA = X(OA), xF = X(-fp), xFp = X(fp);
    const B = { x: xA, y: y0 - HOBJ };

    let g = defs("lp");
    g += L({ x: 14, y: y0 }, { x: 786, y: y0 }, "hair");
    /* lentille épaisse et courte : c'est une loupe */
    const lh = 104;
    g += `<path d="M${Ox} ${y0 - lh} C ${Ox + 30} ${y0 - lh * .4} ${Ox + 30} ${y0 + lh * .4} ${Ox} ${y0 + lh}
                   C ${Ox - 30} ${y0 + lh * .4} ${Ox - 30} ${y0 - lh * .4} ${Ox} ${y0 - lh} z" class="glass"/>`;
    g += L({ x: Ox, y: y0 - lh - 12 }, { x: Ox, y: y0 + lh + 12 }, "hair-d");
    [[Ox, "O", ""], [xF, "F", `${sgn(-fp)} cm`], [xFp, "F′", `${sgn(fp)} cm`]].forEach(([x, lab, sub]) => {
      g += DOT(x, y0, "dot-key", 3.5) + T(x, y0 + 22, lab, "pt");
      if (sub) g += T(x, y0 + 38, sub, "tag");
    });

    g += L({ x: xA, y: y0 }, B, "obj", `marker-end="url(#lp-obj)"`);
    g += DOT(xA, y0, "dot-obj", 4);
    g += T(xA - 10, y0 - 7, "A", "pt-obj", "end");
    g += T(B.x, B.y - 12, "B", "pt-obj");
    g += `<circle cx="${xA}" cy="${y0 - HOBJ / 2}" r="17" fill="transparent" style="cursor:grab"/>`;

    /* rayons : parallèle → F′, et par O */
    const rays = [];
    const P1 = { x: Ox, y: B.y };
    rays.push(L(B, P1, "beam"));
    const d1 = norm({ x: xFp - P1.x, y: y0 - P1.y });
    rays.push(L(P1, edge(P1, d1, CLIP), "beam", `marker-end="url(#lp-beam)"`));
    const O = { x: Ox, y: y0 };
    rays.push(L(B, O, "beam"));
    rays.push(L(O, edge(O, norm({ x: O.x - B.x, y: O.y - B.y }), CLIP), "beam",
      `marker-end="url(#lp-beam)"`));
    g += `<g clip-path="url(#lp-clip)">${rays.join("")}</g>`;

    /* image virtuelle */
    if (!atInf && OAp < 0) {
      const xAp = X(OAp);
      let hp = gam * HOBJ, cut = false;
      if (hp > 168) { hp = 168; cut = true; }
      if (xAp > 8) {
        g += L({ x: xAp, y: y0 }, { x: xAp, y: y0 - hp }, "img-v", `marker-end="url(#lp-img)"`);
        g += DOT(xAp, y0, "dot-img", 4);
        g += T(xAp - 11, y0 - 7, "A′", "pt-img", "end");
        g += T(xAp, y0 - hp - 12, "B′", "pt-img");
        const vg = [L(P1, { x: xAp, y: y0 - hp }, "beam-v"), L(O, { x: xAp, y: y0 - hp }, "beam-v")];
        g += `<g clip-path="url(#lp-clip)">${vg.join("")}</g>`;
        if (cut) g += T(xAp, y0 - hp - 30, "(hauteur tronquée)", "tag");
      } else {
        g += T(20, 34, `image virtuelle hors cadre : ${sgn(OAp)} cm`, "tag-i", "start");
      }
    } else if (atInf) {
      g += T(560, 40, "les rayons sortent parallèles", "tag-b");
      g += T(560, 58, "→ image virtuelle à l'infini", "tag-i");
    }

    /* œil de l'observateur, dans le faisceau émergent */
    const ex = 700, ey = y0 + 74;
    g += `<circle cx="${ex}" cy="${ey}" r="26" fill="var(--surface)" stroke="var(--ink-3)" stroke-width="1.4"/>`;
    g += `<path d="M${ex - 20} ${ey - 14} C ${ex - 8} ${ey - 6} ${ex - 8} ${ey + 6} ${ex - 20} ${ey + 14}"
            fill="none" stroke="var(--glass)" stroke-width="2"/>`;
    g += T(ex, ey + 44, atInf ? "œil au repos" : "l'œil accommode un peu", "tag", "middle");

    svg.innerHTML = g;

    document.getElementById("v-lpf").textContent = fmt(fp, 1) + " cm";
    document.getElementById("v-lpa").textContent = sgn(OA, 1) + " cm";

    let c = `<div class="step">G = d<sub>m</sub>/f′ = 0,25/${fmt(fp / 100, 3)}</div>`;
    c += `<div class="step">G = <b>×${fmt(G, 1)}</b></div>`;
    c += `<div class="step">1/OA′ = 1/(${sgn(fp, 1)}) + 1/(${sgn(OA, 1)})</div>`;
    c += atInf ? `<div class="step">OA′ → <b>∞</b></div>`
               : `<div class="step">OA′ = <b>${sgn(OAp, 1)} cm</b></div>`;
    document.getElementById("ro-lp-calc").innerHTML = c;

    let v = `<dt>Grossissement commercial</dt><dd>×${fmt(G, 1)}</dd>`;
    v += `<dt>Vergence</dt><dd>${sgn(100 / fp, 1)} δ</dd>`;
    v += `<dt>Objet <span class="ov">OA</span></dt><dd>${sgn(OA, 1)} cm</dd>`;
    v += `<dt>Image <span class="ov">OA′</span></dt><dd>${atInf ? "∞" : sgn(OAp, 1) + " cm"}</dd>`;
    v += `<dt>Grandissement γ</dt><dd>${atInf ? "—" : sgn(gam, 2)}</dd>`;
    document.getElementById("ro-lp-vals").innerHTML = v;

    const vd = document.getElementById("ro-lp-verdict"), chips = [];
    if (atInf) {
      vd.className = "verdict good";
      vd.textContent = "Objet au foyer : image à l'infini, œil totalement au repos.";
      chips.push(`<span class="chip ok">confort optimal</span>`);
    } else if (OAp < 0) {
      const dPP = Math.abs(OAp) <= 26 && Math.abs(OAp) >= 24;
      vd.className = "verdict";
      vd.textContent = "Image virtuelle, droite, agrandie — non projetable.";
      chips.push(`<span class="chip virt">virtuelle</span>`);
      chips.push(`<span class="chip neutral">droite · ×${fmt(Math.abs(gam), 1)}</span>`);
      chips.push(dPP ? `<span class="chip warn">image au PP : grossissement max, fatigant</span>`
                     : `<span class="chip neutral">légère accommodation</span>`);
    } else {
      vd.className = "verdict bad";
      vd.textContent = "Objet au-delà du foyer : ce n'est plus une loupe, l'image devient réelle et renversée.";
      chips.push(`<span class="chip warn">hors du régime loupe</span>`);
    }
    document.getElementById("ro-lp-chips").innerHTML = chips.join("");
  }
  render();
})();

/* ══════════════════ 7. APPAREIL PHOTO ══════════════════ */
(function () {
  const svg = document.getElementById("sv-cam");
  if (!svg) return;   /* banc absent de cette page */
  const st = { f: 50, d: 30 };               /* f en mm, d en décimètres */
  const Ox = 560, y0 = 196, SENS = 24;       /* capteur 24 mm de haut */

  const cF = document.getElementById("c-cf"), cD = document.getElementById("c-cd");
  cF.addEventListener("input", e => { st.f = +e.target.value; render(); });
  cD.addEventListener("input", e => { st.d = +e.target.value; render(); });
  document.getElementById("p-cam").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    st.f = +b.dataset.p; cF.value = st.f; render();
  });

  function render() {
    const f = st.f, dm = st.d / 10;                     /* distance sujet, en m */
    const alpha = Math.atan(SENS / 2 / f);              /* demi-champ, radians */
    const frame = 2 * dm * Math.tan(alpha);             /* hauteur cadrée, m */
    const OA = -dm * 1000, OAp = 1 / (1 / f + 1 / OA);  /* tirage, mm */
    const gam = OAp / OA;
    const subj = 1.70;                                  /* sujet de référence, m */
    const onSensor = Math.abs(gam) * subj * 1000;       /* taille sur le capteur, mm */

    /* longueur du cône choisie pour que le cadre tienne dans la scène */
    const Lc = Math.min(430, 138 / Math.tan(alpha));
    const pxm = Lc / dm;                                 /* px par mètre à cette distance */
    const half = Lc * Math.tan(alpha);
    const sx = Ox - Lc;

    let g = defs("cm");
    g += L({ x: 20, y: y0 }, { x: 786, y: y0 }, "hair");
    /* boîtier */
    g += `<rect x="${Ox - 14}" y="${y0 - 96}" width="150" height="192" rx="6"
            fill="color-mix(in srgb,var(--ink-3) 9%,transparent)" stroke="var(--ink-3)" stroke-width="1.2"/>`;
    g += T(Ox + 62, y0 - 106, "boîtier", "tag", "middle");
    /* objectif */
    const lh = 62;
    g += `<path d="M${Ox} ${y0 - lh} C ${Ox + 16} ${y0 - lh * .4} ${Ox + 16} ${y0 + lh * .4} ${Ox} ${y0 + lh}
                   C ${Ox - 16} ${y0 + lh * .4} ${Ox - 16} ${y0 - lh * .4} ${Ox} ${y0 - lh} z" class="glass"/>`;
    g += DOT(Ox, y0, "dot-key", 3.5) + T(Ox, y0 + 84, "objectif", "tag");
    /* capteur : le tirage est schématique, sa valeur est donnée en clair */
    const cx = Ox + 96;
    g += L({ x: cx, y: y0 - 44 }, { x: cx, y: y0 + 44 }, "", `stroke="var(--ink-2)" stroke-width="7" opacity=".3"`);
    g += L({ x: cx, y: y0 - 44 }, { x: cx, y: y0 + 44 }, "", `stroke="var(--ink-2)" stroke-width="1.4"`);
    g += T(cx + 12, y0 - 52, "capteur", "tag", "start");
    g += T(cx + 12, y0 - 36, "24 mm", "tag", "start");
    g += T(786, 384, "tirage du capteur schématique — sa valeur exacte est dans le panneau", "tag", "end");

    /* cône de champ, à l'angle réel */
    const up = { x: sx, y: y0 - half }, dn = { x: sx, y: y0 + half };
    g += `<path d="M${Ox} ${y0} L${up.x} ${up.y} L${dn.x} ${dn.y} z"
            fill="color-mix(in srgb,var(--beam) 9%,transparent)"/>`;
    g += L({ x: Ox, y: y0 }, up, "beam", `marker-end="url(#cm-beam)"`);
    g += L({ x: Ox, y: y0 }, dn, "beam", `marker-end="url(#cm-beam)"`);
    const a = alpha / Math.PI * 180;
    const arcR = 74;
    const p0 = { x: Ox - arcR * Math.cos(alpha), y: y0 - arcR * Math.sin(alpha) };
    const p1 = { x: Ox - arcR * Math.cos(alpha), y: y0 + arcR * Math.sin(alpha) };
    g += `<path d="M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${arcR} ${arcR} 0 0 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}"
            class="arc" stroke-dasharray="4 3"/>`;
    g += T(Ox - arcR - 16, y0 - 4, `${fmt(2 * a, 0)}°`, "tag-b", "end");
    g += T(Ox - arcR - 16, y0 + 14, "de champ", "tag", "end");

    /* cadre couvert à la distance du sujet + sujet de 1,70 m */
    g += L(up, dn, "img-v", `stroke-width="2"`);
    g += T(sx - 10, y0 - half + 4, `${fmt(frame, 2)} m`, "tag-i", "end");
    g += T(sx - 10, y0 - half + 22, "hauteur cadrée", "tag", "end");
    const sh = Math.min(subj * pxm, 300);
    const fits = subj <= frame;
    g += L({ x: sx + 34, y: y0 + Math.min(half, sh / 2) },
           { x: sx + 34, y: y0 + Math.min(half, sh / 2) - sh }, "obj",
           `marker-end="url(#cm-obj)" ${fits ? "" : 'stroke-dasharray="7 5"'}`);
    g += T(sx + 34, y0 + Math.min(half, sh / 2) + 20, "sujet 1,70 m", "tag-o");

    svg.innerHTML = g;

    document.getElementById("v-cf").textContent = f + " mm";
    document.getElementById("v-cd").textContent = fmt(dm, 1) + " m";

    document.getElementById("ro-cam-calc").innerHTML =
      `<div class="step">tan α = (24/2) / f′ = 12/${f}</div>` +
      `<div class="step">α = ${fmt(a, 1)}°  →  champ = <b>${fmt(2 * a, 0)}°</b></div>` +
      `<div class="step">cadre = 2 × ${fmt(dm, 1)} × tan α</div>` +
      `<div class="step">cadre = <b>${fmt(frame, 2)} m</b> de haut</div>`;
    document.getElementById("ro-cam-vals").innerHTML =
      `<dt>Focale f′</dt><dd>${f} mm</dd>` +
      `<dt>Champ de vision</dt><dd>${fmt(2 * a, 0)}°</dd>` +
      `<dt>Tirage <span class="ov">OA′</span></dt><dd>${fmt(OAp, 1)} mm</dd>` +
      `<dt>Grandissement γ</dt><dd>${sgn(gam, 3)}</dd>` +
      `<dt>Sujet sur le capteur</dt><dd>${fmt(onSensor, 1)} mm</dd>`;
    const vd = document.getElementById("ro-cam-verdict");
    vd.className = "verdict " + (fits ? "" : "bad");
    vd.textContent = fits
      ? `Un sujet de 1,70 m tient dans le cadre à ${fmt(dm, 1)} m.`
      : `À ${fmt(dm, 1)} m, un sujet de 1,70 m ne tient pas dans le cadre.`;
    const chips = [];
    chips.push(`<span class="chip neutral">${f <= 28 ? "grand-angle" : f >= 100 ? "téléobjectif" : "focale normale"}</span>`);
    chips.push(`<span class="chip real">image réelle, renversée, réduite</span>`);
    chips.push(`<span class="chip neutral">tirage ≈ f′ dès que le sujet est loin</span>`);
    document.getElementById("ro-cam-chips").innerHTML = chips.join("");
  }
  render();
})();

/* ══════════════════ 8. LE MICROSCOPE ══════════════════ */
(function () {
  const svg = document.getElementById("sv-micro");
  if (!svg) return;   /* banc absent de cette page */
  const st = { f1: 4, f2: 25, delta: 160 };   /* en mm */
  const y0 = 210, O1 = 190, F1PX = 46, XI = 470, F2PX = 96;
  const O2 = XI + F2PX;

  [["c-mf1", "f1"], ["c-mf2", "f2"], ["c-md", "delta"]].forEach(([id, k]) => {
    document.getElementById(id).addEventListener("input", e => {
      st[k] = +e.target.value; render();
    });
  });

  function render() {
    const { f1, f2, delta } = st;
    const gam1 = -delta / f1;                 /* grandissement de l'objectif */
    const Goc = 250 / f2;                     /* grossissement de l'oculaire */
    const G = Math.abs(gam1) * Goc;
    const OA1 = -f1 * (f1 + delta) / delta;   /* position de l'objet, mm */
    const OA1p = f1 + delta;

    let g = defs("mi");
    g += L({ x: 16, y: y0 }, { x: 786, y: y0 }, "hair");
    /* lentilles */
    const lens = (x, half, bulge) =>
      `<path d="M${x} ${y0 - half} C ${x + bulge} ${y0 - half * .4} ${x + bulge} ${y0 + half * .4} ${x} ${y0 + half}
                C ${x - bulge} ${y0 + half * .4} ${x - bulge} ${y0 - half * .4} ${x} ${y0 - half} z" class="glass"/>`;
    g += lens(O1, 62, 13) + lens(O2, 84, 18);
    g += L({ x: O1, y: y0 - 76 }, { x: O1, y: y0 + 76 }, "hair-d");
    g += L({ x: O2, y: y0 - 98 }, { x: O2, y: y0 + 98 }, "hair-d");
    g += T(O1, y0 + 96, "OBJECTIF", "tag-b", "middle");
    g += T(O1, y0 + 112, `f₁′ = ${fmt(f1, 1)} mm`, "tag", "middle");
    g += T(O2 + 92, y0 + 96, "OCULAIRE", "tag-b", "middle");
    g += T(O2 + 92, y0 + 112, `f₂′ = ${fmt(f2, 0)} mm`, "tag", "middle");
    [[O1 - F1PX, "F₁"], [O1, "O₁"], [O1 + F1PX, "F₁′"], [O2, "O₂"]].forEach(([x, lab]) => {
      g += DOT(x, y0, "dot-key", 3.2) + T(x, y0 + 22, lab, "pt");
    });
    g += DOT(XI, y0, "dot-key", 3.2) + T(XI - 14, y0 + 22, "F₂", "pt", "end");
    /* intervalle optique Δ */
    g += L({ x: O1 + F1PX, y: 60 }, { x: XI, y: 60 }, "hair-d");
    g += L({ x: O1 + F1PX, y: 54 }, { x: O1 + F1PX, y: 66 }, "hair");
    g += L({ x: XI, y: 54 }, { x: XI, y: 66 }, "hair");
    g += T((O1 + F1PX + XI) / 2, 50, `Δ = ${delta} mm`, "tag", "middle");

    /* objet, image intermédiaire (hauteur comprimée pour rester lisible) */
    const h = 22;
    const hI = -Math.min(96, Math.max(46, Math.abs(gam1) * 2.2));
    const xA = O1 - 58;
    const B = { x: xA, y: y0 - h };
    g += L({ x: xA, y: y0 }, B, "obj", `marker-end="url(#mi-obj)"`);
    g += DOT(xA, y0, "dot-obj", 3.6);
    g += T(xA - 10, y0 - 6, "A", "pt-obj", "end");
    g += T(xA, B.y - 10, "B", "pt-obj");
    g += T(xA, y0 + 40, "objet", "tag-o");

    /* étage 1 : deux rayons construisent B₁ */
    const B1 = { x: XI, y: y0 - hI };
    const rays = [];
    rays.push(L(B, { x: O1, y: B.y }, "beam"));
    rays.push(L({ x: O1, y: B.y }, B1, "beam"));
    rays.push(L(B, { x: O1, y: y0 }, "beam"));
    rays.push(L({ x: O1, y: y0 }, B1, "beam"));
    /* image intermédiaire */
    rays.push(L({ x: XI, y: y0 }, B1, "img") + DOT(XI, y0, "dot-img", 4));
    /* étage 2 : objet en F₂ → faisceau parallèle */
    const d = norm({ x: O2 - B1.x, y: y0 - B1.y });
    [{ x: O2, y: B1.y }, { x: O2, y: y0 }, { x: O2, y: y0 + 62 }].forEach(P => {
      rays.push(L(B1, P, "beam-dim"));
      rays.push(L(P, { x: P.x + d.x * 168, y: P.y + d.y * 168 }, "beam", `marker-end="url(#mi-beam)"`));
    });
    g += `<g clip-path="url(#mi-clip)">${rays.join("")}</g>`;
    g += T(XI + 10, y0 - hI + 16, "B₁", "pt-img", "start");
    g += T(XI - 12, y0 - 8, "A₁", "pt-img", "end");
    g += T(XI + 30, y0 - hI + 34, "image intermédiaire, en F₂", "tag-i", "middle");
    g += T(XI + 30, y0 - hI + 50, "réelle · renversée · agrandie", "tag", "middle");
    g += T(786, 44, "rayons parallèles en sortie", "tag-b", "end");
    g += T(786, 62, "→ image finale virtuelle, à l'infini", "tag-i", "end");
    g += T(786, 80, "et RENVERSÉE", "tag-i", "end");
    g += T(16, 404, "proportions non respectées : f₁′ est en réalité 40 fois plus petit que Δ", "tag", "start");
    svg.innerHTML = g;

    document.getElementById("v-mf1").textContent = fmt(f1, 1) + " mm";
    document.getElementById("v-mf2").textContent = fmt(f2, 1) + " mm";
    document.getElementById("v-md").textContent = delta + " mm";

    document.getElementById("ro-mi-calc").innerHTML =
      `<div class="step">γ<sub>obj</sub> = −Δ/f₁′ = −${delta}/${fmt(f1, 1)}</div>` +
      `<div class="step">γ<sub>obj</sub> = <b>${sgn(gam1, 1)}</b>  (×${fmt(Math.abs(gam1), 0)})</div>` +
      `<div class="step">G<sub>oc</sub> = 0,25/f₂′ = <b>×${fmt(Goc, 1)}</b></div>` +
      `<div class="step">G = γ<sub>obj</sub> × G<sub>oc</sub> = <b>×${fmt(G, 0)}</b></div>`;
    document.getElementById("ro-mi-vals").innerHTML =
      `<dt>Objet <span class="ov">O₁A</span></dt><dd>${sgn(OA1, 2)} mm</dd>` +
      `<dt>Image interm. <span class="ov">O₁A₁</span></dt><dd>${sgn(OA1p, 0)} mm</dd>` +
      `<dt>γ objectif</dt><dd>${sgn(gam1, 1)}</dd>` +
      `<dt>G oculaire</dt><dd>×${fmt(Goc, 1)}</dd>` +
      `<dt>G total</dt><dd>×${fmt(G, 0)}</dd>`;
    const vd = document.getElementById("ro-mi-verdict");
    vd.className = "verdict";
    vd.textContent = `Image finale virtuelle, très agrandie et renversée — ×${fmt(G, 0)}.`;
    document.getElementById("ro-mi-chips").innerHTML =
      `<span class="chip virt">virtuelle, à l'infini</span>` +
      `<span class="chip neutral">renversée · une seule inversion</span>` +
      `<span class="chip neutral">objet à ${fmt(Math.abs(OA1), 2)} mm de l'objectif</span>`;
  }
  render();
})();

/* ══════════════════ 9. PRINCIPE DE FERMAT ══════════════════ */
(function () {
  const svg = document.getElementById("sv-fermat");
  if (!svg) return;   /* banc absent de cette page */
  const st = { t: 30, n2: 150 };
  const A = { x: 140, y: 62 }, Bp = { x: 640, y: 268 }, IY = 168;
  const CH = { top: 306, bot: 396 };          /* bande du graphe */

  const cX = document.getElementById("c-fmx"), cN = document.getElementById("c-fmn");
  cX.addEventListener("input", e => { st.t = +e.target.value; render(); });
  cN.addEventListener("input", e => { st.n2 = +e.target.value; render(); });
  document.getElementById("p-fm").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    st.t = b.dataset.p === "min" ? tOf(xOpt()) : tOf(xStraight());
    cX.value = st.t; render();
  });
  svg.addEventListener("pointerdown", e => {
    svg.setPointerCapture(e.pointerId); svg.dataset.drag = "1"; move(e); e.preventDefault();
  });
  svg.addEventListener("pointermove", e => { if (svg.dataset.drag === "1") move(e); });
  const stop = () => { svg.dataset.drag = "0"; };
  svg.addEventListener("pointerup", stop); svg.addEventListener("pointercancel", stop);
  function move(e) {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 800;
    st.t = Math.max(0, Math.min(100, tOf(x)));
    cX.value = st.t.toFixed(1); render();
  }

  const xOf = t => A.x + (Bp.x - A.x) * t / 100;
  const tOf = x => (x - A.x) / (Bp.x - A.x) * 100;
  const n1 = 1;
  const nn = () => st.n2 / 100;
  /* chemin optique : proportionnel au temps de parcours */
  const Lopt = x => n1 * Math.hypot(x - A.x, IY - A.y) + nn() * Math.hypot(Bp.x - x, Bp.y - IY);
  function xOpt() {
    let best = A.x, bv = Infinity;
    for (let x = A.x; x <= Bp.x; x += 0.5) { const v = Lopt(x); if (v < bv) { bv = v; best = x; } }
    return best;
  }
  const xStraight = () => A.x + (Bp.x - A.x) * (IY - A.y) / (Bp.y - A.y);

  function render() {
    const n2 = nn();
    const x = xOf(st.t), I = { x, y: IY };
    const xm = xOpt(), Lm = Lopt(xm), Lc = Lopt(x);
    const excess = (Lc - Lm) / Lm * 100;
    const i1 = Math.atan2(x - A.x, IY - A.y) * 180 / Math.PI;
    const i2 = Math.atan2(Bp.x - x, Bp.y - IY) * 180 / Math.PI;
    const s1 = n1 * Math.sin(i1 * RAD), s2 = n2 * Math.sin(i2 * RAD);

    let g = defs("fm");
    /* milieux */
    g += `<rect x="0" y="28" width="800" height="${IY - 28}" fill="color-mix(in srgb,var(--beam) 7%,transparent)"/>`;
    g += `<rect x="0" y="${IY}" width="800" height="${296 - IY}" fill="color-mix(in srgb,var(--glass) 8%,transparent)"/>`;
    g += L({ x: 10, y: IY }, { x: 790, y: IY }, "", `stroke="var(--ink-2)" stroke-width="1.8"`);
    g += T(786, 48, `milieu 1 · n₁ = 1,00 · la lumière y va vite`, "tag", "end");
    g += T(786, IY + 22, `milieu 2 · n₂ = ${fmt(n2, 2)} · elle y va ${n2 > 1.4 ? "lentement" : "un peu moins vite"}`, "tag", "end");

    /* trajet de référence : le minimum */
    g += `<g opacity=".45">${L(A, { x: xm, y: IY }, "beam-v") + L({ x: xm, y: IY }, Bp, "beam-v")}</g>`;
    g += L({ x: xm, y: IY - 9 }, { x: xm, y: IY + 9 }, "", `stroke="var(--ink-3)" stroke-width="1.4"`);

    /* trajet courant */
    g += L(A, I, "beam", `stroke-width="2.4"`);
    g += L(I, Bp, "beam", `stroke-width="2.4" marker-end="url(#fm-beam)"`);
    g += L({ x, y: IY - 58 }, { x, y: IY + 58 }, "hair-d");
    g += DOT(A.x, A.y, "dot-obj", 5.5) + T(A.x - 12, A.y - 6, "A", "pt-obj", "end");
    g += DOT(Bp.x, Bp.y, "dot-img", 5.5) + T(Bp.x + 12, Bp.y + 6, "B", "pt-img", "start");
    g += `<circle cx="${x}" cy="${IY}" r="9" fill="var(--beam)" stroke="var(--sunk)" stroke-width="2" style="cursor:ew-resize"/>`;
    g += T(x, IY - 80, "glisse-moi", "tag-b", "middle");
    if (Math.abs(xm - x) > 46) g += T(xm, IY - 16, "le plus rapide", "tag", "middle");

    /* angles */
    const arc = (a0, a1, r, up) => {
      const p = a => ({ x: x + r * Math.sin(a * RAD), y: IY + (up ? -1 : 1) * r * Math.cos(a * RAD) });
      const P0 = p(a0), P1 = p(a1);
      return `<path d="M${P0.x.toFixed(1)} ${P0.y.toFixed(1)} A ${r} ${r} 0 0 ${up ? 0 : 1} ${P1.x.toFixed(1)} ${P1.y.toFixed(1)}" class="arc"/>`;
    };
    g += arc(0, -i1, 40, true) + T(x - 30 - i1 * .18, IY - 46, "i₁", "ang", "middle");
    g += arc(0, i2, 40, false) + T(x + 30 + i2 * .18, IY + 56, "i₂", "ang", "middle");

    /* ─── courbe du temps de parcours ─── */
    const N = 140, xs = [], ys = [];
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= N; k++) {
      const xx = A.x + (Bp.x - A.x) * k / N, v = Lopt(xx);
      xs.push(xx); ys.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    const Y = v => CH.bot - (v - lo) / (hi - lo || 1) * (CH.bot - CH.top);
    g += L({ x: A.x, y: CH.bot + 1 }, { x: Bp.x, y: CH.bot + 1 }, "hair");
    g += T(A.x, CH.top - 16, "temps de parcours total", "tag", "start");
    g += T(Bp.x, CH.bot + 24, "position du point de passage I", "tag", "end");
    const pts = xs.map((xx, k) => `${xx.toFixed(1)},${Y(ys[k]).toFixed(1)}`).join(" ");
    g += `<polyline points="${pts}" fill="none" stroke="var(--beam)" stroke-width="2"
            stroke-linejoin="round" opacity=".9"/>`;
    /* minimum */
    g += L({ x: xm, y: Y(Lm) }, { x: xm, y: CH.bot }, "hair-d");
    g += DOT(xm, Y(Lm), "dot-key", 5);
    g += T(xm, Y(Lm) - 12, "minimum", "tag", "middle");
    /* point courant, relié au schéma */
    g += L({ x, y: IY + 62 }, { x, y: Y(Lc) }, "hair-d");
    g += `<circle cx="${x}" cy="${Y(Lc).toFixed(1)}" r="6" fill="var(--beam)" stroke="var(--sunk)" stroke-width="2"/>`;
    svg.innerHTML = g;

    /* ─── panneau ─── */
    document.getElementById("v-fmx").textContent = fmt(st.t, 0) + " %";
    document.getElementById("v-fmn").textContent = fmt(n2, 2);
    document.getElementById("ro-fm-calc").innerHTML =
      `<div class="step">n₁ sin i₁ = <b>${fmt(s1, 3)}</b></div>` +
      `<div class="step">n₂ sin i₂ = <b>${fmt(s2, 3)}</b></div>` +
      `<div class="step">écart = ${fmt(Math.abs(s1 - s2), 3)}</div>`;
    document.getElementById("ro-fm-vals").innerHTML =
      `<dt>Angle i₁</dt><dd>${fmt(i1, 1)}°</dd>` +
      `<dt>Angle i₂</dt><dd>${fmt(i2, 1)}°</dd>` +
      `<dt>Chemin optique</dt><dd>${fmt(Lc, 0)} u.a.</dd>` +
      `<dt>Minimum possible</dt><dd>${fmt(Lm, 0)} u.a.</dd>` +
      `<dt>Temps perdu</dt><dd>${excess < 0.05 ? "0 %" : "+" + fmt(excess, 1) + " %"}</dd>`;
    const vd = document.getElementById("ro-fm-verdict"), chips = [];
    if (excess < 0.05) {
      vd.className = "verdict good";
      vd.textContent = "Tu es au minimum : c'est le trajet que suit réellement la lumière.";
      chips.push(`<span class="chip ok">n₁ sin i₁ = n₂ sin i₂ ✓</span>`);
    } else {
      vd.className = "verdict";
      vd.textContent = `Ce trajet coûte ${fmt(excess, 1)} % de temps en plus que le meilleur.`;
      chips.push(`<span class="chip warn">Snell-Descartes non vérifiée</span>`);
      chips.push(`<span class="chip neutral">${s1 > s2 ? "décale I vers la gauche" : "décale I vers la droite"}</span>`);
    }
    chips.push(`<span class="chip neutral">le minimum se déplace quand n₂ change</span>`);
    document.getElementById("ro-fm-chips").innerHTML = chips.join("");
  }
  render();
})();
