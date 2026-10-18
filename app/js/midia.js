// Captura de fotos/vídeos pela câmera ou galeria, compressão de fotos e gravação local.
import * as db from './db.js';
import { uuid } from './modelo.js';

const LADO_MAX = 1600;
const QUALIDADE = 0.8;
const VIDEO_SEG_MAX = 60;
const VIDEO_BYTES_MAX = 80 * 1024 * 1024;

export function dimensoesAlvo(w, h, max = LADO_MAX) {
  const maior = Math.max(w, h);
  if (maior <= max) return { w, h };
  const f = max / maior;
  return { w: Math.round(w * f), h: Math.round(h * f) };
}

export function avisoVideo({ duracao, tamanho }) {
  const partes = [];
  if (duracao > VIDEO_SEG_MAX) partes.push(`${Math.round(duracao)} s`);
  if (tamanho > VIDEO_BYTES_MAX) partes.push(`${Math.round(tamanho / 1024 / 1024)} MB`);
  if (!partes.length) return null;
  return `Vídeo grande (${partes.join(', ')}). Ele foi salvo, mas vai demorar para enviar — prefira vídeos de até 1 minuto.`;
}

export function nomeArquivo(tipo, id, ext, d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${tipo}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${id.slice(0, 8)}.${ext}`;
}

function carregarImagem(file) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('imagem inválida')); };
    img.src = url;
  });
}

export async function comprimirFoto(file) {
  try {
    const img = await carregarImagem(file);
    const { w, h } = dimensoesAlvo(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function lerDuracaoVideo(file) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); ok(0); };
    v.src = url;
  });
}

function escolherArquivos({ tipo, origem }) {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = tipo === 'video' ? 'video/*' : tipo === 'foto' ? 'image/*' : 'image/*,video/*';
    if (origem === 'camera') input.capture = 'environment';
    else input.multiple = true;
    input.style.display = 'none';
    input.onchange = () => { ok([...input.files]); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}

const extensao = (file, padrao) => {
  const m = /\.([a-z0-9]{2,4})$/i.exec(file.name || '');
  if (m) return m[1].toLowerCase();
  if (file.type === 'video/quicktime') return 'mov';
  if (file.type === 'video/mp4') return 'mp4';
  return padrao;
};

async function registrar(file, ctx) {
  const ehVideo = file.type.startsWith('video/');
  const id = uuid();
  let blob = file;
  let aviso = null;
  if (ehVideo) {
    aviso = avisoVideo({ duracao: await lerDuracaoVideo(file), tamanho: file.size });
  } else {
    blob = await comprimirFoto(file);
  }
  const tipo = ehVideo ? 'video' : ctx.tipoFixo || 'foto';
  const ext = ehVideo ? extensao(file, 'mp4') : blob === file ? extensao(file, 'jpg') : 'jpg';
  const midia = {
    id, visita_id: ctx.visitaId || '', ocorrencia_id: ctx.ocorrenciaId || '', placa: ctx.placa, tipo,
    legenda: ctx.legenda || '', nome_arquivo: nomeArquivo(tipo, id, ext),
    mime: blob.type || file.type || 'application/octet-stream', tamanho: blob.size,
    drive_id: '', link: '', criado_em: new Date().toISOString(), enviado_em: '',
  };
  const salvo = await db.salvarComBlob('Midias', midia, blob, { autor: ctx.autor });
  return { midia: salvo, aviso };
}

// Abre câmera/galeria e grava cada arquivo escolhido. Retorna [{midia, aviso}].
export async function capturar({ tipo, origem = 'camera', ...ctx }) {
  const arquivos = await escolherArquivos({ tipo, origem });
  const out = [];
  for (const f of arquivos) out.push(await registrar(f, ctx));
  return out;
}

// Grava um blob já pronto (ex.: assinatura desenhada na tela).
export async function salvarBlobComoMidia(blob, ctx) {
  const file = new File([blob], 'assinatura.png', { type: 'image/png' });
  return (await registrar(file, { ...ctx, tipoFixo: 'assinatura' })).midia;
}

// URL para exibir a mídia: blob local enquanto pendente, miniatura do Drive depois.
export async function urlMiniatura(midia) {
  if (midia.drive_id) return `https://drive.google.com/thumbnail?id=${midia.drive_id}&sz=w400`;
  const b = await db.blob(midia.id);
  return b ? URL.createObjectURL(b.blob) : '';
}
