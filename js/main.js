import { assetUrl } from './assets.js';
import { clinicConfig } from './config.js';
import { services, team, gallery, quotes } from './content.js';
import '@fontsource-variable/manrope';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';

const asset = (name) => assetUrl(name + ".webp");
const $ = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const number = (index) => String(index + 1).padStart(2, '0');
const photo = (name, alt = '') => `<img src="${asset(name)}" alt="${alt}" loading="lazy" width="650" height="650">`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

$('#services').innerHTML = services.map(([title, description, image], i) => `
  <article class="service" data-card><div class="service-top"><span>[${number(i)}]</span><span aria-hidden="true">✧</span></div>
  <figure>${photo(image)}</figure><h3>${title}</h3><p>${description}</p>
  <button class="text-link" data-service="${i}" aria-label="Conhecer ${title}">Conhecer tratamento <span aria-hidden="true">↗</span></button></article>`).join('');
$('#team').innerHTML = team.map(([name, specialty, bio, image]) => `
  <article data-card><figure>${photo(image, `Retrato ilustrativo de ${name}`)}</figure><div><h3>${name}</h3><p>${specialty}</p><small>CRO real a informar</small><p>${bio}</p></div></article>`).join('');
$('#gallery').innerHTML = gallery.map(([image, label, alt], i) => `
  <button type="button" data-gallery="${i}" aria-label="Ampliar foto: ${label}">${photo(image, alt)}<span>${label}<b aria-hidden="true">↗</b></span></button>`).join('');
$('#footer-services').innerHTML = services.map(([title], i) => `<button data-service="${i}">${title}</button>`).join('');

const menu = $('#menu');
const toggle = $('.menu-toggle');
function setMenu(open) {
  menu.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
}
toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    setMenu(false);
    const section = document.querySelector(event.target.hash);
    if (section) {
      section.tabIndex = -1;
      section.focus({ preventScroll: true });
    }
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.header')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.classList.contains('open')) {
    setMenu(false);
    toggle.focus();
  }
});

