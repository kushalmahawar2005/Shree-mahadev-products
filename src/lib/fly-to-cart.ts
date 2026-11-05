/**
 * "Fly to cart": clones the product photo and arcs it into the header cart icon.
 * Pure Web Animations API (no layout work, cleans itself up). Skipped for reduced motion.
 */
export function flyToCart(from: Element | null, src?: string) {
  if (typeof window === "undefined" || !from || !src) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].find((el) => el.getBoundingClientRect().width > 0);
  if (!target) return;

  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = Math.min(a.width, a.height) * 0.7;
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  Object.assign(img.style, {
    position: "fixed",
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    zIndex: "9999",
    pointerEvents: "none",
    filter: "drop-shadow(0 12px 18px rgba(0,0,0,.25))",
  });
  document.body.appendChild(img);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = img.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 120}px) scale(0.55) rotate(-12deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(8deg)`, opacity: 0.6 },
    ],
    { duration: 750, easing: "cubic-bezier(0.55, 0, 0.25, 1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    img.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 350, easing: "ease-out" });
  };
}
