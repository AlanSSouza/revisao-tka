// Treinamento rápido no local: assunto, ministrante, duração, participantes e assinatura opcional.
import * as db from '../db.js';
import { ASSUNTOS_TREINAMENTO, parseNumeroBR, uuid } from '../modelo.js';
import { app, montar, h, chips, campo, toast, modal, confirmar } from '../ui.js';
import { salvarBlobComoMidia } from '../midia.js';
import { autosave, ativos, buscaPessoa, mensagemConsulta } from './comum.js';

function quadroAssinatura() {
  const canvas = h('canvas', { class: 'assinatura', 'aria-label': 'Área para assinar com o dedo' });
  let desenhou = false;
  let ctx;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    if (!ctx) {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      ctx = canvas.getContext('2d');
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#16302F';
    }
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.moveTo(...pos(e));
    desenhou = true;
  });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons && ctx) { ctx.lineTo(...pos(e)); ctx.stroke(); } });
  return { canvas, vazio: () => !desenhou, blob: () => new Promise((ok) => canvas.toBlob(ok, 'image/png')) };
}

export async function render(el, { id }) {
  const t = await db.get('Treinamentos', id);
  if (!t) {
    montar(el, h('div', { class: 'vazio' }, h('strong', {}, 'Treinamento não encontrado'), h('a', { class: 'btn', href: '#/hoje' }, 'Ir para Hoje')));
    return;
  }
  const visita = await db.get('Visitas', t.visita_id);
  const edita = app.podeEditar();
  const tr = autosave('Treinamentos', t);
  const autor = app.sessao.autor;
  const voltar = `#/visita/${t.visita_id}`;

  const ehPadrao = ASSUNTOS_TREINAMENTO.includes(t.assunto) && t.assunto !== 'Outro';
  const outroAssunto = h('input', { type: 'text', placeholder: 'Qual assunto?', value: ehPadrao ? '' : t.assunto || '', disabled: !edita,
    hidden: ehPadrao || !t.assunto, oninput: (e) => tr.set('assunto', e.target.value) });
  const assunto = chips(ASSUNTOS_TREINAMENTO, ehPadrao ? t.assunto : t.assunto ? 'Outro' : '', (x) => {
    outroAssunto.hidden = x !== 'Outro';
    tr.set('assunto', x === 'Outro' ? outroAssunto.value : x);
    if (x === 'Outro') outroAssunto.focus();
  }, { desabilitado: !edita });

  const ministrante = h('input', { type: 'text', value: t.ministrante || '', disabled: !edita, oninput: (e) => tr.set('ministrante', e.target.value) });
  const duracao = h('input', { type: 'text', inputmode: 'numeric', value: t.duracao_min ?? '', disabled: !edita, oninput: (e) => tr.set('duracao_min', parseNumeroBR(e.target.value)) });
  const obs = h('textarea', { disabled: !edita, oninput: (e) => tr.set('observacoes', e.target.value) }, t.observacoes || '');

  const blocoPart = h('section', { class: 'bloco' });
  const incluir = async (p) => {
    const atuais = ativos(await db.por('TreinamentoParticipantes', 'treinamento_id', id));
    if (atuais.some((a) => a.matricula && a.matricula === String(p.matricula))) return toast(`${p.nome} já está na lista.`);
    await db.salvar('TreinamentoParticipantes', { id: uuid(), treinamento_id: id, matricula: String(p.matricula || ''), nome: p.nome, assinatura_midia_id: '' }, { autor });
    desenharParticipantes();
  };
  const assinar = async (p) => {
    const q = quadroAssinatura();
    const ok = await modal(`Assinatura de ${p.nome}`, q.canvas, [
      { t: 'Cancelar', classe: 'claro', valor: () => false }, { t: 'Salvar assinatura', valor: () => true }]);
    if (!ok || q.vazio()) return;
    const m = await salvarBlobComoMidia(await q.blob(), { placa: visita?.placa || '', visitaId: t.visita_id, legenda: `Assinatura ${p.nome}`, autor });
    await db.salvar('TreinamentoParticipantes', { ...p, assinatura_midia_id: m.id }, { autor });
    toast('Assinatura salva.', 'ok');
    desenharParticipantes();
  };
  async function desenharParticipantes() {
    const lista = ativos(await db.por('TreinamentoParticipantes', 'treinamento_id', id));
    const equipe = ativos(await db.por('Equipe', 'visita_id', t.visita_id))
      .filter((m) => !lista.some((p) => (m.matricula && p.matricula === m.matricula) || p.nome === m.nome));
    montar(blocoPart, 
      h('h2', {}, 'Participantes ', h('span', { class: 'contagem' }, `(${lista.length})`)),
      ...lista.map((p) => h('div', { class: 'membro' },
        h('div', { class: 'info' }, h('strong', {}, p.nome), h('small', { style: 'display:block;color:var(--tinta-suave)' },
          `${p.matricula ? 'Matrícula ' + p.matricula + ' · ' : ''}${p.assinatura_midia_id ? 'assinado' : 'sem assinatura'}`)),
        edita && !p.assinatura_midia_id ? h('button', { type: 'button', class: 'btn claro btn-p', onclick: () => assinar(p) }, 'Assinar') : null,
        edita ? h('button', { type: 'button', class: 'remover', onclick: async () => {
          if (await confirmar(`Tirar ${p.nome} da lista?`, { ok: 'Tirar', perigo: true })) {
            await db.salvar('TreinamentoParticipantes', { ...p, removido: true }, { autor });
            desenharParticipantes();
          }
        } }, 'Tirar') : null)),
      edita && equipe.length ? h('div', { class: 'acoes', style: 'margin:10px 0' },
        equipe.map((m) => h('button', { type: 'button', class: 'btn claro btn-p', onclick: () => incluir(m) }, `+ ${m.nome.split(' ')[0]} (equipe)`))) : null,
      edita ? h('div', { style: 'margin-top:8px' }, buscaPessoa(incluir, { placeholder: 'Incluir outra pessoa: nome ou matrícula' })) : null);
  }

  montar(el, 
    h('header', { class: 'cab-tela' }, h('a', { class: 'voltar', href: voltar }, '‹ Voltar para a visita'), h('h1', {}, 'Treinamento no local'),
      visita ? h('p', {}, `Placa ${visita.placa}`) : null),
    mensagemConsulta(),
    h('section', { class: 'bloco' }, h('h2', {}, 'Assunto'), assunto, h('div', { style: 'height:10px' }), outroAssunto),
    h('section', { class: 'bloco' }, h('div', { class: 'duas' }, campo('Ministrado por', ministrante), campo('Duração (min)', duracao)),
      campo('Observações', obs)),
    blocoPart,
    edita ? h('button', { type: 'button', class: 'btn bloco-largo', onclick: async () => {
      if (!tr.dados.assunto) return toast('Informe o assunto do treinamento.', 'erro');
      await tr.flush();
      toast('Treinamento salvo.', 'ok');
      app.ir(voltar);
    } }, 'Salvar treinamento') : null);
  await desenharParticipantes();
}