const dialog = $('#modal');
const dialogBody = $('#modal-body');
let opener;
let galleryIndex = null;
function openDialog(trigger, markup) {
  opener = trigger;
  dialogBody.innerHTML = markup;
  dialog.showModal();
  document.body.classList.add('modal-open');
}
function galleryMarkup(index) {
  const [image, label, alt] = gallery[index];
  return `<h2 id="modal-title">${label}</h2>${photo(image, alt)}<p>Imagem conceitual · ${number(index)} / ${gallery.length}</p>
    <div class="modal-nav"><button class="button outline" data-gallery-direction="-1">← Anterior</button><button class="button outline" data-gallery-direction="1">Próxima →</button></div>`;
}
function moveGallery(direction) {
  galleryIndex = (galleryIndex + direction + gallery.length) % gallery.length;
  dialogBody.innerHTML = galleryMarkup(galleryIndex);
  dialogBody.querySelector(`[data-gallery-direction="${direction}"]`).focus();
}
$('.modal-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
  const direction = event.target.closest('[data-gallery-direction]');
  if (direction) moveGallery(Number(direction.dataset.galleryDirection));
});
dialog.addEventListener('keydown', (event) => {
  if (galleryIndex === null || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  moveGallery(event.key === 'ArrowRight' ? 1 : -1);
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  galleryIndex = null;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
});

const message = 'Olá! Conheci a Aura Dental pelo site e gostaria de obter informações sobre uma avaliação odontológica.';
const whatsapp = `https://wa.me/${clinicConfig.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
const realWhatsApp = !clinicConfig.demo && /^\d{10,15}$/.test(clinicConfig.whatsapp) && clinicConfig.whatsapp !== '5511999999999';
$('[data-demo-note]').hidden = realWhatsApp;
if (realWhatsApp) $('[data-demo-note]').style.display = 'none';

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-dialog],[data-service],[data-gallery],[data-whatsapp]');
  if (!trigger) return;
  if (trigger.hasAttribute('data-whatsapp')) {
    if (realWhatsApp) window.open(whatsapp, '_blank', 'noopener,noreferrer');
    else openDialog(trigger, '<h2 id="modal-title">Agendamento demonstrativo</h2><p>O número de WhatsApp é ilustrativo. O link de agendamento será habilitado quando a clínica cadastrar o contato oficial.</p>');
    return;
  }
  if (trigger.hasAttribute('data-gallery')) {
    galleryIndex = Number(trigger.dataset.gallery);
    openDialog(trigger, galleryMarkup(galleryIndex));
    return;
  }
  if (trigger.hasAttribute('data-service')) {
    const [title, description, image, details] = services[Number(trigger.dataset.service)];
    openDialog(trigger, `<h2 id="modal-title">${title}</h2>${photo(image)}<p>${description}</p><p>${details}</p><a class="button dark" href="#contato">Ir para agendamento ↗</a>`);
    dialogBody.querySelector('a').addEventListener('click', () => {
      opener = null;
      dialog.close();
      const contact = $('#contato');
      contact.tabIndex = -1;
      contact.focus({ preventScroll: true });
    });
    return;
  }
  const content = {
    essencia: '<h2 id="modal-title">Nossa essência</h2><p>A proposta da Aura Dental é acolher cada pessoa e explicar as opções de cuidado com clareza. A avaliação é o momento para entender prioridades, esclarecer dúvidas e definir os próximos passos em conjunto.</p>',
    privacidade: '<h2 id="modal-title">Política de Privacidade</h2><p>Esta demonstração não possui formulários, cadastro ou rastreadores próprios. As preferências de navegação são processadas apenas para exibir a interface.</p><p>Quando configurados, links de contato abrem serviços de terceiros, sujeitos às respectivas políticas. A versão da clínica deverá informar o responsável pelo tratamento de dados e os canais para exercer os direitos de privacidade.</p>'
  };
  openDialog(trigger, content[trigger.dataset.dialog]);
});

let quoteIndex = 0;
function showQuote(direction = 0) {
  quoteIndex = (quoteIndex + direction + quotes.length) % quotes.length;
  const [label, description] = quotes[quoteIndex];
  $('#quote').innerHTML = `<blockquote>${description}</blockquote><small>${label} · espaço demonstrativo</small>`;
  $('#quote-count').textContent = `${number(quoteIndex)} / ${number(quotes.length - 1)}`;
  if (direction && !reduced.matches) $('#quote').animate([{ opacity: .25, transform: `translateX(${direction * 12}px)` }, { opacity: 1, transform: 'none' }], { duration: 240 });
}
showQuote();
$('#quote-prev').onclick = () => showQuote(-1);
$('#quote-next').onclick = () => showQuote(1);
$('.quote-panel').addEventListener('keydown', (event) => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  showQuote(event.key === 'ArrowRight' ? 1 : -1);
});

for (const field of ['address','hours']) {
  if (clinicConfig[field]) $(`[data-field="${field}"]`).textContent = clinicConfig[field];
}
if (clinicConfig.responsibleProfessional && clinicConfig.cro) {
  $('[data-field="professional"]').textContent = `${clinicConfig.responsibleProfessional} · CRO ${clinicConfig.cro}`;
}
for (const field of ['instagram','maps']) {
  if (!clinicConfig[field]?.startsWith('https://') || (field === 'maps' && !clinicConfig.address)) continue;
  const link = document.createElement('a');
  link.href = clinicConfig[field];
  link.textContent = field === 'instagram' ? 'Instagram ↗' : 'Google Maps ↗';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  $(`[data-social="${field}"]`).replaceWith(link);
}
$('#year').textContent = new Date().getFullYear();
const float = $('.float');
new IntersectionObserver(([entry]) => { float.hidden = entry.isIntersecting; }).observe($('.footer'));

const motion = await import('./animations.js').catch((error) => {
  console.warn('As animações opcionais não puderam ser carregadas.', error);
  return null;
});
if (motion) {
  const scrollState = motion.initMotion(dialog);
  const loadScenes = () => {
    if (reduced.matches || document.visibilityState === 'hidden') return;
    import('./three.js').then(({ initScenes }) => {
      if (!reduced.matches) initScenes(scrollState);
    }).catch(() => { /* A imagem estática já está visível. */ });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(loadScenes, { timeout: 1800 });
  else setTimeout(loadScenes, 400);
}