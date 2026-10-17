/**
 * 四个专职 Agent 的实现。
 *
 * 设计要点：每个 Agent 是纯函数 `input(结构化) -> output(结构化)`。
 *
 * 这里采用**确定性规则引擎**而非 LLM 调用，理由是：
 *  1. 可离线、可复现地跑通整条链路 —— 多 Agent 编排的难点在编排与协议，
 *     不在单步智能；把模型调用混进来会让编排 bug 与模型不确定性纠缠在一起。
 *  2. 质检必须有确定性基线。若四个 Agent 都是 LLM，"质检 Agent 是否真的在挑错"
 *     就无从验证。
 *  3. 接口已经定好，接 LLM 只是替换这四个函数的实现，编排器一行都不用改
 *     （见 lib/llm-agents.mjs）。
 */

import { search, getMaterial } from '../lib/corpus.mjs';

const uniq = (xs) => [...new Set(xs)];

/* ------------------------------------------------------------------ */
/* ① 检索 Agent                                                         */
/* ------------------------------------------------------------------ */

/**
 * 输入：Case（含 facts 与 questions）
 * 输出：RetrievalResult（materials 数组，每条带 source / locator / quote）
 *
 * 关键约束：材料**只能**来自本地语料库，Agent 不生成条文。
 * 因此产出天然不可能编造案号 —— 这是把"不许编造"做成结构保证，而非提示词叮嘱。
 */
/**
 * 核心条款保底表。
 *
 * 为什么需要它（第六个真实 bug）：
 * 检索按 n-gram 命中**数量**打分，于是"措辞上恰好撞词多"的条文会压过
 * "主题上更核心"的条文 —— 实测中 S-78（信息披露"真实、准确、完整"这一
 * 基本要求条款）因与 Q1 字面重合少而落榜，导致分析 Agent 只能退化输出
 * "以检索所得信息披露规范作为定性依据"这种没有指向的空话。
 *
 * 这不是检索打分的错，而是**职责错配**：判断"哪些条款是某类争点的核心依据"
 * 属于领域知识，不该交给一个通用的字面相似度函数去碰运气。
 * 所以这里把领域知识显式写下来。
 *
 * ★ 领域判据必须用**有区分度**的术语（第七个真实 bug）：
 * 初版把"赔偿""程序"这类通用词也放进 pattern，结果"宅基地纠纷…主张精神损害赔偿"
 * 命中了投资者保护域，把一个与证券法无关的案件硬拉进了材料集。
 * 判据：一个词若在法律语境中普遍出现（赔偿、程序、责任、董事），它就**不能**
 * 单独作为领域归属的依据；只有离开该领域就几乎不用的术语（先行赔付、代表人诉讼、
 * 当事人承诺、虚假陈述）才算。
 */
const CORE_PROVISIONS = [
  { topic: /虚假陈述|信息披露|未披露|误导性陈述|虚假记载|重大遗漏|定期报告|临时报告/, ids: ['S-78', 'S-85', 'S-197'] },
  { topic: /控股股东|实际控制人|董监高|高级管理人员|连带赔偿|保荐人|承销的证券公司/, ids: ['S-85', 'C-180'] },
  { topic: /先行赔付|代表人诉讼|投资者保护机构|虚假陈述.{0,6}民事赔偿|证券民事赔偿/, ids: ['S-93', 'S-95'] },
  { topic: /行政处罚|从轻|减轻处罚|不予处罚|听证|过罚相当|当事人承诺|行政复议/, ids: ['X-5', 'X-32', 'X-33', 'X-44'] },
  { topic: /当事人承诺|执法和解|终止案件调查/, ids: ['K-4', 'K-3'] },
];

/** 案件整体是否落在某个主题域内（用事实+全部争点拼成的文本判断） */
function collectCoreIds(legalCase) {
  const all = `${legalCase.facts} ${legalCase.questions.map((q) => q.text).join(' ')}`;
  const ids = new Set();
  for (const { topic, ids: coreIds } of CORE_PROVISIONS) {
    if (topic.test(all)) for (const id of coreIds) ids.add(id);
  }
  return ids;
}

