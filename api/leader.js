const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Support taking evalId from query or body
  const evalId = req.query.id || req.body.evaluation_id;
  const d = req.body;

  if (!evalId) return res.status(400).json({ error: 'ID da avaliação não fornecido.' });

  const { error } = await supabase.from('leader_evaluations').insert([{
    evaluation_id: parseInt(evalId),
    responsabilidade: d.responsabilidade,
    responsabilidade_obs: d.responsabilidade_obs || '',
    espirito_equipe: d.espirito_equipe,
    espirito_equipe_obs: d.espirito_equipe_obs || '',
    orientacao_professor: d.orientacao_professor,
    orientacao_professor_obs: d.orientacao_professor_obs || '',
    iniciativa: d.iniciativa,
    iniciativa_obs: d.iniciativa_obs || '',
    educacao: d.educacao,
    educacao_obs: d.educacao_obs || ''
  }]);

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
