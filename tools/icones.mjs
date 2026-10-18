// Gera os ícones do app a partir do símbolo do logo Mariuá (parte esquerda da imagem).
import sharp from 'sharp';
const simbolo = await sharp('app/assets/logo.png').extract({ left: 40, top: 40, width: 860, height: 860 }).png().toBuffer();
for (const [nome, lado] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const interno = Math.round(lado * 0.72);
  const s = await sharp(simbolo).resize(interno, interno, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: '#ffffff' } })
    .composite([{ input: s, gravity: 'center' }]).png().toFile('app/assets/' + nome);
}
console.log('ok');