export function createRetriever({ limitPerQuestion = 6, globalCap = 14 } = {}) {
  return async function retriever(legalCase) {
    const hits = new Map(); // id -> {material, score, questionIds}

    /**
     * 按**每个争点**分别取 top-k，而不是把所有争点的命中混在一起排序后取全局 top-N。
     *
     * 这个区别是本项目踩过的第二个真实 bug：
     * 全局排序时，某个高热度争点会挤占全局名额，把另一争点的关键材料
     * （如责任主体条款 S-85）挤出榜单，导致分析 Agent 因缺材料而
     * **静默跳过整个争点** —— 程序不报错，但意见书漏掉了一个核心问题。
     * 这类"静默漏项"在法律工作里最危险。
     *
     * 按争点配额后，每个争点都保证有自己的材料，谁也挤不掉谁。
     */
    const perQuestion = [];
    for (const q of legalCase.questions) {
      const list = search(q.text, { limit: limitPerQuestion });
      perQuestion.push({ qid: q.id, list });
      for (const { material, score } of list) {
        const prev = hits.get(material.id);
        if (!prev) {
          hits.set(material.id, { material, score, questionIds: new Set([q.id]) });
        } else {
          // 同一条材料被多个争点命中时累加分数（说明它确实更核心）
          prev.score += score * 0.5;
          prev.questionIds.add(q.id);
        }
      }
    }

    // 事实本身也检索一遍，但权重压低（事实是背景，争点才是主线）
    for (const { material, score } of search(legalCase.facts, { limit: limitPerQuestion })) {
      const prev = hits.get(material.id);
      if (!prev) {
        hits.set(material.id, { material, score: score * 0.5, questionIds: new Set(['__facts__']) });
      } else {
        prev.score += score * 0.25;
      }
    }

    const ranked = [...hits.values()].sort((a, b) => b.score - a.score);
    let top = ranked.slice(0, globalCap);
    const maxScore = top[0]?.score || 1;

    /**
     * 核心条款保底：把案件所属主题域的核心条款补进材料集。
     *
     * 只补"确实存在于语料库"且"未被字面检索召到"的那些，并给它们
     * maxScore 的 0.92 倍权重 —— 足够高以进入材料集，但不凌驾于
     * 真正字面命中的条款之上（后者仍是更强的相关证据）。
     */
    const coreIds = collectCoreIds(legalCase);
    const present = new Set(top.map((h) => h.material.id));
    const injected = [];
    for (const id of coreIds) {
      if (present.has(id)) continue;
      const material = getMaterial(id);
      if (!material) continue;
      injected.push({ material, score: maxScore * 0.92, questionIds: new Set(['__core__']), isCore: true });
    }
    if (injected.length) {
      // 保底条款与已召回的合并后重新排序，保持 relevance 单调
      top = [...top, ...injected].sort((a, b) => b.score - a.score);
    }

    const materials = top.map(({ material, score, isCore }) => ({
      id: material.id,
      kind: material.kind,
      source: material.source,
      locator: material.locator,
      quote: material.quote,
      // relevance 归一到 0..1，让下游能比较"哪条更相关"
      relevance: Number(Math.min(1, score / maxScore).toFixed(3)),
      // 标记是保底补入还是字面命中 —— 让下游能区分证据强度，不混淆两者
      ...(isCore ? { viaCoreProvision: true } : {}),
    }));

    const result = {
      caseId: legalCase.id,
      query: uniq(legalCase.questions.map((q) => q.text)).join(' | '),
      materials,
      coverage: perQuestion.map(({ qid, list }) => ({ questionId: qid, hits: list.length })),
      coreProvisionsInjected: injected.map((i) => i.material.id),
      retrievedAt: new Date().toISOString(),
    };

    if (materials.length === 0) {
      // 显式声明零结果，而不是交给下游去猜
      result.noResultReason = '本地语料库未命中任何与案件事实/争点相关的条文或案例';
    } else {
      // 记录哪些争点一条材料都没检到 —— 这些争点注定无法分析，必须显式暴露
      const starved = perQuestion.filter((p) => p.list.length === 0).map((p) => p.qid);
      if (starved.length) result.starvedQuestions = starved;
    }

    return result;
  };
}

/* ------------------------------------------------------------------ */
/* ② 分析 Agent（IRAC）                                                 */
/* ------------------------------------------------------------------ */

/**
 * 输入：RetrievalResult 的**最小投影**（只有 id/kind/source/locator/quote）
 * 输出：AnalysisResult（issues 数组，每条 Issue-Rule-Application-Conclusion）
 *
 * 注意它拿不到 relevance 分数 —— 那对论证没有用，
 * 给了只会让分析 Agent 误以为"分数高就等于论证强"。
 */
