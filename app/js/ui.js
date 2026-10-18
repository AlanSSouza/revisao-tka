// Helpers de interface: criação de elementos, chips, modais, toasts e estado da sessão.

export const app = {
  sessao: null,
  podeEditar: () => app.sessao?.papel === 'registro',
  ir: (hash) => { location.hash = hash; },
};

export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

const ICONES = {
  hoje: '<path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><path d="m9 15 2 2 4-4"/>',
  planejar: '<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
  parque: '<path d="M3 16V8h11v8M14 11h4l3 3v2h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  garantias: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="M12 8v5M12 16h.01"/>',
  relatorios: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  galeria: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  mapa: '<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
};

export function icone(nome) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONES[nome] || '';
  return s;
}

export const placa = (texto, grande = false) =>
  h('span', { class: 'placa' + (grande ? ' grande' : ''), 'aria-label': 'Placa ' + texto }, h('span', {}, texto));

// opcoes: [{v, t, cor?}] ou strings. onChange recebe o valor (ou '' ao desmarcar, se permitirVazio).
export function chips(opcoes, valor, onChange, { permitirVazio = false, desabilitado = false } = {}) {
  const lista = opcoes.map((o) => (typeof o === 'string' ? { v: o, t: o } : o));
  const box = h('div', { class: 'chips', role: 'group' });
  let atual = valor;
  const botoes = lista.map((o) => h('button', {
    type: 'button', class: 'chip ' + (o.cor || ''), 'aria-pressed': String(o.v === atual), disabled: desabilitado,
    onclick: () => {
      atual = atual === o.v && permitirVazio ? '' : o.v;
      botoes.forEach((b, i) => b.setAttribute('aria-pressed', String(lista[i].v === atual)));
      onChange(atual);
    },
  }, o.t));
  box.append(...botoes);
  return box;
}

export function campo(rotulo, controle, ajuda) {
  return h('label', { class: 'campo' }, h('span', {}, rotulo), controle, ajuda ? h('small', {}, ajuda) : null);
}

let toastAtual = null;
export function toast(msg, tipo = '', { acao, ms = 3500 } = {}) {
  toastAtual?.remove();
  const el = h('div', { class: 'toast ' + tipo, role: 'status', onclick: () => { acao?.(); el.remove(); } }, msg);
  document.body.append(el);
  toastAtual = el;
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}

export function modal(titulo, conteudo, botoes) {
  return new Promise((ok) => {
    const fundo = h('div', { class: 'modal-fundo', onclick: (e) => { if (e.target === fundo) fechar(null); } });
    const fechar = (v) => { fundo.remove(); ok(v); };
    const caixa = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('h2', {}, titulo), conteudo,
      h('div', { class: 'acoes', style: 'margin-top:16px' },
        botoes.map((b) => h('button', { type: 'button', class: 'btn ' + (b.classe || ''), onclick: () => fechar(b.valor?.()) }, b.t))));
    fundo.append(caixa);
    document.body.append(fundo);
    caixa.querySelector('input,textarea,select')?.focus();
  });
}

export const confirmar = (msg, { ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = {}) =>
  modal(msg, null, [
    { t: cancelar, classe: 'claro', valor: () => false },
    { t: ok, classe: perigo ? 'perigo' : '', valor: () => true },
  ]).then((v) => v === true);

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.agora = (...a) => { clearTimeout(t); return fn(...a); };
  return d;
}

export function dataBR(iso, comHora = false) {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d)) return String(iso);
  const opt = { day: '2-digit', month: '2-digit' };
  if (comHora) Object.assign(opt, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('pt-BR', opt);
}

export function diaSemana(isoData) {
  return new Date(isoData + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export const cabecalho = (titulo, sub, voltar) => h('header', { class: 'cab-tela' },
  voltar ? h('a', { class: 'voltar', href: voltar }, '‹ Voltar') : null,
  h('h1', {}, titulo), sub ? h('p', {}, sub) : null);

export const vazio = (titulo, texto, ...acoes) => h('div', { class: 'vazio' }, h('strong', {}, titulo), texto ? h('p', {}, texto) : null, ...acoes);

// replaceChildren ignorando nulos/false (evita "null" na tela).
export function montar(el, ...filhos) {
  el.replaceChildren(...filhos.flat(Infinity).filter((f) => f !== null && f !== undefined && f !== false));
  return el;
}
