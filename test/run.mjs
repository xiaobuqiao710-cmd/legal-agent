/**
 * 测试套件。
 *
 * 立场：一个"永远通过"的多 Agent 系统是没有价值的。
 * 因此这里的重点不是"链路能跑完"，而是**每一道门禁都真的会拦人**。
 * 每个门禁都用"故意注入的错误"来测 —— 只有看着它把坏输入拦下来，
 * 才能说这道门存在。
 *
 * 运行：node test/run.mjs
 */

import { createOrchestrator, MAX_REVISIONS } from '../lib/orchestrator.mjs';
import { createRetriever, createAnalyst, createWriter, createQc } from '../agents/index.mjs';
import { CASES } from '../cases/index.mjs';
import { search } from '../lib/corpus.mjs';
import {
  validateRetrieval,
  validateAnalysis,
  validateQc,
  validateCitesResolve,
  validateDraftCoverage,
  ProtocolError,
} from '../lib/protocol.mjs';

/* ------------------------------------------------------------------ */
/* 极简测试框架（零依赖）                                                */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || '不相等'}：期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, matcher, msg) {
  try {
    fn();
  } catch (e) {
    if (matcher && !String(e.message).includes(matcher)) {
      throw new Error(`${msg || '异常信息不符'}：期望包含 "${matcher}"，实得 "${e.message}"`);
    }
    return e;
  }
  throw new Error(msg || '期望抛出异常，但没有抛出');
}

const buildOrch = (overrides = {}) =>
  createOrchestrator({
    retriever: createRetriever(),
    analyst: createAnalyst(),
    writer: createWriter(),
    qc: createQc(),
    ...overrides,
  });

/* ================================================================== */
console.log('\n【一】端到端正向路径');
/* ================================================================== */

await test('CASE-001 完整跑通并通过质检', async () => {
  const r = await buildOrch().run(CASES[0]);
  assertEq(r.status, 'passed', 'status');
  assertEq(r.analysis.issues.length, 5, '争点数应为 5（I1–I5）');
  assertEq(r.draft.sections.length, 5, '文书章节数应与争点数一致');
  assertEq(r.qc.verdict, 'pass', '质检裁决');
  assertEq(r.qc.findings.length, 0, '通过时不应有 findings');
  assertEqualSets(r.draft.sections.map((s) => s.issueId), r.analysis.issues.map((i) => i.id), '争点覆盖');
});

await test('CASE-002 完整跑通并通过质检', async () => {
  const r = await buildOrch().run(CASES[1]);
  assertEq(r.status, 'passed', 'status');
  assert(r.analysis.issues.length >= 1, '至少一个争点');
});

await test('每个争点都有可核验的引用（无悬空引用）', async () => {
  const r = await buildOrch().run(CASES[0]);
  const known = new Set(r.retrieval.materials.map((m) => m.id));
  for (const issue of r.analysis.issues) {
    assert(issue.cites.length > 0, `${issue.id} 应有引用`);
    for (const c of issue.cites) assert(known.has(c), `${issue.id} 引用了不存在的材料 ${c}`);
  }
});

await test('所有材料都带 source 与 locator（可追溯）', async () => {
  const r = await buildOrch().run(CASES[0]);
  for (const m of r.retrieval.materials) {
    assert(m.source && m.source.trim(), `${m.id} 缺 source`);
    assert(m.locator && m.locator.trim(), `${m.id} 缺 locator`);
    assert(m.quote && m.quote.trim(), `${m.id} 缺 quote`);
  }
});

/* ================================================================== */
console.log('\n【二】负向路径：材料不足时必须如实中止');
/* ================================================================== */

await test('CASE-003 无关案件 → no_materials（不硬凑条文）', async () => {
  const r = await buildOrch().run(CASES[2]);
  assertEq(r.status, 'no_materials', 'status 应为 no_materials');
  assert(r.retrieval.noResultReason, '应给出零结果原因');
  assertEq(r.analysis, undefined, '不应进入分析环节');
  assertEq(r.draft, undefined, '不应产出文书');
});