export function createAnalyst() {
  return async function analyst(retrieval) {
    const byId = new Map((retrieval.materials || []).map((m) => [m.id, m]));

    const issues = [];

    // 争点 1：行为定性 —— 是否有可归责的违法行为
    const 定性依据 = ['S-78', 'S-197', 'S-181'].filter((id) => byId.has(id));
    if (定性依据.length) {
      const has基本要求 = byId.has('S-78');
      issues.push({
        id: 'I1',
        question: '涉案信息披露行为是否构成证券法上的虚假陈述或未按规定披露，从而具备可归责性？',
        rule: has基本要求
          ? `${byId.get('S-78').source}${byId.get('S-78').locator}确立真实、准确、完整的基本要求；` +
            `${byId.get('S-197')?.source ?? ''}${byId.get('S-197')?.locator ?? ''}规定未履行披露义务的法律后果。`
          : '以检索所得信息披露规范作为定性依据。',
        application:
          '须逐项比对涉案披露文件与上述"真实、准确、完整"要求的偏离程度，' +
          '并区分系积极作为（虚假记载、误导性陈述）还是消极不作为（未披露）。' +
          '两者在归责路径与举证结构上并不相同，不可合并论证。',
        conclusion: '在事实得到确认的前提下，可认定存在证券法项下的信息披露违法，具备可归责性。',
        cites: 定性依据,
        confidence: 定性依据.length >= 2 ? 0.82 : 0.6,
      });
    }

    // 争点 2：责任主体范围
    const 主体依据 = ['S-85', 'C-180'].filter((id) => byId.has(id));
    if (主体依据.length) {
      issues.push({
        id: 'I2',
        question: '责任主体范围如何界定？控股股东、实际控制人、董监高与中介机构各自承担何种责任？',
        rule:
          `${byId.get('S-85')?.source ?? ''}${byId.get('S-85')?.locator ?? ''}采过错推定：` +
          '相关主体应与发行人承担连带赔偿责任，但能证明自己没有过错的除外；' +
          `${byId.has('C-180') ? byId.get('C-180').source + byId.get('C-180').locator + '同时确立董监高的忠实与勤勉义务。' : ''}`,
        application:
          '对每一名拟追责主体，须分别考察其职责范围、是否知悉、有无尽到合理注意，' +
          '不能以"公司违法"整体推定个人责任。举证责任在被告一方，这是本条最有利的结构。',
        conclusion: '责任主体须逐一认定；被告方应主张"无过错"抗辩，该抗辩的举证负担在被告。',
        cites: 主体依据,
        confidence: 0.78,
      });
    }

    // 争点 3：投资者民事救济路径
    const 救济依据 = ['S-93', 'S-95', 'K-2'].filter((id) => byId.has(id));
    if (救济依据.length) {
      issues.push({
        id: 'I3',
        question: '受损投资者可通过何种路径获得民事赔偿？先行赔付与代表人诉讼如何衔接？',
        rule:
          `${byId.has('S-93') ? byId.get('S-93').source + byId.get('S-93').locator + '允许先行赔付并保留追偿权；' : ''}` +
          `${byId.has('S-95') ? byId.get('S-95').source + byId.get('S-95').locator + '规定特别代表人诉讼；' : ''}` +
          // 引用司法解释时必须带**文件名**，不能只写条号 ——
          // 只写"第四条第（一）项"会被误读成《证券法》第四条（实测输出中出现过这个歧义）。
          `${byId.has('K-2') ? byId.get('K-2').source + byId.get('K-2').locator + '确立交易因果关系的推定规则。' : ''}`,
        application:
          '投资者侧应先评估交易因果关系能否成立（该要件由被告反证推翻），' +
          '再据受损规模选择单独诉讼、普通代表人诉讼或特别代表人诉讼；' +
          '存在先行赔付安排时，须注意其与后续诉讼的关系及追偿路径。',
        conclusion: '投资者具备多层次救济路径；特别代表人诉讼在人数众多时具有显著效率优势。',
        cites: 救济依据,
        confidence: 0.75,
      });
    }

    // 争点 4：行政处罚裁量与程序
    const 裁量依据 = ['X-5', 'X-32', 'X-33', 'X-44'].filter((id) => byId.has(id));
    if (裁量依据.length) {
      issues.push({
        id: 'I4',
        question: '行政处罚的裁量因素与正当程序要求为何？当事人有无从轻、减轻或不予处罚的空间？',
        rule:
          `${byId.has('X-5') ? byId.get('X-5').source + byId.get('X-5').locator + '确立过罚相当原则；' : ''}` +
          `${byId.has('X-32') ? byId.get('X-32').locator + '列举应当从轻或减轻的情形；' : ''}` +
          `${byId.has('X-33') ? byId.get('X-33').locator + '规定轻微不罚与无过错不罚；' : ''}` +
          `${byId.has('X-44') ? byId.get('X-44').locator + '要求事先告知并保障陈述申辩权。' : ''}`,
        application:
          '应先审查程序合法性（是否事先告知、是否保障申辩与听证权利），程序瑕疵本身即为独立的撤销事由；' +
          '再就实体裁量，围绕主动消除后果、配合查处、首次违法等法定情形主张从轻或减轻。' +
          '程序审查优先于实体抗辩，这是实务中经常被忽略的顺序。',
        conclusion: '存在多个可主张的从轻/减轻事由，且程序合法性审查应作为第一顺位抗辩。',
        cites: 裁量依据,
        confidence: 0.8,
      });
    }

    // 争点 5：执法和解（当事人承诺制度）
    const 承诺依据 = ['K-4', 'K-3', 'D-1'].filter((id) => byId.has(id));
    if (承诺依据.length >= 2) {
      issues.push({
        id: 'I5',
        question: '本案是否适用证券期货行政执法当事人承诺制度？其适用边界与风险为何？',
        rule:
          `${byId.get('K-4').source}${byId.get('K-4').locator}界定当事人承诺制度的构成与适用条件，` +
          '并以"涉嫌犯罪应当移送司法机关"为排除情形。',
        application:
          '须先判断案件是否触及刑事移送门槛 —— 一旦触碰即不适用，这是前置性排除条件。' +
          '在可用前提下，评估承诺的可行性取决于赔偿投资者损失的金额与及时性、整改完备性等执法机关考量因素，' +
          '同时应警惕制度被质疑为"以钱买罚"而削弱威慑的正当性风险。',
        conclusion: '当事人承诺制度在未触及刑事移送时可适用，但须权衡执法效率与威慑减损。',
        cites: 承诺依据,
        confidence: 0.7,
      });
    }

    return { caseId: retrieval.caseId, issues };
  };
}

