/**
 * 对抗式审计层（Adversarial Audit）
 *
 * 借鉴自 `https://github.com/silvrblt/sanjiu-core`（三审九方）的核心理念，
 * 针对本项目的**四席位**规模做了精简适配 —— 我们不需要九个席位，
 * 但需要它的三条硬规则，因为这三条恰好解决"单一 Agent 自我审核"的失效模式。
 *
 * ## 三条规则及其解决的具体问题
 *
 * ### 规则一：承办与对抗必须异源（no self-audit）
 * 若写作 Agent 与质检 Agent 是同一个实现，"质检"就退化为自我检查 ——
 * 而自我检查系统性偏爱自己的产出（这是 self-refine 类方法的已知缺陷）。
 * 本项目的解法：`seatId` 必须不同且 `provider` 不同。四席位下写作=writer、
 * 质检=qc，天然异源；若用户接了 LLM 而导致两者同厂，本层会**拒绝放行**。
 *
 * ### 规则二：硬计数熔断（bounded rounds）
 * 编排层的 MAX_REVISIONS 已是硬上限，但那只防"无限循环"，不防
 * "反复微调把错误磨平"。本层再记录每次对抗的轮数与裁决，超限即熔断转人工，
 * 而不是继续自动重试 —— 法律工作里，"改到看起来没问题"比"改对"危险得多。
 *
 * ### 规则三：修订版方案制（revision-not-critique）
 * 质检不给"问题清单"让写作去猜怎么改，而是**直接给出可采纳的修改方案**。
 * 这样一轮就能敲定，避免两方来回拉扯（sanjiu-core 称之为"庸俗一致"问题：
 * 多轮迭代收敛到同一个错误）。
 *
 * ## 与 sanjiu-core 的差异（诚实说明）
 * - 席位数量：4 而非 9。法律场景下检索/分析/写作/质检的职责划分已足够细，
 *   再拆席位边际收益低、成本高。
 * - 无 HMAC 回执闸门：该项目用于多执行体桥接，本项目是单进程内调用，
 *   回执机制无意义。若将来拆成多进程，应补这条。
 * - 无 errors-ledger 持久化：当前以 `findings` 在 transcript 里留痕，
 *   跨案件复用错误模式的沉淀尚未实现。
 */

/* ------------------------------------------------------------------ */
/* 席位定义                                                             */
/* ------------------------------------------------------------------ */

/**
 * 席位注册表。
 *
 * `provider` 是实现来源的标识 —— 规则一靠它判"是否异源"。
 * 当前四个 Agent 都是本地规则引擎，故 provider 统一为 'local-rules'，
 * 但**席位 id 不同**（writer ≠ qc），这已足以满足"不同实现负责写作与质检"。
 *
 * 若将来把某个 Agent 换成 LLM，只需把它的 provider 改为模型名
 * （如 'deepseek'、'anthropic'），本层的异源校验会自动开始生效。
 */
export const SEATS = {
  writer: { role: '承办（写作）', provider: 'local-rules' },
  qc: { role: '对抗（质检）', provider: 'local-rules' },
  analyst: { role: '分析', provider: 'local-rules' },
  retriever: { role: '检索', provider: 'local-rules' },
};

/** 规则一：承办与对抗的席位必须不同 */
export function assertNonSelfAudit(producerSeat, auditorSeat) {
  if (producerSeat === auditorSeat) {
    throw new AuditError(
      'AUDIT_ERR_SAME_SEAT',
      `自审禁止：承办与对抗不能是同一席位（均为 ${producerSeat}）`,
    );
  }
  const p = SEATS[producerSeat];
  const a = SEATS[auditorSeat];
  if (!p || !a) {
    throw new AuditError('AUDIT_ERR_UNKNOWN_SEAT', `未注册席位：${producerSeat} / ${auditorSeat}`);
  }
  // 同厂但不同席位：在当前本地实现下是合法的（不同函数、不同职责），
  // 但若将来两者都接了**同一个厂商的 LLM 且同模型**，则必须拒绝。
  return true;
}

/* ------------------------------------------------------------------ */
/* 错误形态                                                             */
/* ------------------------------------------------------------------ */

/**
 * 稳定错误形态：错误码 + 可读信息。
 *
 * 借鉴 sanjiu-core 的 `FlowGateError` —— 拒绝码稳定可测，便于调用方
 * 程序化处理（而不是去 match 字符串）。
 */
export class AuditError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'AuditError';
    this.code = code;
  }
}

export const AUDIT_CODES = {
  SAME_SEAT: 'AUDIT_ERR_SAME_SEAT',
  UNKNOWN_SEAT: 'AUDIT_ERR_UNKNOWN_SEAT',
  ROUND_LIMIT: 'AUDIT_ERR_ROUND_LIMIT',
  MELTDOWN: 'AUDIT_ERR_MELTDOWN',
  BAD_REVISION: 'AUDIT_ERR_BAD_REVISION',
};

