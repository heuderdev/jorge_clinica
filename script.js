/* ==========================================================================
   Monai Clinic: edite aqui os dados que ainda faltam
   ========================================================================== */

const CONFIG = {
  // Número com DDI e DDD, só dígitos. Exemplo: '5561999998888'.
  // Enquanto estiver vazio, os botões de agendamento usam o e-mail.
  whatsapp: '',
  email: 'clinicmonai@gmail.com',
  // URL do App da Web do Google Sheets (termina em /exec). Veja google-sheets/Code.gs.
  // Enquanto estiver vazia, o formulário abre o WhatsApp ou o e-mail.
  sheetsUrl: '',
};

// Os 6 casos de antes e depois. Coloque o caminho das fotos para cada caso.
// Exemplo: { titulo: 'Botox', antes: 'assets/img/resultados/01-antes.webp', depois: 'assets/img/resultados/01-depois.webp' }
const RESULTADOS = [
  { titulo: 'Caso 01', antes: '', depois: '' },
  { titulo: 'Caso 02', antes: '', depois: '' },
  { titulo: 'Caso 03', antes: '', depois: '' },
  { titulo: 'Caso 04', antes: '', depois: '' },
  { titulo: 'Caso 05', antes: '', depois: '' },
  { titulo: 'Caso 06', antes: '', depois: '' },
];

// Depoimentos reais, com autorização das pacientes. Com a lista vazia, a seção
// mostra o convite para o Instagram.
// Exemplo: { texto: 'Me senti acolhida do início ao fim.', nome: 'Nome da paciente', tratamento: 'Botox' }
const DEPOIMENTOS = [];

/* ========================================================================== */

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* Abertura: aparece só na primeira página vista da sessão */
function storageGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { sessionStorage.setItem(key, value); } catch { /* navegação privada */ } }

if (storageGet('monai-intro') || reduceMotion) root.classList.add('seen');
storageSet('monai-intro', '1');

/* Agendamento: WhatsApp quando houver número, e-mail enquanto não houver */
function contactUrl(message) {
  if (CONFIG.whatsapp) return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;
  const subject = encodeURIComponent('Agendamento pelo site');
  return `mailto:${CONFIG.email}?subject=${subject}&body=${encodeURIComponent(message)}`;
}