/* ------------------------------------------------------------------ */
/* ③ 写作 Agent                                                        */
/* ------------------------------------------------------------------ */

/**
 * 输入：AnalysisResult 的最小投影 + 上一轮质检反馈（回环时才有）
 * 输出：DraftResult（sections 数组，每个 secion 对应一个争点）
 *
 * feedback 参数是"打回上一环节"真正落地的地方：
 * 被要求重写时，写作 Agent 看得到**具体要改什么**，
 * 而不是盲改一遍碰运气。
 */
export function createWriter() {
  return async function writer({ analysis, feedback = null }) {
    const fixesByIssue = new Map();
    if (feedback?.findings) {
      for (const f of feedback.findings) {
        if (!fixesByIssue.has(f.issueId)) fixesByIssue.set(f.issueId, []);
        fixesByIssue.get(f.issueId).push(f);
      }
    }

    const sections = analysis.issues.map((issue) => {
      const needFix = fixesByIssue.get(issue.id) || [];

      // 基础正文：IRAC 四段
      let body =
        `【规则】${issue.rule}\n\n` +
        `【适用】${issue.application}\n\n` +
        `【结论】${issue.conclusion}`;

      // 若被质检打回，显式加入"补正说明"段 —— 这让修订可被追溯
      if (needFix.length > 0) {
        const notes = needFix.map((f) => `- （${f.severity}）${f.problem} → 已处理：${f.fix}`).join('\n');
        body += `\n\n【依据质检意见的补正】\n${notes}`;
        // 低置信度争点在补正时显式标注保留意见，不假装问题已消失
        if (issue.confidence < 0.75) {
          body += '\n- 保留意见：本争点置信度偏低，补正后仍建议由承办律师复核原始材料。';
        }
      } else if (issue.confidence < 0.7) {
        body += '\n\n【保留意见】本争点论证置信度偏低，建议补充材料后再定稿。';
      }

      return {
        issueId: issue.id,
        heading: issue.question,
        body,
        cites: issue.cites,
      };
    });

    return {
      caseId: analysis.caseId,
      title: '法律分析意见书',
      sections,
      revision: feedback ? 'reworked' : 'initial',
      generatedAt: new Date().toISOString(),
    };
  };
}

/* ------------------------------------------------------------------ */
/* ④ 质检 Agent                                                        */
/* ------------------------------------------------------------------ */

