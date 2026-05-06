const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { unit, grade, class: cls, group_number } = req.query;

  // We fetch evaluations with related members and leader evaluations
  // And then aggregate the statistics in memory since it's much simpler than complex SQL RPCs
  let query = supabase.from('evaluations').select('*, member_evaluations(*), leader_evaluations(*)');

  if (unit) query = query.eq('unit', unit);
  if (grade) query = query.eq('grade', grade);
  if (cls) query = query.eq('class', cls);
  if (group_number) query = query.eq('group_number', parseInt(group_number));

  const { data: evals, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Initialize aggregates
  let memberStats = { 
    total_evals: evals.length, total_members: 0, 
    avg_resp: 0, avg_rel: 0, avg_coop: 0, avg_org: 0, avg_edu: 0 
  };
  
  let leaderStats = { 
    total_leader_evals: 0, 
    avg_resp: 0, avg_esp: 0, avg_ori: 0, avg_ini: 0, avg_edu: 0 
  };

  const groupMap = new Map();
  const classMap = new Map();

  evals.forEach(e => {
    // Member Stats Aggregation
    if (e.member_evaluations && e.member_evaluations.length > 0) {
      e.member_evaluations.forEach(m => {
        memberStats.total_members++;
        memberStats.avg_resp += m.responsabilidade;
        memberStats.avg_rel += m.relacionamento;
        memberStats.avg_coop += m.cooperacao;
        memberStats.avg_org += m.organizacao;
        memberStats.avg_edu += m.educacao;

        // Group Stats
        const gKey = `${e.unit}|${e.grade}|${e.class}|${e.group_number}`;
        if (!groupMap.has(gKey)) groupMap.set(gKey, { unit: e.unit, grade: e.grade, class: e.class, group_number: e.group_number, member_count: 0, r:0, rel:0, c:0, o:0, edu:0 });
        const gs = groupMap.get(gKey);
        gs.member_count++; gs.r += m.responsabilidade; gs.rel += m.relacionamento; gs.c += m.cooperacao; gs.o += m.organizacao; gs.edu += m.educacao;

        // Class Stats
        const cKey = `${e.unit}|${e.grade}|${e.class}`;
        if (!classMap.has(cKey)) classMap.set(cKey, { unit: e.unit, grade: e.grade, class: e.class, member_count: 0, group_set: new Set(), r:0, rel:0, c:0, o:0, edu:0 });
        const cs = classMap.get(cKey);
        cs.member_count++; cs.group_set.add(e.group_number);
        cs.r += m.responsabilidade; cs.rel += m.relacionamento; cs.c += m.cooperacao; cs.o += m.organizacao; cs.edu += m.educacao;
      });
    }

    // Leader Stats Aggregation
    if (e.leader_evaluations && e.leader_evaluations.length > 0) {
      // Assuming 1 leader evaluation per evaluation session
      const le = e.leader_evaluations[0];
      leaderStats.total_leader_evals++;
      leaderStats.avg_resp += le.responsabilidade;
      leaderStats.avg_esp += le.espirito_equipe;
      leaderStats.avg_ori += le.orientacao_professor;
      leaderStats.avg_ini += le.iniciativa;
      leaderStats.avg_edu += le.educacao;
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
    const count = g.member_count;
    const avg_resp = g.r / count, avg_rel = g.rel / count, avg_coop = g.c / count, avg_org = g.o / count, avg_edu = g.edu / count;
    return {
      ...g, avg_resp, avg_rel, avg_coop, avg_org, avg_edu,
      avg_overall: (avg_resp + avg_rel + avg_coop + avg_org + avg_edu) / 5
    };
  }).sort((a, b) => b.avg_overall - a.avg_overall);

  // Format Class Stats
  const classStats = Array.from(classMap.values()).map(c => {
    const count = c.member_count;
    const avg_resp = c.r / count, avg_rel = c.rel / count, avg_coop = c.c / count, avg_org = c.o / count, avg_edu = c.edu / count;
    return {
      unit: c.unit, grade: c.grade, class: c.class, member_count: c.member_count, group_count: c.group_set.size,
      avg_resp, avg_rel, avg_coop, avg_org, avg_edu,
      avg_overall: (avg_resp + avg_rel + avg_coop + avg_org + avg_edu) / 5
    };
  }).sort((a, b) => a.unit.localeCompare(b.unit) || a.grade.localeCompare(b.grade) || a.class.localeCompare(b.class));

  // Extract Leader Group Stats natively
  const leaderGroupMap = new Map();
  evals.forEach(e => {
    if (e.leader_evaluations && e.leader_evaluations.length > 0) {
      const gKey = `${e.unit}|${e.grade}|${e.class}|${e.group_number}`;
      if (!leaderGroupMap.has(gKey)) leaderGroupMap.set(gKey, { unit: e.unit, grade: e.grade, class: e.class, group_number: e.group_number, eval_count: 0, r:0, esp:0, ori:0, ini:0, edu:0 });
      const lg = leaderGroupMap.get(gKey);
      const le = e.leader_evaluations[0];
      lg.eval_count++; lg.r += le.responsabilidade; lg.esp += le.espirito_equipe; lg.ori += le.orientacao_professor; lg.ini += le.iniciativa; lg.edu += le.educacao;
    }
  });

  const leaderGroupStats = Array.from(leaderGroupMap.values()).map(lg => {
    const count = lg.eval_count;
    const avg_resp = lg.r / count, avg_esp = lg.esp / count, avg_ori = lg.ori / count, avg_ini = lg.ini / count, avg_edu = lg.edu / count;
    return {
      unit: lg.unit, grade: lg.grade, class: lg.class, group_number: lg.group_number,
      avg_resp, avg_esp, avg_ori, avg_ini, avg_edu,
      avg_overall: (avg_resp + avg_esp + avg_ori + avg_ini + avg_edu) / 5
    };
  }).sort((a, b) => b.avg_overall - a.avg_overall);

  res.status(200).json({ memberStats, leaderStats, groupStats, classStats, leaderGroupStats });
}