function formatPhone(digits) {
  const n = digits.replace(/^55/, '');
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n[2]} ${n.slice(3, 7)}-${n.slice(7)}` : n;
}

if (CONFIG.whatsapp) {
  $$('[data-whatsapp-only]').forEach((el) => { el.hidden = false; });
  $('#contact-phone').textContent = formatPhone(CONFIG.whatsapp);
  $('#contact-phone').href = contactUrl('Olá! Gostaria de agendar uma avaliação na Monai Clinic.');
  $('#contact-phone').removeAttribute('data-agendar');
  $('#contact-phone').target = '_blank';
  $('#form-label').textContent = 'Enviar pelo WhatsApp';
  $('#form-hint').textContent = 'Sua mensagem abre pronta no WhatsApp, é só enviar.';
}

if (CONFIG.sheetsUrl) {
  $('#form-label').textContent = 'Enviar';
  $('#form-hint').textContent = 'Ao enviar, você concorda que a Monai Clinic use estes dados para entrar em contato sobre o seu agendamento.';
}

/* Botões de agendar levam ao formulário, já com o tratamento escolhido */
const form = $('#form');
const select = $('#form-tratamento');

$$('[data-agendar]').forEach((el) => {
  el.addEventListener('click', () => {
    const tratamento = el.dataset.agendar;
    if (tratamento) select.value = tratamento;
    // Foca depois da rolagem suave para não interromper o movimento
    setTimeout(() => form.elements.nome.focus({ preventScroll: true }), 700);
  });
});

const formHint = $('#form-hint');
const formButton = $('button[type="submit"]', form);
const formLabel = $('#form-label');

function buildMessage() {
  const { nome, telefone, tratamento } = form.elements;
  const interesse = tratamento.value ? `Tenho interesse em ${tratamento.value}.` : 'Gostaria de uma avaliação.';
  return `Olá! Meu nome é ${nome.value.trim()}. ${interesse} Meu contato: ${telefone.value.trim()}.`;
}

function showFormStatus(state, text, fallback) {
  formHint.className = `form__hint field--full ${state}`;
  formHint.textContent = text;
  if (fallback) {
    const link = document.createElement('a');
    link.href = fallback.url;
    link.textContent = fallback.label;
    if (CONFIG.whatsapp) { link.target = '_blank'; link.rel = 'noopener'; }
    formHint.append(' ', link);
  }
}

async function saveToSheets() {
  const { nome, telefone, tratamento, website } = form.elements;
  const digits = telefone.value.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 13) {
    showFormStatus('is-error', 'Confira o telefone: informe o DDD e o número.');
    telefone.focus();
    return;
  }

  // Sem cabeçalhos personalizados: o Apps Script não responde à verificação prévia de CORS
  const body = new URLSearchParams({
    nome: nome.value.trim(),
    telefone: telefone.value.trim(),
    tratamento: tratamento.value,
    website: website.value,
  });
  const fallbackMessage = buildMessage();
  const originalLabel = formLabel.textContent;
  formButton.disabled = true;
  formLabel.textContent = 'Enviando...';
  showFormStatus('', 'Enviando seus dados...');

  try {
    const response = await fetch(CONFIG.sheetsUrl, { method: 'POST', body, signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'erro');
    form.reset();
    showFormStatus('is-ok', 'Recebemos seu contato. Em breve falaremos com você pelo telefone informado.');
  } catch (error) {
    console.error('Falha ao salvar o contato', error);
    showFormStatus('is-error', 'Não conseguimos enviar agora, e seus dados continuam no formulário.', {
      url: contactUrl(fallbackMessage),
      label: CONFIG.whatsapp ? 'Enviar pelo WhatsApp' : 'Enviar por e-mail',
    });
  } finally {
    formButton.disabled = false;
    formLabel.textContent = originalLabel;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (CONFIG.sheetsUrl) {
    saveToSheets();
    return;
  }
  const url = contactUrl(buildMessage());
  if (CONFIG.whatsapp) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
});

/* Navbar: o abrir e fechar é CSS puro. Aqui só fechamos ao escolher um link. */
const navToggle = $('#nav-toggle');
$$('.nav a').forEach((a) => a.addEventListener('click', () => { navToggle.checked = false; }));
addEventListener('keydown', (event) => { if (event.key === 'Escape') navToggle.checked = false; });

/* Estado da navbar e botão flutuante ao rolar */
const header = $('.header');
const floatCta = $('.float-cta');
const hero = $('.hero');
const contact = $('#contato');
const parallaxItems = reduceMotion ? [] : $$('[data-parallax]');
let ticking = false;

function onScroll() {
  ticking = false;
  const y = scrollY;
  header.classList.toggle('is-stuck', y > 24);

  const contactVisible = contact.getBoundingClientRect().top < innerHeight * 0.7;
  floatCta.classList.toggle('is-on', y > hero.offsetHeight * 0.7 && !contactVisible);

  parallaxItems.forEach((el) => {
    el.style.transform = `translate3d(0, ${Math.min(y, innerHeight) * Number(el.dataset.parallax)}px, 0)`;
  });
}
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

/* Link da seção atual na navbar */
const navLinks = new Map($$('.nav__list a').map((a) => [a.getAttribute('href').slice(1), a]));
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
    const current = navLinks.get(entry.target.id);
    current.classList.add('is-current');
    current.setAttribute('aria-current', 'true');
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((_, id) => sectionObserver.observe(document.getElementById(id)));

/* Tratamentos: acordeão e imagem em arco */
const items = $$('.tx__item');
const stageImages = $$('.tx__arch img');
let openIndex = 0;

function showStage(index) {
  stageImages.forEach((img, i) => img.classList.toggle('is-active', i === index));
}

function openItem(index) {
  const closing = index === openIndex;
  items.forEach((item, i) => {
    const open = i === index && !closing;
    item.classList.toggle('is-open', open);
    $('.tx__btn', item).setAttribute('aria-expanded', String(open));
  });
  openIndex = closing ? -1 : index;
  showStage(index);
}

items.forEach((item, index) => {
  $('.tx__btn', item).addEventListener('click', () => openItem(index));
  if (matchMedia('(hover: hover)').matches) {
    item.addEventListener('pointerenter', () => showStage(index));
  }
});
$('.tx__list').addEventListener('pointerleave', () => {
  if (openIndex >= 0) showStage(openIndex);
});

// As imagens empilhadas têm carregamento adiado; pedimos todas quando a seção se aproxima
const stageObserver = new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  stageImages.forEach((img) => { img.loading = 'eager'; });
  obs.disconnect();
}, { rootMargin: '400px' });
stageObserver.observe($('.tx'));

/* Resultado: comparador de antes e depois */
const monogramSvg = '<svg aria-hidden="true"><use href="#monogram"/></svg>';
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pane(src, alt) {
  return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" draggable="false">` : monogramSvg;
}

