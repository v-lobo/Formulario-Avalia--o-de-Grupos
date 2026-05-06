const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Support taking evalId from query (standard) or body
  const evalId = req.query.id || req.body.evaluation_id;
  const { members } = req.body;

  if (!evalId) return res.status(400).json({ error: 'ID da avaliação não fornecido.' });
  if (!members || !members.length) return res.status(400).json({ error: 'Nenhum integrante.' });

  const inserts = members.map(m => ({
    evaluation_id: parseInt(evalId),
    member_name: m.member_name,
    responsabilidade: m.responsabilidade,
    responsabilidade_obs: m.responsabilidade_obs || '',
    relacionamento: m.relacionamento,
    relacionamento_obs: m.relacionamento_obs || '',
    cooperacao: m.cooperacao,
    cooperacao_obs: m.cooperacao_obs || '',
    organizacao: m.organizacao,
    organizacao_obs: m.organizacao_obs || '',
    educacao: m.educacao,
    educacao_obs: m.educacao_obs || ''
  }));

  const { error } = await supabase.from('member_evaluations').insert(inserts);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