await test('检索零结果时编排器中止，不调用下游 Agent', async () => {
  let analystCalled = false;
  const r = await buildOrch({
    retriever: async (c) => ({
      caseId: c.id,
      query: 'x',
      materials: [],
      noResultReason: '测试注入：零结果',
    }),
    analyst: async () => {
      analystCalled = true;
      return { caseId: 'x', issues: [] };
    },
  }).run(CASES[0]);
  assertEq(analystCalled, false, '下游 Agent 不应被调用');
  assertEq(r.status, 'no_materials', 'status');
});

/* ================================================================== */
console.log('\n【三】协议门禁：注入错误必须被拦下');
/* ================================================================== */

await test('门禁A：引用不存在的材料 → 跨消息校验拦截', () => {
  const retrieval = { caseId: 'C', query: 'q', materials: [{ id: 'M1', kind: 'statute', source: 's', locator: 'l', quote: 'q', relevance: 1 }] };
  const analysis = {
    caseId: 'C',
    issues: [{ id: 'I1', question: 'q', rule: 'r', application: 'a', conclusion: 'c', cites: ['M1', 'FABRICATED-999'], confidence: 0.9 }],
  };
  assertThrows(
    () => validateCitesResolve(analysis, retrieval),
    'FABRICATED-999',
    '应拦截编造的案号引用',
  );
});

await test('门禁A：材料缺 locator → 校验失败', () => {
  assertThrows(
    () => validateRetrieval({ caseId: 'C', query: 'q', materials: [{ id: 'M1', kind: 'statute', source: 's', locator: '', quote: 'x', relevance: 1 }] }),
    'locator',
  );
});

await test('门禁A：材料缺 source → 校验失败', () => {
  assertThrows(
    () => validateRetrieval({ caseId: 'C', query: 'q', materials: [{ id: 'M1', kind: 'statute', source: '', locator: 'l', quote: 'x', relevance: 1 }] }),
    'source',
  );
});

await test('门禁A：kind 非法 → 校验失败', () => {
  assertThrows(
    () => validateRetrieval({ caseId: 'C', query: 'q', materials: [{ id: 'M1', kind: 'made-up', source: 's', locator: 'l', quote: 'x', relevance: 1 }] }),
    'kind',
  );
});

await test('门禁A：检索零结果但未声明原因 → 校验失败', () => {
  assertThrows(() => validateRetrieval({ caseId: 'C', query: 'q', materials: [] }), 'noResultReason');
});

await test('门禁B：争点无引用 → 校验失败', () => {
  assertThrows(
    () => validateAnalysis({ caseId: 'C', issues: [{ id: 'I1', question: 'q', rule: 'r', application: 'a', conclusion: 'c', cites: [], confidence: 0.9 }] }),
    'cites',
  );
});

await test('门禁B：confidence 越界（>1）→ 校验失败', () => {
  assertThrows(
    () => validateAnalysis({ caseId: 'C', issues: [{ id: 'I1', question: 'q', rule: 'r', application: 'a', conclusion: 'c', cites: ['M1'], confidence: 1.5 }] }),
    'confidence',
  );
});

await test('门禁C：文书漏写争点 → 覆盖校验拦截', () => {
  const analysis = { caseId: 'C', issues: [{ id: 'I1' }, { id: 'I2' }] };
  const draft = { caseId: 'C', title: 't', sections: [{ issueId: 'I1', heading: 'h', body: 'b', cites: [] }] };
  assertThrows(() => validateDraftCoverage(draft, analysis), '漏写', '应拦截漏项');
});

await test('门禁C：文书出现多余争点 → 覆盖校验拦截', () => {
  const analysis = { caseId: 'C', issues: [{ id: 'I1' }] };
  const draft = { caseId: 'C', title: 't', sections: [{ issueId: 'I1', heading: 'h', body: 'b', cites: [] }, { issueId: 'I9', heading: 'h', body: 'b', cites: [] }] };
  assertThrows(() => validateDraftCoverage(draft, analysis), '多余');
});

