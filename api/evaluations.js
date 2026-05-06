const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { leader_name, unit, grade, class: cls, group_number } = req.body;
    
    if (!leader_name || !unit || !grade || !cls || !group_number) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('evaluations')
      .insert([{ leader_name, unit, grade, class: cls, group_number }])
      .select('id')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ id: data.id });
  } 
  
  if (req.method === 'GET') {
    const { unit, grade, class: cls, group_number } = req.query;
    
    let query = supabase.from('evaluations').select('*, member_evaluations(count), leader_evaluations(count)').order('created_at', { ascending: false });
    
    if (unit) query = query.eq('unit', unit);
    if (grade) query = query.eq('grade', grade);
    if (cls) query = query.eq('class', cls);
    if (group_number) query = query.eq('group_number', parseInt(group_number));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Format count data correctly
    const formattedData = data.map(item => ({
      ...item,
      member_count: item.member_evaluations[0]?.count || 0,
      has_leader_eval: item.leader_evaluations[0]?.count || 0
    }));

    return res.status(200).json(formattedData);
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
