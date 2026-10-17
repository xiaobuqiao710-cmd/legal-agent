/**
 * 编排器（Orchestrator）
 *
 * 职责：按固定职责顺序驱动四个 Agent，并在每一步之间执行**门禁**。
 *
 * 与"四个函数顺序调用"的区别，也是这套东西值得存在的原因：
 *  1. 每步产出先过协议校验，才允许进入下一步 —— 错误不穿透。
 *  2. 质检 Agent 的否决会**打回上一环节**（回环），而不是直接透传给用户。
 *     这是首页那句"质检 Agent 的否决意见会打回上一环节"的真实实现。
 *  3. 每一轮的消息都留在 transcript 里，可逐轮回溯 —— 可复核是法律工作的底线。
 *
 * 回环上限（MAX_REVISIONS）是硬约束：没有它，两个 Agent 可能互相打回无限循环。
 * 超过上限则如实输出"未通过质检"及其理由，而不是伪造一个 pass。
 */

import {
  validateRetrieval,
  validateAnalysis,
  validateDraft,
  validateQc,
  validateCitesResolve,
  validateDraftCoverage,
  ProtocolError,
} from './protocol.mjs';
import { AuditSession, adjudicate, assertNonSelfAudit } from './audit.mjs';

export const MAX_REVISIONS = 2;

/**
 * 覆盖完整性检查 —— 返回问题描述字符串，或 null 表示无问题。
 *
 * 与 `validateDraftCoverage` 的区别：后者抛异常（用于"这个文书结构上就不能要"），
 * 本函数返回描述（用于"这个文书漏了内容，但可以改"）。质检 Agent 会把它
 * 变成一条 finding，进而触发 revise 回环。
 */
function checkCoverage(draft, analysis) {
  const want = new Set((analysis.issues || []).map((i) => i.id));
  const got = new Set((draft.sections || []).map((s) => s.issueId));
  const missing = [...want].filter((id) => !got.has(id));
  const extra = [...got].filter((id) => !want.has(id));
  if (!missing.length && !extra.length) return null;
  const parts = [];
  if (missing.length) parts.push(`漏写争点 [${missing.join(',')}]`);
  if (extra.length) parts.push(`出现多余章节 [${extra.join(',')}]`);
  return parts.join('，');
}

/* ------------------------------------------------------------------ */
/* Agent 适配层                                                         */
/* ------------------------------------------------------------------ */

/**
 * Agent 的接口被刻意定成一个函数：input(结构化) -> output(结构化)。
 *
 * 这样做的收益：Agent 的实现可以是真 LLM 调用，也可以是本地规则引擎，
 * 编排器完全不关心。测试因此不需要网络和 API key。
 */
