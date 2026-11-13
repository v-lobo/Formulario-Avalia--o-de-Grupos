const { getSupabase } = require('./_supabase');
const { CRITERIA, TABLE, fail } = require('./_shared');
const { ROSTERS } = require('./_groups');
const { currentPeriod, checkOpen } = require('./_periods');
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const body = req.method === 'GET' ? req.query : req.body;
  if (!body || !uuid(body.roster_id) || !uuid(body.evaluator_id))
    return res.status(400).json({ error: 'Selecione seu nome no grupo cadastrado.' });
  try {
    const client = getSupabase();
    const current = await currentPeriod(client);
    const { data: roster, error } = await client.from(ROSTERS).select('*').eq('id', body.roster_id).maybeSingle();
    if (error) throw error;
    if (!roster || roster.deleted_at || !roster.members.some(m => m.id === body.evaluator_id))
      return res.status(400).json({ error: 'Selecione seu nome no grupo cadastrado.' });
    const closed = checkOpen(current, roster);
    if (closed) return res.status(409).json({ error: closed });
    const submitted = await client.from(TABLE).select('id').eq('roster_id', roster.id).eq('evaluator_id', body.evaluator_id).is('deleted_at', null).limit(1);
    if (submitted.error) throw submitted.error;
    if (submitted.data.length) return res.status(409).json({ error: 'Este integrante já enviou a avaliação completa. Selecione outro nome.' });
    if (req.method === 'GET') {
      const result = await client.from('stem_peer_drafts').select('*').eq('roster_id', roster.id).eq('evaluator_id', body.evaluator_id).maybeSingle();
      if (result.error) throw result.error;
      return res.status(200).json({ draft: result.data });
    }
    const peers = roster.members.filter(m => m.id !== body.evaluator_id);
    if (!uuid(body.submission_id) || !Array.isArray(body.members) || body.members.length !== peers.length ||
        new Set(body.members.map(m => m?.member_id)).size !== peers.length ||
        peers.some(p => !body.members.some(m => m?.member_id === p.id)))
      return res.status(400).json({ error: 'Rascunho inválido para este grupo.' });
    const members = body.members.map(member => {
      const cleaned = { member_id: member.member_id };
      for (const key of CRITERIA) {
        if (member[key] !== undefined) {
          if (!Number.isInteger(member[key]) || member[key] < 1 || member[key] > 5) throw Object.assign(new Error('Escolha notas de 1 a 5.'), { validation: true });
          cleaned[key] = member[key];
        }
        if (member[key + '_obs'] !== undefined) {
          if (typeof member[key + '_obs'] !== 'string' || member[key + '_obs'].length > 1200) throw Object.assign(new Error('Cada observação deve ter até 1.200 caracteres.'), { validation: true });
          cleaned[key + '_obs'] = member[key + '_obs'];
        }
      }
      return cleaned;
    });
    const result = await client.rpc('stem_save_peer_draft', { p_roster_id: roster.id, p_evaluator_id: body.evaluator_id, p_submission_id: body.submission_id, p_members: members });
    if (result.error?.code === '22023') return res.status(409).json({ error: result.error.message });
    if (result.error) throw result.error;
    return res.status(200).json({ saved: true });
  } catch (error) {
    if (error.validation) return res.status(400).json({ error: error.message });
    return fail(res, error);
  }
};