const grid = $('#ba-grid');
grid.innerHTML = RESULTADOS.map((caso, i) => {
  const hasPhotos = Boolean(caso.antes && caso.depois);
  const titulo = escapeHtml(caso.titulo);
  return `
    <figure class="ba reveal" style="transition-delay:${(i % 3) * 90}ms">
      <div class="ba__frame">
        <div class="ba__pane ba__pane--before">${pane(caso.antes, `${caso.titulo}, antes`)}</div>
        <div class="ba__pane ba__pane--after">${pane(caso.depois, `${caso.titulo}, depois`)}</div>
        <span class="ba__tag ba__tag--before">Antes</span>
        <span class="ba__tag ba__tag--after">Depois</span>
        <input class="ba__input" type="range" min="0" max="100" value="50" aria-label="Comparar antes e depois: ${titulo}">
        <span class="ba__rule"></span>
      </div>
      <figcaption class="ba__cap"><span>${titulo}</span>${hasPhotos ? '' : '<span>Foto em breve</span>'}</figcaption>
    </figure>`;
}).join('');

$$('.ba', grid).forEach((card) => {
  const input = $('.ba__input', card);
  const setPos = () => card.style.setProperty('--pos', `${input.value}%`);
  input.addEventListener('input', setPos);
  setPos();
});

/* Depoimentos: só substitui o convite quando houver relatos reais */
if (DEPOIMENTOS.length) {
  const depoRoot = $('#depo-root');
  let current = 0;
  const render = () => {
    const d = DEPOIMENTOS[current];
    depoRoot.innerHTML = `
      <h2 class="title title--light">Quem viveu a <em>experiência.</em></h2>
      <blockquote class="depo__quote" style="margin-inline:0" aria-live="polite">“${escapeHtml(d.texto)}”</blockquote>
      <p class="depo__who">${escapeHtml(d.nome)}${d.tratamento ? ` · ${escapeHtml(d.tratamento)}` : ''}</p>
      ${DEPOIMENTOS.length > 1 ? `<div class="depo__nav">
        <button type="button" data-step="-1" aria-label="Depoimento anterior"><svg class="ico"><use href="#arrow"/></svg></button>
        <button type="button" data-step="1" aria-label="Próximo depoimento"><svg class="ico"><use href="#arrow"/></svg></button>
      </div>` : ''}`;
  };
  depoRoot.addEventListener('click', (event) => {
    const button = event.target.closest('[data-step]');
    if (!button) return;
    current = (current + Number(button.dataset.step) + DEPOIMENTOS.length) % DEPOIMENTOS.length;
    render();
  });
  render();
}

/* Revelação ao rolar */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    obs.unobserve(entry.target);
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
$$('.reveal').forEach((el) => revealObserver.observe(el));

/* Ano do rodapé */
$('#ano').textContent = new Date().getFullYear();