export function createOrchestrator({ retriever, analyst, writer, qc, onEvent = () => {} }) {
  const agents = { retriever, analyst, writer, qc };
  for (const [name, fn] of Object.entries(agents)) {
    if (typeof fn !== 'function') {
      throw new Error(`Agent "${name}" 必须是函数 input=>output`);
    }
  }

  const emit = (type, payload) => onEvent({ type, at: new Date().toISOString(), ...payload });

  /**
   * 跑一条完整的链路。
   * @returns {{caseId, status, transcript, retrieval, analysis, draft, qc, revisions}}
   */
  async function run(legalCase) {
    const caseId = legalCase.id;
    const transcript = [];
    const record = (stage, msg) => {
      transcript.push({ stage, at: new Date().toISOString(), message: msg });
      return msg;
    };

    emit('run:start', { caseId, title: legalCase.title });

    /* ---------- ① 检索 ---------- */
    emit('stage:start', { caseId, stage: 'retrieval' });
    const retrieval = record('retrieval', validateRetrieval(await retriever(legalCase)));
    emit('stage:done', {
      caseId,
      stage: 'retrieval',
      materials: retrieval.materials.length,
      noResult: retrieval.materials.length === 0,
    });

    // 零结果时下游没有可依据的材料。继续跑只会产出无根据的论证，
    // 所以这里如实中止 —— 这本身就是正确的法律工作方式。
    if (retrieval.materials.length === 0) {
      emit('run:halt', { caseId, reason: '检索零结果', detail: retrieval.noResultReason });
      return { caseId, status: 'no_materials', transcript, retrieval };
    }

    /* ---------- ② 分析 ---------- */
    emit('stage:start', { caseId, stage: 'analysis' });
    const analysis = record('analysis', validateAnalysis(await analyst(retrieval)));
    // 跨消息门禁：论证必须落在真实存在的材料上
    validateCitesResolve(analysis, retrieval);
    emit('stage:done', { caseId, stage: 'analysis', issues: analysis.issues.length });

    /* ---------- ③ 写作 + ④ 质检（带回环 + 对抗式审计） ---------- */
    let draft = null;
    let qcResult = null;
    let revisions = 0;
    let feedback = null;
    // 审计会话：提供"异源强制 / 硬计数熔断 / 修订版方案制"三条规则
    const auditSession = new AuditSession(caseId);

    for (let attempt = 0; attempt <= MAX_REVISIONS; attempt += 1) {
      emit('stage:start', { caseId, stage: 'writing', attempt });
      // 回环时把上一轮质检意见一并交给写作 Agent —— 打回必须带上"改什么"
      draft = record('draft', validateDraft(await writer({ analysis, feedback })));

      /**
       * 覆盖完整性刻意**不在这里硬抛**，而是交给质检 Agent 作为 finding 处理。
       *
       * 这是本项目踩过的第四个真实 bug，也是最有设计价值的一个：
       * 最初这里直接 `validateDraftCoverage(draft, analysis)` 抛异常，
       * 结果测试"revise 应打回重写"时，编排器在质检之前就抛错了 ——
       * **回环机制永远不可能被触发**，是一段死代码。
       *
       * 教训是一条通用的分层原则：
       *   结构性错误（缺字段、类型不对）→ 硬抛，因为下游无法处理；
       *   内容质量问题（漏了争点、论证太弱）→ 交给质检裁决，因为它**可被修复**。
       * 把可修复的问题放进硬抛分支，等于取消了修复机会。
       */
      const coverageIssue = checkCoverage(draft, analysis);
      if (coverageIssue) {
        emit('stage:warn', { caseId, stage: 'writing', attempt, detail: coverageIssue });
      }
      emit('stage:done', { caseId, stage: 'writing', attempt, sections: draft.sections.length });

      emit('stage:start', { caseId, stage: 'qc', attempt });
      qcResult = record('qc', validateQc(await qc({ retrieval, analysis, draft })));
      emit('stage:done', {
        caseId,
        stage: 'qc',
        attempt,
        verdict: qcResult.verdict,
        findings: qcResult.findings.length,
      });

      /**
       * 交由审计层裁决（借鉴 sanjiu-core「三审九方」的三条硬规则）：
       *  · 异源强制：承办与对抗不能同席位，杜绝自审
       *  · 硬计数熔断：对抗轮次配额耗尽即转人工，不靠反复重试磨平错误
       *  · 修订版方案制：非通过时必须给出可执行 fix，不许只甩问题清单
       *
       * 注意这里**不吞掉 AuditError** —— 若质检给出了敷衍的 fix
       * （如"建议加强论证"），那是协议层面的错误，应当直接暴露给调用方，
       * 而不是被编排器悄悄降级成一次普通重试。
       */
      const adj = adjudicate(auditSession, {
        verdict: qcResult.verdict,
        findings: qcResult.findings,
        producerSeat: 'writer',
        auditorSeat: 'qc',
      });
      emit('stage:audit', { caseId, attempt, ...adj });

      if (adj.decision === 'accept') break;

      // 熔断或否决：停止自动流转，如实上报需要人工介入
      if (adj.decision === 'escalate') {
        emit('run:halt', { caseId, reason: adj.reason });
        qcResult = { ...qcResult, escalated: true, escalateReason: adj.reason };
        break;
      }

      // rework：按修订版方案打回上一环节
      if (attempt === MAX_REVISIONS) {
        emit('run:halt', {
          caseId,
          reason: `回环达上限 ${MAX_REVISIONS} 次仍未通过质检`,
        });
        break;
      }
      revisions += 1;
      feedback = {
        verdict: qcResult.verdict,
        findings: qcResult.findings.map((f) => ({
          severity: f.severity,
          issueId: f.issueId,
          problem: f.problem,
          fix: f.fix,
        })),
      };
      emit('stage:rework', { caseId, attempt: attempt + 1, findings: feedback.findings.length });
    }

    /**
     * status 语义（区分"为什么没通过"）：
     *   passed        —— 质检通过，可交付
     *   rejected      —— 质检否决：材料本身不足以支撑，重写无用
     *   escalated     —— 熔断转人工：对抗配额耗尽，需人介入
     *   revise_limit  —— 编排层回环上限（保留，用于审计层未启用时的兜底）
     */
    let status;
    if (qcResult?.verdict === 'pass') status = 'passed';
    else if (qcResult?.verdict === 'reject') status = 'rejected';
    else if (qcResult?.escalated) status = 'escalated';
    else status = 'revise_limit';

    emit('run:done', { caseId, status, revisions });
    return {
      caseId,
      status,
      transcript,
      retrieval,
      analysis,
      draft,
      qc: qcResult,
      revisions,
      audit: { remaining: auditSession.remaining(), history: auditSession.history },
    };
  }

  return { run, MAX_REVISIONS };
}

export { ProtocolError };
