const txt = (v) => String(v ?? '').trim();

export function linhasParaEquipamentos(linhas) {
  return linhas.map((l) => {
    const km = l.km_atual === '' || l.km_atual == null ? null : Number(l.km_atual);
    return {
      ...l,
      id: txt(l.cod_placa),
      cod_placa: txt(l.cod_placa),
      km_atual: Number.isFinite(km) ? km : null,
      serie_munck: '',
      horimetro_atual: null,
      km_atual_campo: null,
      local_previsto: '',
    };
  });
}

const demitido = (v) => txt(v).replace(/[\s/]/g, '') !== '';

export function linhasParaFuncionarios(linhas) {
  return linhas
    .filter((l) => !demitido(l['Dt. Demissao']) && txt(l.Matricula))
    .map((l) => ({
      id: txt(l.Matricula),
      matricula: txt(l.Matricula),
      nome: txt(l.Nome),
      funcao: txt(l['Desc.Funcao']),
      centro_custo: txt(l['Centro Custo']),
      filial: txt(l.Filial),
    }));
}