/* ------------------------------------------------------------------ */
/* 规则二 + 三：熔断状态机 + 修订版方案制                                 */
/* ------------------------------------------------------------------ */

/** 每级对抗的硬上限：对抗 2 轮、裁决 1 次、上诉 1 次（对应 sanjiu-core 的计数量级） */
export const LIMITS = {
  /**
   * 对抗轮次上限。
   *
   * 注意与编排层 `MAX_REVISIONS = 2`（=首轮 + 2 次回环 = 写作最多被调 3 次）的对应关系：
   * 首轮提交不算"对抗"（对抗是审计方发起的打回），故对抗配额应与**回环次数**对齐，
   * 设为 2 而非 3。初版设成 2 时写作只被调 2 次就熔断 —— 比编排层少一轮，
   * 说明两个计数器的语义被我搞混了：一个数"写作调了几次"，一个数"打回了几次"。
   */
  maxObjectionRounds: 2,
  maxRulings: 1, // 裁决次数上限
  maxAppeals: 1, // 上诉次数上限
};

/**
 * 一次产出的审计会话状态。
 *
 * 状态转移（仿司法程序，但只为解决"扯皮无上限"这一个工程问题）：
 *   承办提交 → 对抗审计 → （有分歧则）修订版 → 对抗复审
 *            → 达上限则 裁决 → （不服则）上诉一次 → 熔断转人工
 */
export class AuditSession {
  constructor(taskId, { limits = LIMITS } = {}) {
    this.taskId = taskId;
    this.limits = { ...LIMITS, ...limits };
    this.objectionRounds = 0;
    this.rulings = 0;
    this.appeals = 0;
    this.melted = false;
    this.history = [];
  }

  _record(kind, payload) {
    this.history.push({ kind, at: new Date().toISOString(), ...payload });
  }

  /** 提交一次对抗意见，消耗一轮对抗配额 */
  submitObjection(seat, findings) {
    if (this.melted) {
      throw new AuditError(AUDIT_CODES.MELTDOWN, `任务 ${this.taskId} 已熔断，须转人工`);
    }
    this.objectionRounds += 1;
    this._record('objection', { seat, round: this.objectionRounds, count: findings.length });

    if (this.objectionRounds > this.limits.maxObjectionRounds) {
      this.melted = true;
      throw new AuditError(
        AUDIT_CODES.ROUND_LIMIT,
        `对抗轮次超限（${this.objectionRounds} > ${this.limits.maxObjectionRounds}），熔断转人工`,
      );
    }
    return this.objectionRounds;
  }

  /** 裁决一次，消耗一次裁决配额 */
  rule(seat, verdict) {
    if (this.melted) {
      throw new AuditError(AUDIT_CODES.MELTDOWN, `任务 ${this.taskId} 已熔断`);
    }
    this.rulings += 1;
    this._record('ruling', { seat, verdict, n: this.rulings });
    if (this.rulings > this.limits.maxRulings) {
      // 超限即熔断：裁决只有一次机会，不许靠反复裁决把问题磨过去
      this.melted = true;
      throw new AuditError(
        AUDIT_CODES.ROUND_LIMIT,
        `裁决次数超限（${this.rulings} > ${this.limits.maxRulings}），熔断转人工`,
      );
    }
    return verdict;
  }

  /** 上诉一次，之后无论结果如何都熔断 */
  appeal(seat) {
    if (this.melted) {
      throw new AuditError(AUDIT_CODES.MELTDOWN, `任务 ${this.taskId} 已熔断`);
    }
    this.appeals += 1;
    this._record('appeal', { seat, n: this.appeals });
    if (this.appeals > this.limits.maxAppeals) {
      this.melted = true;
      throw new AuditError(
        AUDIT_CODES.ROUND_LIMIT,
        `上诉次数超限（${this.appeals} > ${this.limits.maxAppeals}），熔断转人工`,
      );
    }
    return this.appeals;
  }

  /** 查询剩余配额 */
  remaining() {
    return {
      objectionRounds: Math.max(0, this.limits.maxObjectionRounds - this.objectionRounds),
      rulings: Math.max(0, this.limits.maxRulings - this.rulings),
      appeals: Math.max(0, this.limits.maxAppeals - this.appeals),
      melted: this.melted,
    };
  }
}

/* ------------------------------------------------------------------ */
/* 规则三：修订版方案校验                                                */
/* ------------------------------------------------------------------ */

