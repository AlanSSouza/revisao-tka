// Tela de entrada: nome + senha, primeiro download da base, orientação de instalação no iPhone.
import * as db from '../db.js';
import * as sync from '../sync.js';
import { entrar, ErroAuth, ErroRede } from '../api.js';
import { app, montar, h, campo } from '../ui.js';

const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export async function render(raiz) {
  const ultimoNome = (await db.meta('ultimo_nome')) || '';
  const nome = h('input', { type: 'text', name: 'nome', autocomplete: 'name', value: ultimoNome, required: true, enterkeyhint: 'next' });
  const senha = h('input', { type: 'password', name: 'senha', autocomplete: 'current-password', required: true, enterkeyhint: 'go' });
  const erro = h('p', { class: 'erro-form', role: 'alert', hidden: true });
  const botao = h('button', { class: 'btn bloco-largo', type: 'submit' }, 'Entrar');

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      erro.hidden = true;
      botao.disabled = true;
      botao.textContent = 'Entrando…';
      const autor = nome.value.trim();
      try {
        const r = await entrar(autor, senha.value);
        app.sessao = { autor, senha: senha.value, papel: r.papel };
        await db.setMeta('sessao', app.sessao);
        await db.setMeta('ultimo_nome', autor);
        botao.textContent = 'Baixando a base de equipamentos…';
        await sync.sincronizar();
        sync.agendar();
        app.ir('#/hoje');
      } catch (ex) {
        erro.textContent = ex instanceof ErroAuth
          ? 'Senha incorreta. Confira a senha com o responsável pelo app.'
          : ex instanceof ErroRede
            ? 'Sem conexão. O primeiro acesso precisa de internet para baixar a base; depois o app funciona sem sinal.'
            : 'Não foi possível entrar: ' + ex.message;
        erro.hidden = false;
        botao.disabled = false;
        botao.textContent = 'Entrar';
      }
    },
  },
  campo('Seu nome', nome, 'Aparece como autor de cada registro.'),
  campo('Senha de acesso', senha),
  erro, botao);

  const dicaInstalar = ehIOS() && !instalado()
    ? h('div', { class: 'instalar' }, h('strong', {}, 'Instale na tela de início. '),
      'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". Assim o app abre sem internet e guarda as fotos com segurança.')
    : null;

  montar(raiz, h('div', { class: 'entrada' },
    h('div', { class: 'corpo' },
      h('img', { class: 'logo', src: 'assets/logo.png', alt: 'Mariuá Construção e Energia' }),
      h('h1', {}, 'Revisão Guindautos TKA'),
      h('p', { class: 'sub' }, 'Controle de visitas técnicas ao parque de Munck TKA'),
      form, dicaInstalar),
    h('footer', { class: 'rodape' },
      h('small', {}, 'Frota e Manutenção'),
      h('img', { src: 'assets/gptw.png', alt: 'Great Place to Work – Certificada 2026 Brasil' }))));
  if (!ultimoNome) nome.focus();
}