/**
 * 输入：全量（retrieval + analysis + draft）—— 交叉核对需要全景
 * 输出：QcResult（verdict + findings）
 *
 * 这是四个 Agent 里唯一被赋予**否决权**的。
 * 它检查的是三类问题，逐类对应一种真实的失败模式：
 *   A. 引用完整性 —— 引用的材料是否真实存在（防编造）
 *   B. 论证充分性 —— 结论是否真的由规则推出（防跳跃）
 *   C. 覆盖完整性 —— 是否回应了全部争点（防漏项）
 */
export function createQc() {
  return async function qc({ retrieval, analysis, draft }) {
    const findings = [];
    const knownIds = new Set((retrieval.materials || []).map((m) => m.id));

    /* --- A. 引用完整性 --- */
    for (const issue of analysis.issues || []) {
      for (const c of issue.cites || []) {
        if (!knownIds.has(c)) {
          findings.push({
            severity: 'blocker',
            issueId: issue.id,
            problem: `引用了检索结果中不存在的材料 ${c}，该引用无法核验`,
            fix: `删除该引用或改引检索结果中真实存在的材料（可用：${[...knownIds].join('、')}）`,
          });
        }
      }
      // cites 非空是协议保证的，但材料本身若与争点无关，也是问题
      const cites = (issue.cites || []).filter((c) => knownIds.has(c));
      if (cites.length === 0) {
        findings.push({
          severity: 'blocker',
          issueId: issue.id,
          problem: '该争点没有任何可核验的材料支撑',
          fix: '补充检索或撤回该争点',
        });
      }
    }

    /* --- B. 论证充分性 --- */
    for (const issue of analysis.issues || []) {
      // 结论不可是空话
      if (!issue.conclusion || issue.conclusion.trim().length < 8) {
        findings.push({
          severity: 'major',
          issueId: issue.id,
          problem: '结论过于笼统，未给出可执行的判断',
          fix: '把结论改写为对具体问题的明确回答',
        });
      }
      // 置信度过低必须显式标注，否则等于隐藏不确定性
      if (typeof issue.confidence === 'number' && issue.confidence < 0.6) {
        findings.push({
          severity: 'major',
          issueId: issue.id,
          problem: `争点置信度仅 ${issue.confidence}，低于可交付阈值 0.6`,
          fix: '补充材料以提高论证强度，或在文书中明示为待核实事项',
        });
      }
      // 规则段不得为空 —— 无规则的适用是无源之水
      if (!issue.rule || issue.rule.trim().length < 10) {
        findings.push({
          severity: 'blocker',
          issueId: issue.id,
          problem: '缺少规则依据（Rule），无法构成完整 IRAC',
          fix: '补充所依据的法条或案例',
        });
      }
    }

    /* --- C. 覆盖完整性 --- */
    const draftIssueIds = new Set((draft.sections || []).map((s) => s.issueId));
    for (const issue of analysis.issues || []) {
      if (!draftIssueIds.has(issue.id)) {
        findings.push({
          severity: 'blocker',
          issueId: issue.id,
          problem: '该争点在文书中未被回应（漏项）',
          fix: '在文书中补充对应章节',
        });
      }
    }
    // 文书里的引用必须 ⊆ 争点的引用，防止写作环节自行加引
    for (const sec of draft.sections || []) {
      const issue = (analysis.issues || []).find((i) => i.id === sec.issueId);
      if (!issue) continue;
      const extra = (sec.cites || []).filter((c) => !(issue.cites || []).includes(c));
      if (extra.length) {
        findings.push({
          severity: 'major',
          issueId: sec.issueId,
          problem: `文书章节新增了争点中未出现的引用 [${extra.join('、')}]，可能引入未经分析的材料`,
          fix: '移除该引用，或回到分析环节将其纳入该争点的 cites',
        });
      }
    }

    /* --- 裁决 --- */
    let verdict;
    if (findings.length === 0) {
      verdict = 'pass';
    } else if (findings.some((f) => f.severity === 'blocker')) {
      // 有 blocker 分两种情况：材料缺失属不可修复，其余可回环重写
      const unfixable = findings.some(
        (f) => f.severity === 'blocker' && f.problem.includes('没有任何可核验的材料支撑'),
      );
      verdict = unfixable ? 'reject' : 'revise';
    } else {
      verdict = 'revise';
    }

    return {
      caseId: analysis.caseId,
      verdict,
      checkedAt: new Date().toISOString(),
      checks: {
        citations: 'A. 引用完整性',
        sufficiency: 'B. 论证充分性',
        coverage: 'C. 覆盖完整性',
      },
      findings,
    };
  };
}

export { getMaterial };
