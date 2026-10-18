// Ficha da visita: status, leituras, série, equipe, ocorrências, mídias, treinamento e conclusão.
import * as db from '../db.js';
import {
  STATUS, PAPEIS, GRAVIDADES, SITUACOES, CAUSAS, TAREFAS_PROVA, RESULTADOS_PROVA, DOMINIOS, parseNumeroBR, alertaKm,
  formatarNumero, novaOcorrencia, novoMembro, alteracoesCadastro, hojeLocal, verdadeiro, uuid, primeiroValor,
  dominioOperacao, provaIniciada,
} from '../modelo.js';
import { app, montar, h, chips, campo, toast, modal, confirmar, placa, dataBR, icone } from '../ui.js';
import { autosave, ativos, galeria, botoesMidia, buscaPessoa, rotulo, mensagemConsulta } from './comum.js';

export async function render(el, { id }) {
  const v = await db.get('Visitas', id);
  if (!v) {
    montar(el, h('div', { class: 'vazio' }, h('strong', {}, 'Visita não encontrada'), h('a', { class: 'btn', href: '#/hoje' }, 'Ir para Hoje')));
    return;
  }
  const eq = (await db.get('Equipamentos', v.placa)) || { id: v.placa, cod_placa: v.placa };
  const edita = app.podeEditar();
  const vis = autosave('Visitas', v);
  const set = vis.set;

  if (!v.serie_munck && eq.serie_munck) set('serie_munck', eq.serie_munck);
  if (!v.engenheiro) {
    const eng = await db.meta('ultimo_engenheiro');
    if (eng) set('engenheiro', eng);
  }

  // Cabeçalho
  const quando = v.inicio ? dataBR(v.inicio, true) : '';
  const gps = v.lat ? `GPS ${Number(v.lat).toFixed(4)}, ${Number(v.lng).toFixed(4)}` : 'GPS não capturado';
  const cab = h('header', { class: 'cab-tela' },
    h('a', { class: 'voltar', href: `#/equipamento/${encodeURIComponent(v.placa)}` }, '‹ Ficha do equipamento'),
    h('div', { style: 'display:flex;gap:12px;align-items:center' }, placa(v.placa, true),
      h('div', {}, h('h1', { style: 'font-size:20px' }, verdadeiro(v.concluida) ? 'Visita concluída' : 'Visita em andamento'),
        h('p', {}, `${quando} · ${gps}`))),
    h('p', {}, `${eq.marca_modelo || ''} · ${eq.status_veiculo || ''}`));

  // Status
  const blocoStatus = h('section', { class: 'bloco' }, h('h2', {}, 'Status do equipamento'),
    chips(STATUS, vis.dados.status, (x) => set('status', x), { desabilitado: !edita }));

  // Leituras
  const kmBase = primeiroValor(eq.km_atual_campo, eq.km_atual);
  const avisoKm = h('small', { class: 'aviso', hidden: true });
  const km = h('input', { type: 'text', inputmode: 'decimal', value: formatarNumero(vis.dados.km), disabled: !edita });
  const verificarKm = () => {
    const n = parseNumeroBR(km.value);
    set('km', n);
    const a = alertaKm(n, kmBase);
    avisoKm.hidden = !a;
    avisoKm.textContent = a || '';
  };
  km.addEventListener('input', verificarKm);
  km.addEventListener('blur', () => { if (vis.dados.km != null) km.value = formatarNumero(vis.dados.km); });
  const hor = h('input', { type: 'text', inputmode: 'decimal', value: formatarNumero(vis.dados.horimetro), disabled: !edita,
    oninput: (e) => set('horimetro', parseNumeroBR(e.target.value)) });
  const serie = h('input', { type: 'text', value: vis.dados.serie_munck || '', autocapitalize: 'characters', disabled: !edita,
    oninput: (e) => set('serie_munck', e.target.value.trim()) });
  const eng = h('input', { type: 'text', value: vis.dados.engenheiro || '', disabled: !edita,
    oninput: (e) => { set('engenheiro', e.target.value); db.setMeta('ultimo_engenheiro', e.target.value); } });
  const kmCampo = campo('KM', km, kmBase != null ? `Último registrado: ${formatarNumero(kmBase)}` : 'Sem KM na base');
  kmCampo.append(avisoKm);
  const blocoLeituras = h('section', { class: 'bloco' }, h('h2', {}, 'Leituras'),
    h('div', { class: 'duas' }, kmCampo,
      campo('Horímetro do Munck', hor, eq.horimetro_atual != null && eq.horimetro_atual !== '' ? `Último: ${formatarNumero(eq.horimetro_atual)} h` : 'Primeira leitura')),
    campo('Nº de série do Munck', serie, eq.serie_munck ? null : 'Ainda não registrado para esta placa'),
    campo('Engenheiro TKA presente', eng));

  // Equipe
  const blocoEquipe = h('section', { class: 'bloco' });
  let papelNovo = 'motorista_operador';
  const adicionar = async (pessoa) => {
    const m = novoMembro(vis.dados, pessoa, papelNovo);
    await db.salvar('Equipe', m, { autor: app.sessao.autor });
    desenharEquipe();
  };
  const avulso = async () => {
    const nome = h('input', { type: 'text' });
    const mat = h('input', { type: 'text', inputmode: 'numeric' });
    const cargo = h('input', { type: 'text', placeholder: 'Ex.: Técnico de segurança, gestor, terceiro' });
    const ok = await modal('Pessoa sem cadastro', h('div', {}, campo('Nome', nome), campo('Matrícula (se souber)', mat), campo('Cargo ou função', cargo)), [
      { t: 'Cancelar', classe: 'claro', valor: () => false }, { t: 'Adicionar', valor: () => true }]);
    if (ok && nome.value.trim()) adicionar({ nome: nome.value, matricula: mat.value, funcao: cargo.value });
  };
  async function desenharEquipe() {
    const membros = ativos(await db.por('Equipe', 'visita_id', id));
    const itens = membros.map((m) => h('div', { class: 'membro' },
      h('div', { class: 'info' }, h('strong', {}, m.nome), h('small', { style: 'display:block;color:var(--tinta-suave)' },
        [rotulo(PAPEIS, m.papel), m.funcao, m.matricula ? 'matrícula ' + m.matricula : '', verdadeiro(m.avulso) ? 'sem cadastro' : ''].filter(Boolean).join(' · '))),
      edita ? h('button', { type: 'button', class: 'remover', onclick: async () => {
        if (await confirmar(`Remover ${m.nome} da equipe?`, { ok: 'Remover', perigo: true })) {
          await db.salvar('Equipe', { ...m, removido: true }, { autor: app.sessao.autor });
          desenharEquipe();
        }
      } }, 'Remover') : null));
    let sugestao = null;
    if (!membros.length && edita) {
      const anteriores = ativos(await db.por('Visitas', 'placa', v.placa)).filter((x) => x.id !== id).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
      const ult = anteriores[0] ? ativos(await db.por('Equipe', 'visita_id', anteriores[0].id)) : [];
      if (ult.length) {
        sugestao = h('button', { type: 'button', class: 'btn claro bloco-largo btn-p', style: 'margin-bottom:10px', onclick: async () => {
          for (const m of ult) await db.salvar('Equipe', { ...m, id: uuid(), visita_id: id, removido: false }, { autor: app.sessao.autor });
          desenharEquipe();
        } }, `Repetir equipe da última visita (${ult.map((m) => m.nome.split(' ')[0]).join(', ')})`);
      }
    }
    montar(blocoEquipe, 
      h('h2', {}, 'Equipe ', h('span', { class: 'contagem' }, `(${membros.length})`)),
      ...(itens.length ? itens : [h('p', { style: 'color:var(--tinta-suave);margin:0 0 8px' }, 'Quem estava com o equipamento: motorista e operador, encarregado, eletricistas, SESMT ou outras pessoas presentes.')]),
      edita ? h('div', { style: 'margin-top:12px' }, sugestao,
        h('div', { class: 'campo' }, h('span', {}, 'Adicionar como'), chips(PAPEIS, papelNovo, (x) => { papelNovo = x; })),
        buscaPessoa(adicionar),
        h('button', { type: 'button', class: 'btn claro btn-p', style: 'margin-top:8px', onclick: avulso }, 'Adicionar pessoa sem cadastro')) : null);
    desenharProva(membros);
  }

  // Prova prática: o operador demonstra cada tarefa; o domínio sai das respostas.
  const blocoProva = h('section', { class: 'bloco' });
  const COR_DOMINIO = { adequado: 'verde', parcial: 'amarelo', insuficiente: 'vermelho' };
  function desenharProva(membros = []) {
    const d = vis.dados;
    const selo = h('p', { class: 'selo-dominio' });
    const atualizarSelo = () => {
      const dom = dominioOperacao(vis.dados);
      selo.className = 'selo-dominio ' + (COR_DOMINIO[dom] || '');
      selo.textContent = dom ? `Resultado: ${rotulo(DOMINIOS, dom)}` : '';
    };
    const marcar = (k, r) => {
      set(k, r);
      set('dominio_operacao', dominioOperacao(vis.dados));
      atualizarSelo();
    };
    if (!provaIniciada(d)) {
      montar(blocoProva, h('h2', {}, 'Prova prática de operação'),
        h('p', { style: 'color:var(--tinta-suave);margin:0 0 10px' },
          'O operador demonstra 6 tarefas na sua frente. Começa tudo como "Executou"; mude só o que ele não fizer sozinho.'),
        edita ? h('button', { type: 'button', class: 'btn sec bloco-largo', onclick: () => {
          for (const t of TAREFAS_PROVA) set(t.k, 'executou');
          const op = membros.find((m) => ['motorista_operador', 'operador'].includes(m.papel));
          if (op && !vis.dados.prova_operador) set('prova_operador', op.nome);
          set('dominio_operacao', dominioOperacao(vis.dados));
          desenharProva(membros);
        } }, 'Iniciar prova prática') : null);
      return;
    }
    const nomes = [...new Set([d.prova_operador, ...membros.map((m) => m.nome)].filter(Boolean))];
    const operador = h('select', { disabled: !edita, onchange: (e) => set('prova_operador', e.target.value) },
      h('option', { value: '' }, 'Escolha quem fez a prova'),
      nomes.map((n) => h('option', { value: n, selected: n === d.prova_operador }, n)));
    montar(blocoProva, h('h2', {}, 'Prova prática de operação'),
      campo('Operador avaliado', operador, membros.length ? null : 'Adicione a pessoa na equipe acima para escolher aqui.'),
      ...TAREFAS_PROVA.map((t) => h('div', { class: 'campo tarefa-prova' }, h('span', {}, t.t),
        chips(RESULTADOS_PROVA, d[t.k], (r) => marcar(t.k, r || 'executou'), { desabilitado: !edita }))),
      selo);
    atualizarSelo();
  }

  // Ocorrências
  const blocoOcorr = h('section', { class: 'bloco' });
  async function desenharOcorrencias() {
    const lista = ativos(await db.por('Ocorrencias', 'visita_id', id));
    const midias = ativos(await db.por('Midias', 'visita_id', id));
    const cartoes = lista.map((o) => {
      const n = midias.filter((m) => m.ocorrencia_id === o.id).length;
      return h('a', { class: 'ocorrencia', href: `#/ocorrencia/${o.id}` },
        o.gravidade ? h('span', { class: 'gravidade ' + o.gravidade }, rotulo(GRAVIDADES, o.gravidade)) : null, ' ',
        h('strong', {}, o.tipo || 'Ocorrência sem tipo'), o.componente ? ` · ${o.componente}` : '',
        h('div', { style: 'font-size:14px;color:var(--tinta-suave)' },
          [rotulo(CAUSAS, o.causa), rotulo(SITUACOES, o.situacao) || 'Situação não informada', o.protocolo ? `protocolo ${o.protocolo}` : '', n ? `${n} arquivo(s)` : ''].filter(Boolean).join(' · ')));
    });
    montar(blocoOcorr, 
      h('h2', {}, 'Ocorrências ', h('span', { class: 'contagem' }, `(${lista.length})`)),
      ...(cartoes.length ? cartoes : [h('p', { style: 'color:var(--tinta-suave);margin:0 0 8px' }, 'Nenhum defeito registrado nesta visita.')]),
      edita ? h('button', { type: 'button', class: 'btn sec bloco-largo', style: 'margin-top:6px', onclick: async () => {
        vis.flush();
        const o = novaOcorrencia(vis.dados);
        o.abertura = hojeLocal();
        await db.salvar('Ocorrencias', o, { autor: app.sessao.autor });
        app.ir(`#/ocorrencia/${o.id}`);
      } }, icone('mais'), 'Registrar ocorrência') : null);
  }

  // Mídia geral
  const blocoMidia = h('section', { class: 'bloco' });
  async function desenharMidia() {
    const midias = ativos(await db.por('Midias', 'visita_id', id)).filter((m) => !m.ocorrencia_id && m.tipo !== 'assinatura');
    montar(blocoMidia, h('h2', {}, 'Fotos e vídeos da operação ', h('span', { class: 'contagem' }, `(${midias.length})`)),
      edita ? botoesMidia({ placa: v.placa, visitaId: id }, desenharMidia) : null,
      await galeria(midias));
  }

  // Treinamentos
  const blocoTrein = h('details', { class: 'secao' });
  async function desenharTreinamentos() {
    const lista = ativos(await db.por('Treinamentos', 'visita_id', id));
    blocoTrein.open = lista.length > 0;
    montar(blocoTrein, h('summary', {}, `Treinamento no local${lista.length ? ` (${lista.length})` : ''}`),
      h('div', { class: 'conteudo' },
        ...lista.map((t) => h('a', { class: 'ocorrencia', style: 'border-left-color:var(--petroleo)', href: `#/treinamento/${t.id}` },
          h('strong', {}, t.assunto || 'Treinamento'), h('div', { style: 'font-size:14px;color:var(--tinta-suave)' }, `${t.ministrante || ''}${t.duracao_min ? ' · ' + t.duracao_min + ' min' : ''}`))),
        edita ? h('button', { type: 'button', class: 'btn claro bloco-largo', onclick: async () => {
          const t = { id: uuid(), visita_id: id, assunto: '', ministrante: vis.dados.engenheiro || '', duracao_min: null, observacoes: '' };
          await db.salvar('Treinamentos', t, { autor: app.sessao.autor });
          app.ir(`#/treinamento/${t.id}`);
        } }, 'Registrar treinamento') : null));
  }

  const obs = h('textarea', { disabled: !edita, oninput: (e) => set('observacoes', e.target.value) }, vis.dados.observacoes || '');

  const concluir = h('button', { type: 'button', class: 'btn bloco-largo', onclick: async () => {
    if (!vis.dados.status) { toast('Escolha o status do equipamento antes de concluir.', 'erro'); blocoStatus.scrollIntoView({ behavior: 'smooth' }); return; }
    if (vis.dados.km == null && !(await confirmar('KM não informado. Concluir mesmo assim?', { ok: 'Concluir' }))) return;
    const autor = app.sessao.autor;
    vis.set('concluida', true);
    if (!vis.dados.fim) vis.set('fim', new Date().toISOString());
    await vis.flush();
    const roteiro = await db.por('Roteiro', 'placa', v.placa);
    for (const r of roteiro.filter((r) => r.data === hojeLocal() && r.situacao === 'planejada')) {
      await db.salvar('Roteiro', { ...r, situacao: 'visitada' }, { autor });
    }
    const eqNovo = { ...eq };
    if (vis.dados.km != null) eqNovo.km_atual_campo = vis.dados.km;
    if (vis.dados.horimetro != null) eqNovo.horimetro_atual = vis.dados.horimetro;
    if (vis.dados.serie_munck && vis.dados.serie_munck !== eq.serie_munck) {
      eqNovo.serie_munck = vis.dados.serie_munck;
      for (const a of alteracoesCadastro({ id: eq.id, cod_placa: eq.cod_placa, serie_munck: eq.serie_munck }, { serie_munck: vis.dados.serie_munck }, autor)) {
        await db.salvar('Alteracoes', a, { autor });
      }
    }
    await db.salvar('Equipamentos', eqNovo, { autor });
    toast('Visita concluída.', 'ok');
    app.ir('#/hoje');
  } }, verdadeiro(v.concluida) ? 'Salvar e voltar' : 'Concluir visita');

  montar(el, cab, mensagemConsulta(), blocoStatus, blocoLeituras, blocoEquipe, blocoProva, blocoOcorr, blocoMidia, blocoTrein,
    h('section', { class: 'bloco' }, campo('Observações gerais', obs)),
    edita ? concluir : null);
  if (vis.dados.km != null) verificarKm();
  await Promise.all([desenharEquipe(), desenharOcorrencias(), desenharMidia(), desenharTreinamentos()]);
}