/* ================================================================== */
console.log('\n【四】质检裁决自洽性');
/* ================================================================== */

await test('裁决自洽：verdict=pass 但带 findings → 拒绝', () => {
  assertThrows(
    () => validateQc({ caseId: 'C', verdict: 'pass', findings: [{ severity: 'minor', issueId: 'I1', problem: 'p', fix: 'f' }] }),
    '自相矛盾',
  );
});

await test('裁决自洽：verdict=revise 但无 findings → 拒绝（无法执行）', () => {
  assertThrows(() => validateQc({ caseId: 'C', verdict: 'revise', findings: [] }), '没有任何 findings');
});

await test('裁决自洽：verdict=reject 但无 blocker → 拒绝', () => {
  assertThrows(
    () => validateQc({ caseId: 'C', verdict: 'reject', findings: [{ severity: 'major', issueId: 'I1', problem: 'p', fix: 'f' }] }),
    'blocker',
  );
});

await test('裁决合法：reject + blocker → 通过校验', () => {
  validateQc({ caseId: 'C', verdict: 'reject', findings: [{ severity: 'blocker', issueId: 'I1', problem: 'p', fix: 'f' }] });
});

/* ================================================================== */
console.log('\n【五】回环机制：质检否决必须真的打回上一环节');
/* ================================================================== */

await test('revise → 写作 Agent 被再次调用，且收到 feedback', async () => {
  let writeCalls = 0;
  let lastFeedback = null;
  const r = await buildOrch({
    writer: async ({ analysis, feedback }) => {
      writeCalls += 1;
      lastFeedback = feedback;
      // 第一轮故意漏掉一个争点，第二轮补齐 —— 模拟"被质检打回后改正"
      const issues = writeCalls === 1 ? analysis.issues.slice(0, 1) : analysis.issues;
      return {
        caseId: analysis.caseId,
        title: 't',
        sections: issues.map((i) => ({ issueId: i.id, heading: i.question, body: 'x'.repeat(20), cites: i.cites })),
      };
    },
  }).run(CASES[0]);

  assertEq(writeCalls, 2, '写作 Agent 应被调用两次（首轮 + 打回）');
  assert(lastFeedback, '第二轮应收到质检反馈');
  assert(lastFeedback.findings.length > 0, '反馈应包含具体 findings');
  assertEq(r.status, 'passed', '补齐后应通过');
  assertEq(r.revisions, 1, '应记录一次修订');
});

await test('回环达上限仍不通过 → 熔断转人工（escalated），不伪造 pass', async () => {
  let writeCalls = 0;
  const r = await buildOrch({
    writer: async ({ analysis }) => {
      writeCalls += 1;
      // 永远只写第一个争点：质检必然一直报"漏项"
      const issues = analysis.issues.slice(0, 1);
      return {
        caseId: analysis.caseId,
        title: 't',
        sections: issues.map((i) => ({ issueId: i.id, heading: i.question, body: 'x'.repeat(20), cites: i.cites })),
      };
    },
  }).run(CASES[0]);

  assertEq(r.status, 'escalated', 'status 应为 escalated（熔断转人工）');
  assertEq(writeCalls, MAX_REVISIONS + 1, `写作 Agent 应被调用 ${MAX_REVISIONS + 1} 次（首轮 + ${MAX_REVISIONS} 次回环）`);
  assert(r.qc.verdict !== 'pass', '不应伪装成通过');
});

await test('reject（不可修复）→ 立即中止，不浪费回环次数', async () => {
  let writeCalls = 0;
  const r = await buildOrch({
    writer: async ({ analysis }) => {
      writeCalls += 1;
      return {
        caseId: analysis.caseId,
        title: 't',
        sections: analysis.issues.map((i) => ({ issueId: i.id, heading: i.question, body: 'x'.repeat(20), cites: i.cites })),
      };
    },
    qc: async ({ analysis }) => ({
      caseId: analysis.caseId,
      verdict: 'reject',
      findings: [{ severity: 'blocker', issueId: 'I1', problem: '没有任何可核验的材料支撑', fix: '回到检索环节补充语料，或撤回该争点不写' }],
    }),
  }).run(CASES[0]);

  assertEq(r.status, 'rejected', 'status 应为 rejected');
  assertEq(writeCalls, 1, 'reject 后不应再重写');
});

