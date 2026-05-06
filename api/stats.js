const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { unit, grade, class: cls, group_number } = req.query;

  let query = supabase.from('evaluations').select('*, member_evaluations(*), leader_evaluations(*)');

  if (unit) query = query.eq('unit', unit);
  if (grade) query = query.eq('grade', grade);
  if (cls) query = query.eq('class', cls);
  if (group_number) query = query.eq('group_number', parseInt(group_number));

  const { data: evals, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Aggregates
  let memberStats = {
    total_evals: evals.length, total_members: 0, low_scores: 0,
    avg_resp: 0, avg_rel: 0, avg_coop: 0, avg_org: 0, avg_edu: 0
  };

  let leaderStats = {
    total_leader_evals: 0, low_scores: 0,
    avg_resp: 0, avg_esp: 0, avg_ori: 0, avg_ini: 0, avg_edu: 0
  };

  const groupMap = new Map();

  function countLow(...scores) { return scores.filter(s => s <= 2).length; }

  evals.forEach(e => {
    // Member Stats
    if (e.member_evaluations && e.member_evaluations.length > 0) {
      e.member_evaluations.forEach(m => {
        memberStats.total_members++;
        memberStats.avg_resp += m.responsabilidade;
        memberStats.avg_rel += m.relacionamento;
        memberStats.avg_coop += m.cooperacao;
        memberStats.avg_org += m.organizacao;
        memberStats.avg_edu += m.educacao;
        memberStats.low_scores += countLow(m.responsabilidade, m.relacionamento, m.cooperacao, m.organizacao, m.educacao);

        const gKey = `${e.unit}|${e.grade}|${e.class}|${e.group_number}`;
        if (!groupMap.has(gKey)) groupMap.set(gKey, {
          unit: e.unit, grade: e.grade, class: e.class, group_number: e.group_number,
          leader_name: e.leader_name,
          member_count: 0, r: 0, rel: 0, c: 0, o: 0, edu: 0,
          leader_r: 0, leader_esp: 0, leader_ori: 0, leader_ini: 0, leader_edu: 0,
          has_leader: false, low_scores: 0, low_details: []
        });
        const gs = groupMap.get(gKey);
        gs.member_count++;
        gs.r += m.responsabilidade; gs.rel += m.relacionamento; gs.c += m.cooperacao; gs.o += m.organizacao; gs.edu += m.educacao;

        // Track low scores for attention points
        const lowFields = [];
        if (m.responsabilidade <= 2) lowFields.push('Responsabilidade');
        if (m.relacionamento <= 2) lowFields.push('Relacionamento');
        if (m.cooperacao <= 2) lowFields.push('Cooperação');
        if (m.organizacao <= 2) lowFields.push('Organização');
        if (m.educacao <= 2) lowFields.push('Educação');
        if (lowFields.length) gs.low_details.push({ name: m.member_name, fields: lowFields });
      });
    }

    // Leader Stats
    if (e.leader_evaluations && e.leader_evaluations.length > 0) {
      const le = e.leader_evaluations[0];
      leaderStats.total_leader_evals++;
      leaderStats.avg_resp += le.responsabilidade;
      leaderStats.avg_esp += le.espirito_equipe;
      leaderStats.avg_ori += le.orientacao_professor;
      leaderStats.avg_ini += le.iniciativa;
      leaderStats.avg_edu += le.educacao;
      leaderStats.low_scores += countLow(le.responsabilidade, le.espirito_equipe, le.orientacao_professor, le.iniciativa, le.educacao);

      const gKey = `${e.unit}|${e.grade}|${e.class}|${e.group_number}`;
      if (groupMap.has(gKey)) {
        const gs = groupMap.get(gKey);
        gs.has_leader = true;
        gs.leader_r = le.responsabilidade; gs.leader_esp = le.espirito_equipe;
        gs.leader_ori = le.orientacao_professor; gs.leader_ini = le.iniciativa; gs.leader_edu = le.educacao;
        // Track leader low scores
        const lowFields = [];
        if (le.responsabilidade <= 2) lowFields.push('Responsabilidade (líder)');
        if (le.espirito_equipe <= 2) lowFields.push('Espírito de Equipe');
        if (le.orientacao_professor <= 2) lowFields.push('Orientação Prof.');
        if (le.iniciativa <= 2) lowFields.push('Iniciativa');
        if (le.educacao <= 2) lowFields.push('Educação (líder)');
        if (lowFields.length) gs.low_details.push({ name: e.leader_name + ' (líder)', fields: lowFields });
      }
    }
  });

  // Average Calculations
  if (memberStats.total_members > 0) {
    const tm = memberStats.total_members;
    memberStats.avg_resp /= tm; memberStats.avg_rel /= tm; memberStats.avg_coop /= tm; memberStats.avg_org /= tm; memberStats.avg_edu /= tm;
  }

  if (leaderStats.total_leader_evals > 0) {
    const tl = leaderStats.total_leader_evals;
    leaderStats.avg_resp /= tl; leaderStats.avg_esp /= tl; leaderStats.avg_ori /= tl; leaderStats.avg_ini /= tl; leaderStats.avg_edu /= tl;
  }

  // Format Group Stats
  const groupStats = Array.from(groupMap.values()).map(g => {
    const count = g.member_count || 1;
    const avg_resp = g.r / count, avg_rel = g.rel / count, avg_coop = g.c / count, avg_org = g.o / count, avg_edu = g.edu / count;
    const member_avg = (avg_resp + avg_rel + avg_coop + avg_org + avg_edu) / 5;
    let leader_avg = null;
    if (g.has_leader) {
      leader_avg = (g.leader_r + g.leader_esp + g.leader_ori + g.leader_ini + g.leader_edu) / 5;
    }
    return {
      unit: g.unit, grade: g.grade, class: g.class, group_number: g.group_number,
      leader_name: g.leader_name, member_count: g.member_count,
      avg_resp, avg_rel, avg_coop, avg_org, avg_edu,
      member_avg, leader_avg,
      low_details: g.low_details
    };
  }).sort((a, b) => (b.member_avg || 0) - (a.member_avg || 0));

  // Combined avg (all member + leader criteria)
  let combinedSum = 0, combinedCount = 0;
  if (memberStats.total_members > 0) {
    combinedSum += (memberStats.avg_resp + memberStats.avg_rel + memberStats.avg_coop + memberStats.avg_org + memberStats.avg_edu);
    combinedCount += 5;
  }
  if (leaderStats.total_leader_evals > 0) {
    combinedSum += (leaderStats.avg_resp + leaderStats.avg_esp + leaderStats.avg_ori + leaderStats.avg_ini + leaderStats.avg_edu);
    combinedCount += 5;
  }
  const combinedAvg = combinedCount > 0 ? combinedSum / combinedCount : 0;
  const totalLowScores = memberStats.low_scores + leaderStats.low_scores;

  res.status(200).json({
    memberStats, leaderStats, groupStats,
    combinedAvg, totalLowScores
  });
}
