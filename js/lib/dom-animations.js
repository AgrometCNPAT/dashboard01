/* =========================================================
   dom-animations.js
   Reveal-on-scroll (IntersectionObserver) e count-up numérico.
   Complementa particles3d.js / tower3d.js, que cuidam do 3D.
   ========================================================= */

/** Ativa reveal-on-scroll para todos os elementos .reveal / .reveal-stagger ainda não revelados. */
function initScrollReveal(root=document){
  const els = root.querySelectorAll(".reveal:not(.is-visible), .reveal-stagger:not(.is-visible)");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));
}

/** Anima um número de 0 até o valor final. */
function countUp(el, endValue, opts={}){
  const duration = opts.duration || 700;
  const decimals = opts.decimals ?? 0;
  const suffix = opts.suffix || "";
  const start = performance.now();

  function frame(now){
    const t = Math.min((now-start)/duration, 1);
    const eased = 1 - Math.pow(1-t, 3);
    const val = endValue*eased;
    el.textContent = val.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if(t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.CajuCarbo = window.CajuCarbo || {};
Object.assign(window.CajuCarbo, { initScrollReveal, countUp });