await test('质检否决确实阻止了漏项文书被当作成品交付', async () => {
  const r = await buildOrch({
    writer: async ({ analysis }) => ({
      caseId: analysis.caseId,
      title: 't',
      sections: analysis.issues.slice(0, 2).map((i) => ({ issueId: i.id, heading: i.question, body: 'x'.repeat(20), cites: i.cites })),
    }),
  }).run(CASES[0]);

  assertEq(r.status, 'escalated', '漏项且改不动 → 熔断转人工，不得判为通过');
  assert(r.qc.findings.some((f) => f.problem.includes('漏项')), '质检应明确指出漏项');
});

/* ================================================================== */
console.log('\n【六】协议层：错误不穿透（fail-fast）');
/* ================================================================== */

await test('上游产出不合协议 → 编排器抛错并指明字段', async () => {
  const err = await buildOrch({
    retriever: async () => ({ caseId: 'C', query: 'q', materials: [{ id: 'M1', kind: 'statute', source: '', locator: 'l', quote: 'x', relevance: 1 }] }),
  })
    .run(CASES[0])
    .then(() => null)
    .catch((e) => e);

  assert(err, '应抛出异常');
  assert(err instanceof ProtocolError, `应为 ProtocolError，实得 ${err.name}`);
  assert(err.message.includes('source'), `错误信息应指明字段 source，实得：${err.message}`);
});

await test('分析 Agent 引用捏造材料 → 在进入写作前被拦下', async () => {
  const err = await buildOrch({
    analyst: async (retrieval) => ({
      caseId: retrieval.caseId,
      issues: [{ id: 'I1', question: 'q', rule: 'r', application: 'a', conclusion: 'c', cites: ['FAKE-1'], confidence: 0.9 }],
    }),
  })
    .run(CASES[0])
    .then(() => null)
    .catch((e) => e);

  assert(err, '应抛出异常');
  assert(err.message.includes('FAKE-1'), '应指出具体悬空引用');
});

/* ================================================================== */
console.log('\n【七】中文检索正确性（回归护栏）');
/* ================================================================== */

await test('中文长句能检索到材料（n-gram 分词回归）', () => {
  const hits = search('信息披露违法的责任主体范围如何界定', { limit: 10 });
  assert(hits.length > 0, '中文长句不应恒零命中（这是本项目修过的真实 bug）');
  assert(hits.some((h) => h.material.id === 'S-85'), '应检到责任主体条款 S-85');
});

await test('当事人承诺制度相关问句能检到 K-4', () => {
  const hits = search('证券期货行政执法当事人承诺制度适用条件', { limit: 10 });
  assert(hits.length > 0, '应有命中');
  assertEq(hits[0].material.id, 'K-4', '最相关应为 K-4');
});

await test('无关案件不产生命中（负向）', () => {
  const hits = search('宅基地相邻关系采光通行排水精神损害赔偿', { limit: 10 });
  assertEq(hits.length, 0, '与证券法/公司法语料无关，不应命中');
});



/* ================================================================== */
console.log('\n【八】引注核验器（citation verifier）');
/* ================================================================== */

const { extractCitations, verifyText, cnToNumber, STATUS } = await import('../tools/check-cites.mjs');

await test('中文数字解析正确（含百位）', () => {
  assertEq(cnToNumber('八十五'), 85, '八十五');
  assertEq(cnToNumber('一百九十七'), 197, '一百九十七');
  assertEq(cnToNumber('三十二'), 32, '三十二');
  assertEq(cnToNumber('197'), 197, '阿拉伯数字');
});

await test('能抽取书名号形式与简称形式两种引用', () => {
  const cs = extractCitations('《中华人民共和国证券法》第八十五条与《证券法》第197条');
  assertEq(cs.length, 2, '应抽取 2 处');
});

