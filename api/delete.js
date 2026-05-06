const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'ID da avaliação é obrigatório' });
  }

  try {
    // Delete from member_evaluations and leader_evaluations first if no ON DELETE CASCADE exists
    await supabase.from('member_evaluations').delete().eq('evaluation_id', id);
    await supabase.from('leader_evaluations').delete().eq('evaluation_id', id);

    // Then delete the main evaluation record
    const { data, error } = await supabase.from('evaluations').delete().eq('id', id);

    if (error) {
      console.error('Supabase Delete Error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Unexpected Delete Error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
