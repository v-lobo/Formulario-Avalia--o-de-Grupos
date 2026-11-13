const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { createDatabase } = require('./helpers/database');

test('rascunho parcial permite retomar, não conta como envio e é removido ao concluir', async t => {
  const db = await createDatabase(); t.after(() => db.close());
  await db.exec(fs.readFileSync('supabase/migrations/20261110132517_single_evaluator_submission.sql', 'utf8'));
  const roster = { id: randomUUID(), academic_year: 2026, semester: 2, unit: 'Farol', grade: '6', class: 'A', group_number: 1,
    members: ['Ana', 'Bruno', 'Clara'].map(name => ({ id: randomUUID(), name })) };
  await db.query('select stem_register_group($1::jsonb)', [JSON.stringify(roster)]);
  const submissionId = randomUUID();
  const save = (evaluator, members) => db.query('select stem_save_peer_draft($1,$2,$3,$4::jsonb)', [roster.id, evaluator, submissionId, JSON.stringify(members)]);
  const partial = roster.members.slice(1).map(m => ({ member_id: m.id })); partial[0].responsabilidade = 4;
  await save(roster.members[0].id, partial);
  assert.equal((await db.query('select count(*)::int n from stem_peer_submissions')).rows[0].n, 0);
  const recovered = (await db.query('select * from stem_peer_drafts')).rows[0];
  assert.equal(recovered.submission_id, submissionId); assert.deepEqual(recovered.members, partial);
  partial[0].educacao = 5; await save(roster.members[0].id, partial);
  assert.equal((await db.query('select members from stem_peer_drafts')).rows[0].members[0].educacao, 5);
  await assert.rejects(save(randomUUID(), partial), /Selecione seu nome/);
  await db.query("select stem_manage_period('close',2026,2)");
  await assert.rejects(save(roster.members[0].id, partial), /fechado/);
  assert.equal((await db.query('select count(*)::int n from stem_peer_drafts')).rows[0].n, 1);
  await db.query("select stem_manage_period('open',2026,2)");
  const complete = partial.map(m => ({ ...m, responsabilidade: 4, relacionamento: 4, cooperacao: 4, organizacao: 4, educacao: 5 }));
  await db.query("insert into stem_peer_submissions(id,evaluator_name,unit,grade,class,group_number,academic_year,semester,members,roster_id,evaluator_id) values($1,'Ana','Farol','6','A',1,2026,2,$2::jsonb,$3,$4)", [submissionId, JSON.stringify(complete), roster.id, roster.members[0].id]);
  assert.equal((await db.query('select count(*)::int n from stem_peer_drafts')).rows[0].n, 0);
  await assert.rejects(save(roster.members[0].id, partial), /já enviou/);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from stem_peer_drafts'), /permission denied/);
    await assert.rejects(save(roster.members[1].id, partial), /permission denied/);
    await db.exec('reset role');
  }
});