await test('真实法条 → verified', () => {
  const r = verifyText('《证券法》第八十五条');
  assertEq(r.counts.verified, 1, '应核验通过');
  assertEq(r.counts.notFound, 0, '不应误报');
});

await test('编造条号 → not_found（核心能力）', () => {
  const r = verifyText('《中华人民共和国证券法》第九百九十九条');
  assertEq(r.counts.notFound, 1, '应判为未收录');
  assertEq(r.counts.verified, 0, '不应误判为通过');
});

await test('未覆盖法律 → out_of_scope（不静默放过）', () => {
  const r = verifyText('《民法典》第五百零九条');
  assertEq(r.counts.outOfScope, 1, '应标为超出范围');
});

await test('无法识别法名 → law_unknown', () => {
  const r = verifyText('《某内部规定》第三条');
  assertEq(r.counts.lawUnknown, 1, '应标为法名不明');
});

await test('混合文本：真假引用分别判定，互不干扰', () => {
  const r = verifyText('《证券法》第八十五条为真；《证券法》第九百九十九条为假。');
  assertEq(r.counts.verified, 1, '真引用应通过');
  assertEq(r.counts.notFound, 1, '假引用应被标出');
});

await test('未收录时报告已知条号，辅助人工判断', () => {
  const r = verifyText('《行政处罚法》第五百条');
  const c = r.citations[0];
  assert(Array.isArray(c.knownArticleNumbers) && c.knownArticleNumbers.length > 0, '应给出已知条号列表');
  assert(c.detail.includes('5'), '详情应含已知条号');
});



/* ================================================================== */
console.log('\n【九】对抗式审计层（借鉴 sanjiu-core 三审九方）');
/* ================================================================== */

const audit = await import('../lib/audit.mjs');

const GOOD_FINDINGS = [
  { severity: 'blocker', issueId: 'I2', problem: '该争点在文书中未被回应', fix: '在文书中补充第二章，覆盖争点 I2 的规则与适用' },
];

await test('规则一：承办与对抗同席位 → 拒绝（禁止自审）', () => {
  assertThrows(
    () => audit.assertNonSelfAudit('writer', 'writer'),
    'AUDIT_ERR_SAME_SEAT',
    '同一席位应被拒绝',
  );
});

await test('规则一：未注册席位 → 拒绝', () => {
  assertThrows(() => audit.assertNonSelfAudit('writer', 'ghost'), 'AUDIT_ERR_UNKNOWN_SEAT');
});

await test('规则一：异席位 → 放行', () => {
  audit.assertNonSelfAudit('writer', 'qc');
});

await test('规则二：对抗配额外超出即熔断', () => {
  const s = new audit.AuditSession('T');
  s.submitObjection('qc', GOOD_FINDINGS);
  s.submitObjection('qc', GOOD_FINDINGS);
  assertThrows(() => s.submitObjection('qc', GOOD_FINDINGS), 'AUDIT_ERR_ROUND_LIMIT');
  assertEq(s.melted, true, '应已熔断');
});

await test('规则二：熔断后任何提交都被拒绝', () => {
  const s = new audit.AuditSession('T', { limits: { maxObjectionRounds: 1, maxRulings: 1, maxAppeals: 1 } });
  s.submitObjection('qc', GOOD_FINDINGS);
  try { s.submitObjection('qc', GOOD_FINDINGS); } catch { /* 预期熔断 */ }
  assertThrows(() => s.rule('judge', 'pass'), 'AUDIT_ERR_MELTDOWN');
});

await test('规则二：裁决只允许一次，第二次即熔断', () => {
  const s = new audit.AuditSession('T');
  s.rule('judge', 'pass');
  assertThrows(() => s.rule('judge', 'pass'), 'AUDIT_ERR_ROUND_LIMIT');
});

await test('规则二：上诉仅一次', () => {
  const s = new audit.AuditSession('T');
  s.appeal('writer');
  assertThrows(() => s.appeal('writer'), 'AUDIT_ERR_ROUND_LIMIT');
});

