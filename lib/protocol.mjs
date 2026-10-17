/**
 * 结构化消息协议（Structured Message Protocol）
 *
 * 这是整个多 Agent 系统的地基。核心主张只有一句：
 *   Agent 之间传递的不是自然语言，而是带字段的中间产物。
 *
 * 为什么必须这样：
 * - 自然语言传参无法被下游程序化校验。B 说"我检索到几个相关案例"，
 *   C 无法判断这是 3 个还是 30 个，也无法判断每个案例是否真的带案号。
 * - 一旦中间产物有 schema，每一步都能在进入下一步之前被**门禁**拦下，
 *   错误不会穿透到最终文书里。
 *
 * 设计取舍：
 * - 校验器是手写的，不引入 ajv/zod。理由是这套协议的字段很少且稳定，
 *   而依赖越少，别人（或未来的自己）越容易读懂并复用。
 * - 每个 Agent 只能读取上游给它的最小字段集（见 INPUT_SCHEMA），
 *   这是"避免长上下文稀释注意力"那条主张的**代码级落实**，不是口号。
 */

/** 断言失败即抛出，并带上可读的字段路径 */
export class ProtocolError extends Error {
  constructor(path, message) {
    super(`[协议校验失败] ${path}: ${message}`);
    this.name = 'ProtocolError';
    this.path = path;
  }
}

/* ------------------------------------------------------------------ */
/* 校验原语                                                             */
/* ------------------------------------------------------------------ */

function req(obj, key, path, type) {
  const v = obj?.[key];
  if (v === undefined || v === null) {
    throw new ProtocolError(`${path}.${key}`, '必填字段缺失');
  }
  if (type && !checkType(v, type)) {
    throw new ProtocolError(`${path}.${key}`, `期望 ${type}，实得 ${typeof v}`);
  }
  return v;
}