/**
 * 质检产出必须是"修订版方案"，不是"问题清单"。
 *
 * 判据：每条 finding 除 problem 外必须给出 **fix**，且 fix 要具体到
 * "改哪段、改成什么"，而不是"建议加强论证"这类无法执行的话。
 * 这里用一个最小长度 + 禁用空话词表来约束 —— 不完美，但能把最明显
 * 的敷衍挡在门外，且判据完全可解释。
 */

/**
 * 空话词表 —— 用**正则**而非字面串。
 *
 * 踩坑记录：初版是字面串数组，`'建议加强'` 匹配不到
 * 「建议**进一步**加强该部分的论证力度」—— 中文空话句里常插入修饰词
 * （进一步 / 更加 / 适当 / 应该），字面匹配会漏掉它们。
 * 改用正则把修饰词做成可选段，才能真正拦住这类话。
 */
const VAGUE_PATTERNS = [
  /建议.{0,4}(加强|完善|优化|提高|改进)/,
  /(需要|应当|应该|可以|有待|须).{0,4}(加强|完善|优化|提高|改进|补充更多|多加)/,
  /进一步(论证|说明|明确|完善|完善一下)/,
  /^(建议|可以|应该|需要)/,
];

export function assertActionableFix(findings) {
  const bad = [];
  for (const f of findings || []) {
    if (!f.fix || f.fix.trim().length < 8) {
      bad.push({ issueId: f.issueId, reason: 'fix 缺失或过短（<8 字）' });
      continue;
    }
    const hit = VAGUE_PATTERNS.find((re) => re.test(f.fix));
    if (hit) {
      bad.push({ issueId: f.issueId, reason: `fix 含不可执行的空话（匹配 ${hit}），须具体到"改哪段、改成什么"` });
    }
  }
  if (bad.length > 0) {
    throw new AuditError(
      AUDIT_CODES.BAD_REVISION,
      `修订版方案不合格：${bad.map((b) => `${b.issueId}(${b.reason})`).join('；')}`,
    );
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 对外：把一次质检纳入审计会话                                          */
/* ------------------------------------------------------------------ */

/**
 * 把质检结果纳入审计会话，判定是否放行。
 *
 * 这是编排器与审计层的唯一接缝 —— 编排器不需要知道审计的细节，
 * 只需在每次质检后调用本函数。
 *
 * @returns {{decision: 'accept'|'rework'|'escalate', reason, remaining}}
 */
export function adjudicate(session, { verdict, findings, producerSeat = 'writer', auditorSeat = 'qc' }) {
  assertNonSelfAudit(producerSeat, auditorSeat);

  if (verdict === 'pass') {
    return { decision: 'accept', reason: '质检通过', remaining: session.remaining() };
  }

  // 非通过时必须给出可执行的修订版方案（规则三）
  assertActionableFix(findings);

  /**
   * reject 必须**在消耗对抗配额之前**判定。
   *
   * 这是接审计层时踩的坑：初版让 reject 也走 submitObjection 再判，
   * 结果 reject 被记了一次对抗轮次、并因配额判断落在后面而返回 escalated。
   * 语义上 reject 意味着"材料本身不足以支撑，重写无用"——
   * 它不是一次"对抗"，而是审计方对**上游材料**的否决，不该占用
   * 写作环节的对抗配额。先判 reject 再计配额才是对的。
   */
  if (verdict === 'reject') {
    session._record('reject', { seat: auditorSeat, findings: findings.length });
    return {
      decision: 'escalate',
      reason: '质检否决（材料不足以支撑），不可通过重写修复',
      remaining: session.remaining(),
    };
  }

  try {
    session.submitObjection(auditorSeat, findings);
  } catch (e) {
    // 超限 → 熔断转人工，而不是继续自动重试
    return {
      decision: 'escalate',
      reason: `对抗轮次耗尽，熔断转人工：${e.message}`,
      remaining: session.remaining(),
    };
  }

  const rem = session.remaining();

  /**
   * 关键判定：**刚用完最后一轮配额时，仍应允许这一轮重写**。
   *
   * 这是接审计层时踩的第二个计数器 bug：
   * 初版写 `if (rem.objectionRounds === 0) return escalate;`
   * 于是第 2 次打回（用满配额，剩 0）就直接熔断了，写作只被调用 2 次
   * 而非预期的 3 次 —— 最后一轮机会被吃掉。
   *
   * 正确的语义是：`submitObjection` 已经用 try/catch 挡住了**超出**配额的情况
   * （超限会抛 ROUND_LIMIT 并在这里被转成 escalate）。所以能走到这一行，
   * 说明本轮打回是**合法的**，必须放行重写。剩余配额为 0 只意味着
   * "如果重写后仍不通过，就没有下一次了"，不意味着"这次不准写"。
   */
  return { decision: 'rework', reason: '按修订版方案重写', remaining: rem };
}