await test('规则三：fix 过短 → 拒绝（修订版方案必须可执行）', () => {
  assertThrows(
    () => audit.assertActionableFix([{ issueId: 'I1', fix: '补充' }]),
    'AUDIT_ERR_BAD_REVISION',
  );
});

await test('规则三：fix 含空话 → 拒绝', () => {
  assertThrows(
    () => audit.assertActionableFix([{ issueId: 'I1', fix: '建议进一步加强该部分的论证力度' }]),
    'AUDIT_ERR_BAD_REVISION',
    '空话应被拦截',
  );
});

await test('规则三：具体可执行的 fix → 放行', () => {
  audit.assertActionableFix(GOOD_FINDINGS);
});

await test('裁决：pass → accept', () => {
  const s = new audit.AuditSession('T');
  const r = audit.adjudicate(s, { verdict: 'pass', findings: [] });
  assertEq(r.decision, 'accept', 'decision');
});

await test('裁决：reject → escalate，且不消耗对抗配额', () => {
  const s = new audit.AuditSession('T');
  const r = audit.adjudicate(s, {
    verdict: 'reject',
    findings: [{ severity: 'blocker', issueId: 'I1', problem: '没有任何可核验的材料支撑', fix: '回到检索环节补充语料或撤回该争点' }],
  });
  assertEq(r.decision, 'escalate', 'decision');
  assertEq(s.remaining().objectionRounds, 2, 'reject 不应消耗对抗配额');
});

await test('裁决：revise → rework，且最后一轮配额用尽仍放行重写', () => {
  const s = new audit.AuditSession('T');
  const r1 = audit.adjudicate(s, { verdict: 'revise', findings: GOOD_FINDINGS });
  assertEq(r1.decision, 'rework', '第一轮应重写');
  const r2 = audit.adjudicate(s, { verdict: 'revise', findings: GOOD_FINDINGS });
  assertEq(r2.decision, 'rework', '最后一轮配额用尽时仍应允许重写（不可提前吃掉机会）');
  assertEq(r2.remaining.objectionRounds, 0, '此时配额应为 0');
});

await test('裁决：配额耗尽后再次打回 → escalate（熔断转人工）', () => {
  const s = new audit.AuditSession('T');
  audit.adjudicate(s, { verdict: 'revise', findings: GOOD_FINDINGS });
  audit.adjudicate(s, { verdict: 'revise', findings: GOOD_FINDINGS });
  const r3 = audit.adjudicate(s, { verdict: 'revise', findings: GOOD_FINDINGS });
  assertEq(r3.decision, 'escalate', '超配额应熔断');
});

await test('端到端：审计层拒绝同席位自审（编排器接线正确）', async () => {
  const err = await createOrchestrator({
    retriever: createRetriever(),
    analyst: createAnalyst(),
    writer: createWriter(),
    qc: createQc(),
  })
    .run(CASES[0])
    .then(() => null)
    .catch((e) => e);
  // 正常路径不应抛错，且应带上 audit 信息
  assertEq(err, null, '正常路径不应抛错');
});

await test('端到端：跑通时返回 audit 剩余配额与历史', async () => {
  const r = await buildOrch().run(CASES[0]);
  assertEq(r.status, 'passed', 'status');
  assert(r.audit, '应返回 audit 字段');
  assert(Array.isArray(r.audit.history), 'audit.history 应为数组');
  assertEq(r.audit.remaining.melted, false, '不应熔断');
});

/* ================================================================== */
/* 汇总                                                                */
/* ================================================================== */

function assertEqualSets(a, b, msg) {
  const sa = [...a].sort().join(',');
  const sb = [...b].sort().join(',');
  if (sa !== sb) throw new Error(`${msg}：期望 {${sb}}，实得 {${sa}}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`测试结果：${passed} 通过 / ${failed} 失败（共 ${passed + failed}）`);
if (failures.length) {
  console.log('\n失败明细：');
  for (const f of failures) console.log(`  ✗ ${f.name}\n    ${f.error}`);
}
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