function checkType(v, type) {
  switch (type) {
    case 'string':
      return typeof v === 'string';
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'array':
      return Array.isArray(v);
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    default:
      return true;
  }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/* ------------------------------------------------------------------ */
/* ① 检索 Agent 的产出：检索结果集                                       */
/* ------------------------------------------------------------------ */

/**
 * 每个法条/案例必须带 source 与 locator。
 * locator 是"可核验定位符"——没有它，下游质检无法验证这条材料真实存在，
 * 而"编造法条"正是法律 AI 最不可接受的失败模式。
 */
export function validateRetrieval(msg) {
  const P = 'RetrievalResult';
  req(msg, 'caseId', P, 'string');
  req(msg, 'query', P, 'string');
  const materials = req(msg, 'materials', P, 'array');

  if (materials.length === 0) {
    // 零结果不是错误，但必须显式声明，否则下游会误以为"没有规定"
    req(msg, 'noResultReason', P, 'string');
  }

  materials.forEach((m, i) => {
    const p = `${P}.materials[${i}]`;
    req(m, 'id', p, 'string');
    req(m, 'kind', p, 'string');
    if (!['statute', 'case', 'regulation', 'doctrine'].includes(m.kind)) {
      throw new ProtocolError(`${p}.kind`, `未知类型 ${m.kind}`);
    }
    if (!isNonEmptyString(m.source)) {
      throw new ProtocolError(`${p}.source`, 'source 不可为空（必须可追溯）');
    }
    if (!isNonEmptyString(m.locator)) {
      throw new ProtocolError(`${p}.locator`, 'locator 不可为空（如案号 / 条款号）');
    }
    if (!isNonEmptyString(m.quote)) {
      throw new ProtocolError(`${p}.quote`, 'quote 不可为空（原文摘录）');
    }
    // relevance 必须显式给出，让下游能判断"材料够不够"
    req(m, 'relevance', p, 'number');
    if (m.relevance < 0 || m.relevance > 1) {
      throw new ProtocolError(`${p}.relevance`, `须在 0..1，实得 ${m.relevance}`);
    }
  });

  return msg;
}

/* ------------------------------------------------------------------ */
/* ② 分析 Agent 的产出：争点清单（IRAC）                                 */
/* ------------------------------------------------------------------ */

/**
 * 每个争点必须挂到具体 material id 上。
 * 这一条把"论证必须落在实证材料上"变成机器可查的约束：
 * 引用了不存在的材料 id，在进入写作环节之前就会失败。
 */
export function validateAnalysis(msg) {
  const P = 'AnalysisResult';
  req(msg, 'caseId', P, 'string');
  const issues = req(msg, 'issues', P, 'array');

  if (issues.length === 0) {
    throw new ProtocolError(`${P}.issues`, '至少需要一个争点');
  }

  issues.forEach((it, i) => {
    const p = `${P}.issues[${i}]`;
    req(it, 'id', p, 'string');
    req(it, 'question', p, 'string');
    req(it, 'rule', p, 'string');
    req(it, 'application', p, 'string');
    req(it, 'conclusion', p, 'string');
    const cites = req(it, 'cites', p, 'array');
    if (cites.length === 0) {
      throw new ProtocolError(`${p}.cites`, '争点必须至少引用一条材料');
    }
    // 置信度：允许 Agent 说"我没把握"，而不是伪装成确定结论
    req(it, 'confidence', p, 'number');
    if (it.confidence < 0 || it.confidence > 1) {
      throw new ProtocolError(`${p}.confidence`, `须在 0..1，实得 ${it.confidence}`);
    }
  });

  return msg;
}

/**
 * 跨消息校验：分析引用的每条 material 必须真实存在于检索结果里。
 * 这是协议里最有价值的一道门 —— 它拦截"凭记忆编案号"。
 */
export function validateCitesResolve(analysis, retrieval) {
  const known = new Set((retrieval.materials || []).map((m) => m.id));
  const dangling = [];
  for (const it of analysis.issues || []) {
    for (const c of it.cites || []) {
      if (!known.has(c)) dangling.push({ issue: it.id, cite: c });
    }
  }
  if (dangling.length > 0) {
    const detail = dangling.map((d) => `${d.issue}→${d.cite}`).join(', ');
    throw new ProtocolError('AnalysisResult.issues[].cites', `引用了检索结果中不存在的材料: ${detail}`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* ③ 写作 Agent 的产出：文书草稿                                         */
/* ------------------------------------------------------------------ */

export function validateDraft(msg) {
  const P = 'DraftResult';
  req(msg, 'caseId', P, 'string');
  req(msg, 'title', P, 'string');
  const sections = req(msg, 'sections', P, 'array');
  if (sections.length === 0) {
    throw new ProtocolError(`${P}.sections`, '文书至少需要一个段落');
  }
  sections.forEach((s, i) => {
    const p = `${P}.sections[${i}]`;
    req(s, 'issueId', p, 'string');
    req(s, 'heading', p, 'string');
    req(s, 'body', p, 'string');
    req(s, 'cites', p, 'array');
  });
  return msg;
}

/** 文书里出现的每个 issueId 必须来自争点清单，且不能漏掉争点 */
export function validateDraftCoverage(draft, analysis) {
  const want = new Set((analysis.issues || []).map((i) => i.id));
  const got = new Set((draft.sections || []).map((s) => s.issueId));
  const missing = [...want].filter((id) => !got.has(id));
  const extra = [...got].filter((id) => !want.has(id));
  if (missing.length || extra.length) {
    throw new ProtocolError(
      'DraftResult.sections',
      `争点覆盖不完整 —— 漏写:[${missing.join(',')}] 多余:[${extra.join(',')}]`,
    );
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* ④ 质检 Agent 的产出：质检裁决                                         */
/* ------------------------------------------------------------------ */

/**
 * 质检 Agent 是这条链路存在的理由。
 * 它的 verdict 只能是三类，且任何非 pass 都必须指出具体位置与原因 ——
 * "我觉得不太好"不是可执行的质检意见。
 */
export const VERDICTS = ['pass', 'revise', 'reject'];

export function validateQc(msg) {
  const P = 'QcResult';
  req(msg, 'caseId', P, 'string');
  const verdict = req(msg, 'verdict', P, 'string');
  if (!VERDICTS.includes(verdict)) {
    throw new ProtocolError(`${P}.verdict`, `须为 ${VERDICTS.join('|')}，实得 ${verdict}`);
  }
  const findings = req(msg, 'findings', P, 'array');
  findings.forEach((f, i) => {
    const p = `${P}.findings[${i}]`;
    req(f, 'severity', p, 'string');
    if (!['blocker', 'major', 'minor'].includes(f.severity)) {
      throw new ProtocolError(`${p}.severity`, `未知级别 ${f.severity}`);
    }
    req(f, 'issueId', p, 'string');
    req(f, 'problem', p, 'string');
    req(f, 'fix', p, 'string');
  });

  // 一致性：裁决必须与发现的问题级别自洽，否则裁决就是随口给的
  const hasBlocker = findings.some((f) => f.severity === 'blocker');
  const hasAny = findings.length > 0;
  if (verdict === 'pass' && hasAny) {
    throw new ProtocolError(`${P}.verdict`, 'verdict=pass 但存在 findings，裁决自相矛盾');
  }
  if (verdict !== 'pass' && !hasAny) {
    throw new ProtocolError(`${P}.verdict`, `verdict=${verdict} 但没有任何 findings，无法执行`);
  }
  if (verdict === 'reject' && !hasBlocker) {
    throw new ProtocolError(`${P}.verdict`, 'verdict=reject 必须至少有一条 blocker');
  }

  return msg;
}

/* ------------------------------------------------------------------ */
/* 最小上下文：每个 Agent 只看它该看的字段                                */
/* ------------------------------------------------------------------ */

/**
 * 这些投影函数落实了"每个 Agent 只拿自己需要的最小上下文"。
 * 直接把上游**整份**消息丢给下游是最省事的做法，但会让下游的注意力
 * 被它用不到的字段稀释（例如写作 Agent 不需要 relevance 分数）。
 */
export const INPUT_SCHEMA = {
  analyst: (retrieval) => ({
    caseId: retrieval.caseId,
    query: retrieval.query,
    materials: (retrieval.materials || []).map((m) => ({
      id: m.id,
      kind: m.kind,
      source: m.source,
      locator: m.locator,
      quote: m.quote,
    })),
  }),

  writer: (analysis) => ({
    caseId: analysis.caseId,
    issues: (analysis.issues || []).map((i) => ({
      id: i.id,
      question: i.question,
      rule: i.rule,
      application: i.application,
      conclusion: i.conclusion,
      cites: i.cites,
    })),
  }),

  // 质检 Agent 反而需要全量：它的职责就是交叉核对，
  // 少给它字段等于让它无法发现那类错误。
  qc: (retrieval, analysis, draft) => ({ retrieval, analysis, draft }),
};

/* ------------------------------------------------------------------ */
/* 案例定义                                                             */
/* ------------------------------------------------------------------ */

export function validateCase(c) {
  const P = 'Case';
  req(c, 'id', P, 'string');
  req(c, 'title', P, 'string');
  req(c, 'facts', P, 'string');
  const questions = req(c, 'questions', P, 'array');
  if (questions.length === 0) {
    throw new ProtocolError(`${P}.questions`, '至少需要一个待决问题');
  }
  return c;
}
