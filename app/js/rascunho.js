// Rascunho com salvamento automático: só grava quando há alteração e nunca no acesso de consulta.
export function criarRascunho(registro, { salvar, ms = 800, ativo = true }) {
  const r = { dados: { ...registro } };
  let sujo = false;
  let timer = null;
  r.flush = async () => {
    clearTimeout(timer);
    if (!sujo || !ativo) return;
    sujo = false;
    await salvar({ ...r.dados });
  };
  r.set = (campo, valor) => {
    if (r.dados[campo] === valor) return;
    r.dados[campo] = valor;
    if (!ativo) return;
    sujo = true;
    clearTimeout(timer);
    timer = setTimeout(r.flush, ms);
  };
  // Registro excluído: descarta o pendente para o salvamento automático não desfazer a exclusão.
  r.cancelar = () => {
    clearTimeout(timer);
    sujo = false;
    ativo = false;
  };
  return r;
}
