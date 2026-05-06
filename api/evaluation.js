const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID ausente' });

  if (req.method === 'GET') {
    const { data: ev, error: evError } = await supabase.from('evaluations').select('*').eq('id', id).single();
    if (evError || !ev) return res.status(404).json({ error: 'Não encontrado' });

    const { data: members } = await supabase.from('member_evaluations').select('*').eq('evaluation_id', id);
    const { data: leader } = await supabase.from('leader_evaluations').select('*').eq('evaluation_id', id).single();

    return res.status(200).json({ ...ev, members: members || [], leaderEval: leader });
  }

  if (req.method === 'DELETE') {
    // Supabase cascade deletes member_evaluations and leader_evaluations automatically 
    // since we defined ON DELETE CASCADE in the schema.
    const { error } = await supabase.from('evaluations').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
