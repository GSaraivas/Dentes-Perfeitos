import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);
const entered = (trigger) => ({ trigger, start: 'top 91%', once: true });
const ease = 'power3.out';

function fadeUp(node, vars = {}) {
  return gsap.from(node, { y: 24, opacity: 0, duration: .72, ease, ...vars });
}
function revealText(timeline) {
  timeline.from('h1 b', { yPercent: 108, stagger: .12, duration: .95, ease }, .19);
}
function imageReveal(figure) {
  gsap.from(figure, {
    clipPath: 'inset(12% 0 12% 0)', opacity: 0, duration: 1.05, ease,
    scrollTrigger: entered(figure)
  });
}
function staggerCards(group) {
  fadeUp(group.querySelectorAll('[data-card]'), { stagger: .065, scrollTrigger: entered(group) });
}
function parallaxImage(figure) {
  gsap.fromTo(figure.querySelector('img'), { scale: 1.1 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: figure, start: 'top bottom', end: 'center center', scrub: .55 }
  });
}
function sectionTransition() {
  document.querySelectorAll('[data-reveal]').forEach((section) => {
    fadeUp(section.children, { stagger: .085, scrollTrigger: entered(section) });
  });
}
function magneticButton(button) {
  const controller = new AbortController();
  const x = gsap.quickTo(button, 'x', { duration: .42, ease });
  const y = gsap.quickTo(button, 'y', { duration: .42, ease });
  const origin = button.parentElement;
  button.addEventListener('pointermove', (event) => {
    const box = button.getBoundingClientRect();
    x(gsap.getProperty(button,'x') + (event.clientX - box.left - box.width / 2) * .13);
    y(gsap.getProperty(button,'y') + (event.clientY - box.top - box.height / 2) * .13);
  }, { signal: controller.signal });
  button.addEventListener('pointerleave', () => { x(0); y(0); }, { signal: controller.signal });
  return () => { controller.abort(); gsap.set(button, { clearProps: 'transform' }); };
}
function initScrollScenes(state) {
  const steps = [...document.querySelectorAll('.steps li')];
  gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 28%', scrub: .65 }
  }).to(state.hero, { progress: 1, ease: 'none' }, 0)
    .to('.hero-copy', { opacity: .2, y: -38, ease: 'none' }, 0)
    .to('.hero-art .arch', { yPercent: 7, ease: 'none' }, 0);
  gsap.to(state.tech, {
    progress: 1, ease: 'none',
    scrollTrigger: { trigger: '.tech', pin: true, start: 'center center', end: '+=720', scrub: .65, anticipatePin: 1 },
    onUpdate() {
      const active = Math.min(2, Math.floor(state.tech.progress * 3));
      steps.forEach((step, index) => step.classList.toggle('active', index === active));
    }
  });
  return () => {
    state.hero.progress = 0;
    state.tech.progress = 0;
    steps.forEach((step, index) => step.classList.toggle('active', index === 0));
  };
}

export function initMotion(dialog) {
  const state = { hero: { progress: 0 }, tech: { progress: 0 } };
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    const intro = gsap.timeline();
    intro.from('.hero-art', { opacity: .35, duration: .72 })
      .from('.header', { y: -12, opacity: 0, duration: .6 }, .05)
      .add(fadeUp('.hero-copy .eyebrow'), .17)
      .add(fadeUp('.hero-copy .intro'), .62)
      .add(fadeUp('.actions > *', { stagger: .1 }), .77);
    revealText(intro);
    sectionTransition();
    document.querySelectorAll('[data-image]').forEach(imageReveal);
    document.querySelectorAll('.services,.team').forEach(staggerCards);
  });
  media.add('(min-width: 1024px) and (min-height: 740px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const lenis = new Lenis({ anchors: true, stopInertiaOnNavigate: true, allowNestedScroll: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => { if (!document.hidden) lenis.raf(time * 1000); };
    const stop = () => lenis.stop();
    const start = () => lenis.start();
    const observer = new MutationObserver(() => { if (dialog.open) stop(); else start(); });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('[data-image]').forEach(parallaxImage);
    const reset = initScrollScenes(state);
    const cleanups = [...document.querySelectorAll('.magnetic')].map(magneticButton);
    return () => {
      reset();
      observer.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
      cleanups.forEach((cleanup) => cleanup());
    };
  });
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  return state;
}