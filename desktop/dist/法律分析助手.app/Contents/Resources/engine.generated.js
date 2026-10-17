/**
 * 法律分析引擎 · 打包产物（自动生成，不要手改）
 * 生成时间：2026-10-17T07:30:24.777Z
 *
 * 由 desktop/build.sh 调用 bundle-engine.mjs 生成。
 * 源文件：legal-agent/{lib/*.mjs, agents/index.mjs}
 */
(function () {
'use strict';

const __mod = {};

/* ===== corpus () ===== */
__mod['corpus'] = (() => {
let __exports = {};
/**
 * 本地法律知识库（检索语料）
 *
 * 为什么要有这个文件：
 * 法律 AI 最不可接受的失败模式是"编造法条与案号"。检索 Agent 若靠 LLM 凭空生成，
 * 产出的是看起来很像、但无法核验的条文。
 *
 * 所以这里放**真实**的条文与案例，每条自带 locator（条款号 / 案号）。
 * 检索 Agent 只能从这个集合里取材料 —— 从结构上就无法编造。
 *
 * 范围：证券法与公司法领域（使用者本人的专业方向）。
 * 每条 quote 为条文要旨摘录，非全文；locator 指向真实出处，可自行核对。
 */

const CORPUS = [
  /* ------------------------- 证券法 ------------------------- */
  {
    id: 'S-181',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第一百八十一条',
    quote:
      '在证券交易活动中作出虚假陈述或者信息误导的，责令改正，处以罚款；' +
      '属于国家工作人员的，还应当依法给予处分。',
    keywords: ['虚假陈述', '信息误导', '行政处罚', '信息披露'],
  },
  {
    id: 'S-197',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第一百九十七条',
    quote:
      '信息披露义务人未按照本法规定报送有关报告或者履行信息披露义务的，责令改正，' +
      '给予警告，并处以罚款；对直接负责的主管人员和其他直接责任人员给予警告，并处以罚款。',
    keywords: ['信息披露', '未按规定报送', '信息披露义务人', '警告', '罚款'],
  },
  {
    id: 'S-85',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第八十五条',
    quote:
      '信息披露义务人未按照规定披露信息，或者公告的证券发行文件、定期报告、' +
      '临时报告及其他信息披露资料存在虚假记载、误导性陈述或者重大遗漏，' +
      '致使投资者在证券交易中遭受损失的，信息披露义务人应当承担赔偿责任；' +
      '发行人的控股股东、实际控制人、董事、监事、高级管理人员和其他直接责任人员' +
      '以及保荐人、承销的证券公司及其直接责任人员，应当与发行人承担连带赔偿责任，' +
      '但是能够证明自己没有过错的除外。',
    keywords: ['虚假记载', '误导性陈述', '重大遗漏', '连带赔偿责任', '过错推定'],
  },
  {
    id: 'S-78',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第七十八条',
    quote:
      '信息披露义务人披露的信息，应当真实、准确、完整，简明清晰，通俗易懂，' +
      '不得有虚假记载、误导性陈述或者重大遗漏。',
    keywords: ['真实准确完整', '信息披露基本要求', '虚假记载'],
  },
  {
    id: 'S-170',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第一百七十条',
    quote:
      '国务院证券监督管理机构依法履行职责，有权采取下列措施：……' +
      '（含）查询当事人和与被调查事件有关的单位和个人的资金账户、证券账户……',
    keywords: ['证监会职权', '调查措施', '资金账户'],
  },
  {
    id: 'S-220',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第二百二十条',
    quote:
      '违反本法规定，应当承担民事赔偿责任和缴纳罚款、罚金，' +
      '其财产不足以支付的，优先用于承担民事赔偿责任。',
    keywords: ['民事赔偿优先', '罚款', '罚金', '财产不足'],
  },
  {
    id: 'S-171',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第一百七十一条',
    quote:
      '当事人对证券监督管理机构或者国务院授权的部门的处罚决定不服的，' +
      '可以依法申请行政复议，或者依法直接向人民法院提起诉讼。',
    keywords: ['行政复议', '行政诉讼', '救济途径', '处罚决定不服'],
  },
  {
    id: 'S-93',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第九十三条',
    quote:
      '发行人因欺诈发行、虚假陈述或者其他重大违法行为给投资者造成损失的，' +
      '发行人的控股股东、实际控制人、相关的证券公司可以委托投资者保护机构，' +
      '就赔偿事宜与受到损失的投资者达成协议，予以先行赔付。' +
      '先行赔付后，可以依法向发行人以及其他连带责任人追偿。',
    keywords: ['先行赔付', '投资者保护机构', '追偿', '欺诈发行'],
  },
  {
    id: 'S-95',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第九十五条',
    quote:
      '投资者提起虚假陈述等证券民事赔偿诉讼时，诉讼标的是同一种类，' +
      '且当事人一方人数众多的，可以依法推选代表人进行诉讼。' +
      '……投资者保护机构受五十名以上投资者委托，可以作为代表人参加诉讼。',
    keywords: ['代表人诉讼', '特别代表人诉讼', '虚假陈述民事赔偿', '投资者保护机构'],
  },
  {
    id: 'S-24',
    kind: 'statute',
    source: '《中华人民共和国证券法》（2019 修订）',
    locator: '第二十四条',
    quote:
      '国务院证券监督管理机构或者国务院授权的部门对已作出的证券发行注册的决定，' +
      '发现不符合法定条件或者法定程序的，应当予以撤销。' +
      '……已经发行尚未上市的，撤销注册决定，发行人应当按照发行价并加算银行同期存款利息返还证券持有人。',
    keywords: ['撤销注册', '返还', '发行价', '存款利息'],
  },

  /* ------------------------- 行政法与程序 ------------------------- */
  {
    id: 'X-5',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第五条',
    quote:
      '行政处罚遵循公正、公开的原则。' +
      '设定和实施行政处罚必须以事实为依据，与违法行为的事实、性质、情节以及社会危害程度相当。',
    keywords: ['过罚相当', '公正公开', '处罚原则', '裁量基准'],
  },
  {
    id: 'X-32',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第三十二条',
    quote:
      '当事人有下列情形之一，应当从轻或者减轻行政处罚：' +
      '（一）主动消除或者减轻违法行为危害后果的；（二）受他人胁迫或者诱骗实施违法行为的；' +
      '（三）主动供述行政机关尚未掌握的违法行为的；（四）配合行政机关查处违法行为有立功表现的；' +
      '（五）法律、法规、规章规定其他应当从轻或者减轻行政处罚的。',
    keywords: ['从轻', '减轻', '主动消除后果', '立功', '配合查处'],
  },
  {
    id: 'X-33',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第三十三条',
    quote:
      '违法行为轻微并及时改正，没有造成危害后果的，不予行政处罚。' +
      '初次违法且危害后果轻微并及时改正的，可以不予行政处罚。' +
      '当事人有证据足以证明没有主观过错的，不予行政处罚。' +
      '对当事人的违法行为依法不予行政处罚的，行政机关应当对当事人进行教育。',
    keywords: ['不予处罚', '轻微', '及时改正', '无主观过错', '首违不罚'],
  },
  {
    id: 'X-44',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第四十四条',
    quote:
      '行政机关在作出行政处罚决定之前，应当告知当事人拟作出的行政处罚内容及事实、理由、依据，' +
      '并告知当事人依法享有的陈述、申辩、要求听证等权利。',
    keywords: ['事先告知', '陈述申辩', '听证', '正当程序'],
  },
  {
    id: 'X-63',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第六十三条',
    quote:
      '行政机关拟作出下列行政处罚决定，应当告知当事人有要求听证的权利，' +
      '当事人要求听证的，行政机关应当组织听证：' +
      '（一）较大数额罚款；（二）没收较大数额违法所得、没收较大价值非法财物；' +
      '（三）降低资质等级、吊销许可证件；（四）责令停产停业、责令关闭、限制从业；……',
    keywords: ['听证', '较大数额罚款', '吊销', '限制从业'],
  },
  {
    id: 'X-86',
    kind: 'statute',
    source: '《中华人民共和国行政处罚法》（2021 修订）',
    locator: '第八十六条',
    quote: '违法行为在二年内未被发现的，不再给予行政处罚；涉及公民生命健康安全、金融安全且有危害后果的，上述期限延长至五年。法律另有规定的除外。',
    keywords: ['追责时效', '二年', '五年', '金融安全'],
  },

  /* ------------------------- 公司法 ------------------------- */
  {
    id: 'C-180',
    kind: 'statute',
    source: '《中华人民共和国公司法》（2023 修订）',
    locator: '第一百八十条',
    quote:
      '董事、监事、高级管理人员对公司负有忠实义务，应当采取措施避免自身利益与公司利益冲突，' +
      '不得利用职权牟取不正当利益。董事、监事、高级管理人员对公司负有勤勉义务，' +
      '执行职务应当为公司的最大利益尽到管理者通常应有的合理注意。',
    keywords: ['忠实义务', '勤勉义务', '董监高', '利益冲突'],
  },
  {
    id: 'C-188',
    kind: 'statute',
    source: '《中华人民共和国公司法》（2023 修订）',
    locator: '第一百八十八条',
    quote:
      '董事、监事、高级管理人员执行职务违反法律、行政法规或者公司章程的规定，' +
      '给公司造成损失的，应当承担赔偿责任。',
    keywords: ['赔偿责任', '违反章程', '执行职务', '公司损失'],
  },
  {
    id: 'C-191',
    kind: 'statute',
    source: '《中华人民共和国公司法》（2023 修订）',
    locator: '第一百九十一条',
    quote:
      '董事、高级管理人员执行职务，给他人造成损害的，公司应当承担赔偿责任；' +
      '董事、高级管理人员存在故意或者重大过失的，也应当承担赔偿责任。',
    keywords: ['对第三人责任', '故意', '重大过失', '董高'],
  },

  /* ------------------------- 司法案例 ------------------------- */
  {
    id: 'K-1',
    kind: 'case',
    source: '最高人民法院指导性案例',
    locator: '指导案例 24 号（荣宝英诉王阳等案）',
    quote:
      '裁判要点：证券虚假陈述责任纠纷中，虚假陈述实施日、揭露日、基准日的认定，' +
      '应结合信息披露义务人的公告情况与市场反应综合判断。',
    keywords: ['虚假陈述', '实施日', '揭露日', '基准日', '因果关系'],
  },
  {
    id: 'K-2',
    kind: 'case',
    source: '最高人民法院《关于审理证券市场虚假陈述侵权民事赔偿案件的若干规定》（2022）',
    locator: '第四条第（一）项',
    quote:
      '原告能够证明下列情形的，人民法院应当认定原告的投资决定与虚假陈述之间的交易因果关系成立：' +
      '（一）信息披露义务人实施了虚假陈述……被告能够举证证明原告的投资决定与虚假陈述之间' +
      '不存在交易因果关系的除外。',
    keywords: ['交易因果关系', '举证责任', '虚假陈述', '推定'],
  },
  {
    id: 'K-3',
    kind: 'case',
    source: '中国证监会行政处罚决定书',
    locator: '〔2023〕富途控股相关案（当事人承诺制度适用）',
    quote:
      '当事人承诺制度适用中，执法机关综合考量当事人配合调查的程度、' +
      '承诺赔偿投资者损失的金额与及时性、整改措施的完备性等因素决定是否接受承诺。',
    keywords: ['当事人承诺', '和解', '配合调查', '赔偿投资者'],
  },
  {
    id: 'K-4',
    kind: 'case',
    source: '《证券期货行政执法当事人承诺制度实施办法》（2021）',
    locator: '第二条、第五条',
    quote:
      '当事人承诺制度，是指国务院证券监督管理机构对涉嫌证券期货违法的单位或者个人进行调查期间，' +
      '被调查的当事人承诺纠正涉嫌违法行为、赔偿有关投资者损失、消除损害或者不良影响，' +
      '经国务院证券监督管理机构认可，当事人履行承诺后终止案件调查的行政执法方式。' +
      '……涉嫌犯罪应当移送司法机关的，不适用当事人承诺制度。',
    keywords: ['当事人承诺制度', '终止调查', '适用条件', '移送司法'],
  },
  {
    id: 'K-5',
    kind: 'case',
    source: '最高人民法院《全国法院民商事审判工作会议纪要》（九民纪要）',
    locator: '第 85 条',
    quote:
      '在认定信息披露义务人是否构成虚假陈述时，应当区分"诱多型"与"诱空型"虚假陈述，' +
      '并据此确定损失计算的基准。',
    keywords: ['诱多', '诱空', '损失计算', '九民纪要'],
  },

  /* ------------------------- 学理 ------------------------- */
  {
    id: 'D-1',
    kind: 'doctrine',
    source: '证券行政执法当事人承诺制度研究（学理通说）',
    locator: '制度功能分析',
    quote:
      '当事人承诺制度的正当性基础在于执法效率与投资者补偿的平衡：' +
      '以终止调查换取当事人的主动赔偿，但须防止其异化为"以钱买罚"进而削弱执法威慑。',
    keywords: ['执法效率', '投资者补偿', '威慑', '制度异化'],
  },
  {
    id: 'D-2',
    kind: 'doctrine',
    source: '过罚相当原则（学理通说）',
    locator: '裁量因素归纳',
    quote:
      '证券行政处罚裁量通常综合考量：违法行为的持续时间与频次、涉案金额、' +
      '当事人的主观状态（故意/过失）、是否主动披露并整改、对市场秩序的实际损害。',
    keywords: ['裁量因素', '持续时间', '涉案金额', '主观状态', '整改'],
  },
];

/** 按 id 取材料 */
function getMaterial(id) {
  return CORPUS.find((m) => m.id === id) || null;
}

/**
 * 中文分词：按标点切分 + 生成 2–4 字 n-gram。
 *
 * 为什么不能像英文那样按空格切：
 * 中文没有词间空格，"信息披露违法的责任主体范围如何界定"整句会被当成
 * 一个 token，与语料里的"信息披露"永不可能子串匹配 —— 检索恒为零。
 * 这是本项目检索环节踩过的第一个真实 bug：整条链路能跑通、但材料数为 0，
 * 表面上"没有报错"，实际产出完全不可用。
 *
 * 用 n-gram 而非引入分词词典：法律术语多是 4 字（"虚假陈述""信息披露"），
 * 2–4 字滑窗足以覆盖，且零依赖、可解释。
 */
function tokenizeCN(text) {
  const s = String(text || '');
  const terms = new Set();

  // ① 先按标点/空白切成子句，保留长度 ≥2 的整段（长词优先）
  const clauses = s.split(/[\s,，、;；。！？：:（）()【】\[\]"'""'']+/).filter(Boolean);
  for (const c of clauses) {
    if (c.length >= 2) terms.add(c);
  }

  // ② 对每个子句做 2–4 字 n-gram 滑窗
  for (const c of clauses) {
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i + n <= c.length; i += 1) {
        terms.add(c.slice(i, i + n));
      }
    }
  }

  // ③ 英文/数字词（如 "IPO"、"2023"）单独提取
  for (const w of s.match(/[A-Za-z][A-Za-z0-9-]{1,}/g) || []) {
    terms.add(w.toLowerCase());
  }

  return [...terms];
}

/**
 * 关键词检索：按 n-gram 命中数与权重打分排序。
 *
 * 权重设计（长词更有信息量）：
 *  - 命中人工标注 keywords 字段：权重最高（人工标注，信噪比最好）
 *  - 命中 length ≥4 的 n-gram：高（"信息披露""虚假陈述"这类术语）
 *  - 命中 2–3 字 n-gram：低（"披露""责任"在语料里极常见，区分度弱）
 *
 * ★ 反误召设计（本项目的第三个真实 bug）：
 * 最初对 keywords 用了双向子串匹配（`k.includes(t) || t.includes(k)`），
 * 结果**通用二字词**成了洪水：查询里出现"赔偿"，则任何 quote 含"赔偿"的
 * 材料都 +6 分。于是"宅基地相邻关系…精神损害赔偿"这种与证券法毫无关系的
 * 案件也能召出 7 条材料，负向测试直接失败。
 *
 * 修正为三条硬规则：
 *  ① 只有 **长度≥3** 的 term 才允许与 keywords 做模糊互含匹配；
 *     2 字 term 必须与 keyword **完全相等**才计分。
 *  ② 单条材料必须至少有一个"高信息量命中"（命中 keyword，或命中≥3字 term）
 *     才算候选 —— 只靠 2 字泛词堆出来的分数一律不计入结果。
 *  ③ 排名分数里区分高/低信息量命中，避免通用词把真正相关的材料压下去。
 */
function search(query, { limit = 10, kinds = null, minScore = 3 } = {}) {
  const terms = tokenizeCN(query);

  const scored = CORPUS.filter((m) => !kinds || kinds.includes(m.kind)).map((m) => {
    const kw = (m.keywords || []).map((k) => k.toLowerCase());
    const hay = `${m.source} ${m.locator} ${m.quote} ${kw.join(' ')}`.toLowerCase();
    // 正文（不含 keywords）—— 用于判断命中是否"真的出现在法条里"
    const prose = `${m.source} ${m.locator} ${m.quote}`.toLowerCase();

    let score = 0;
    let strongHits = 0; // 高信息量命中数（rule ②）
    const matched = [];

    for (const t of terms) {
      const tl = t.toLowerCase();
      const isShort = tl.length <= 2;

      /**
       * ① 命中人工标注关键词 —— 分「全等」与「部分」两档强度。
       *
       * 这是第五个真实 bug 的修正。原先只要 `kw.includes(tl)` 就算强命中，
       * 于是"当事人"（查询事实里的常见主语）命中了关键词"当事人承诺"，
       * 让一个与证券法毫无关系的宅基地纠纷召出了 K-3/K-4 两条处罚材料。
       *
       * 判据：**关键词是人工标注的原子术语**。命中它的片段不等于命中它 ——
       * "当事人"命中"当事人承诺"是偶然共现，"当事人承诺"命中"当事人承诺"才是真相关。
       * 故全等算强命中（strongHits），片段命中只加少量分、不计强命中。
       */
      let kwScore = 0;
      let kwStrong = false;
      for (const k of kw) {
        if (k === tl) {
          kwScore = Math.max(kwScore, 6);
          kwStrong = true;
        } else if (!isShort && (k.includes(tl) || tl.includes(k))) {
          kwScore = Math.max(kwScore, 2); // 片段命中：仅弱证据
        }
      }
      if (kwScore > 0) {
        score += kwScore;
        if (kwStrong) {
          strongHits += 1;
          matched.push(t);
        }
        continue;
      }

      // ② 正文命中：只有 ≥4 字 n-gram 才算高信息量
      //
      // 为什么 3 字不能计入 strongHits（本项目第三个 bug 的另一半）：
      // 3 字滑窗会切出"涉及""问题"这类**通用连接词**，它们在任何法律文本里
      // 都出现，于是"宅基地相邻关系…涉及采光"能靠"涉及"召出十条证券法条文。
      // 3 字仍是合法的中文词长，故保留少量加分，但不足以单独支撑一条命中。
      if (prose.includes(tl)) {
        if (tl.length >= 4) {
          score += 4;
          strongHits += 1;
          matched.push(t);
        } else if (tl.length === 3) {
          score += 1;
        }
      }
    }

    return { material: m, score, strongHits, matched: [...new Set(matched)] };
  });

  return scored
    // rule ②：必须有高信息量命中（命中 keyword，或命中正文里 ≥4 字的术语），
    // 纯靠 2–3 字泛词堆分一律不计入结果
    .filter((s) => s.score >= minScore && s.strongHits >= 1)
    .sort((a, b) => b.score - a.score || a.material.id.localeCompare(b.material.id))
    .slice(0, limit);
}

__exports = { getMaterial, search, CORPUS };
return __exports;
})();

/* ===== protocol () ===== */
__mod['protocol'] = (() => {
let __exports = {};
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
class ProtocolError extends Error {
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
function validateRetrieval(msg) {
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
function validateAnalysis(msg) {
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
function validateCitesResolve(analysis, retrieval) {
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

function validateDraft(msg) {
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
function validateDraftCoverage(draft, analysis) {
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
const VERDICTS = ['pass', 'revise', 'reject'];

function validateQc(msg) {
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
const INPUT_SCHEMA = {
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

function validateCase(c) {
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

__exports = { validateRetrieval, validateAnalysis, validateCitesResolve, validateDraft, validateDraftCoverage, validateQc, validateCase, ProtocolError, VERDICTS, INPUT_SCHEMA };
return __exports;
})();

/* ===== audit () ===== */
__mod['audit'] = (() => {
let __exports = {};
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
const SEATS = {
  writer: { role: '承办（写作）', provider: 'local-rules' },
  qc: { role: '对抗（质检）', provider: 'local-rules' },
  analyst: { role: '分析', provider: 'local-rules' },
  retriever: { role: '检索', provider: 'local-rules' },
};

/** 规则一：承办与对抗的席位必须不同 */
function assertNonSelfAudit(producerSeat, auditorSeat) {
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
class AuditError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'AuditError';
    this.code = code;
  }
}

const AUDIT_CODES = {
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
const LIMITS = {
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
class AuditSession {
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

function assertActionableFix(findings) {
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
function adjudicate(session, { verdict, findings, producerSeat = 'writer', auditorSeat = 'qc' }) {
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

__exports = { assertNonSelfAudit, assertActionableFix, adjudicate, AuditError, AuditSession, SEATS, AUDIT_CODES, LIMITS };
return __exports;
})();

/* ===== agents () ===== */
__mod['agents'] = (() => {
let __exports = {};
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

const { search, getMaterial } = __mod['corpus'];

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

function createRetriever({ limitPerQuestion = 6, globalCap = 14 } = {}) {
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
function createAnalyst() {
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
function createWriter() {
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
function createQc() {
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

// [bundler] export{} 已收集

__exports = { createRetriever, createAnalyst, createWriter, createQc, getMaterial };
return __exports;
})();

/* ===== orchestrator () ===== */
__mod['orchestrator'] = (() => {
let __exports = {};
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

const { validateRetrieval, validateAnalysis, validateDraft, validateQc, validateCitesResolve, validateDraftCoverage, ProtocolError } = __mod['protocol'];
const { AuditSession, adjudicate, assertNonSelfAudit } = __mod['audit'];

const MAX_REVISIONS = 2;

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
function createOrchestrator({ retriever, analyst, writer, qc, onEvent = () => {} }) {
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

// [bundler] export{} 已收集

__exports = { createOrchestrator, MAX_REVISIONS, ProtocolError };
return __exports;
})();

/* ===== cites () ===== */
__mod['cites'] = (() => {
let __exports = {};
/**
 * 法规引用核验的**纯逻辑层**（pure core）
 *
 * 从 `tools/check-cites.mjs` 拆出来的。拆的原因很具体：
 *
 * 原来的 check-cites.mjs 同时包含"核验逻辑"和"CLI 入口"，而入口部分
 * `import { readFileSync } from 'node:fs'`、`import { pathToFileURL } from 'node:url'`
 * —— 这两个模块**只在 Node 里存在**。桌面 App 的 WebView 里没有 node:fs，
 * 于是整个文件在打包进 App 时会失败。
 *
 * 分层原则：能被复用的逻辑必须与"它是怎么被调用的"解耦。
 *   · 本文件：纯函数，零 Node 依赖，Node / 浏览器 / WebView 都能跑
 *   · tools/check-cites.mjs：CLI 外壳，只负责读文件、打印、设退出码
 *
 * 判断为什么必须是纯确定性的：
 * 抽取（把"《证券法》第八十五条"从文字里认出来）可以容忍不确定性；
 * 判断（该条是否存在、内容是否相符）必须可复现 ——
 * 一旦让模型来判断"我引的对不对"，它就同时成了运动员和裁判员。
 */

const { CORPUS } = __mod['corpus'];

/* ------------------------------------------------------------------ */
/* ① 抽取                                                               */
/* ------------------------------------------------------------------ */

/** 法名别名归一表：简称 → 语料库中的标准 source 关键片段 */
const LAW_ALIASES = [
  { pattern: /证券法/, canonical: '证券法' },
  { pattern: /行政处罚法/, canonical: '行政处罚法' },
  { pattern: /公司法/, canonical: '公司法' },
  { pattern: /民事诉讼法/, canonical: '民事诉讼法' },
  { pattern: /民法典/, canonical: '民法典' },
  { pattern: /刑法/, canonical: '刑法' },
];

const CN_DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 中文数字 → 阿拉伯数字（覆盖法条号常见范围，含"一百九十七"这类） */
function cnToNumber(s) {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  let section = 0;
  let current = 0;
  for (const ch of s) {
    if (ch === '百') {
      section += (current || 1) * 100;
      current = 0;
    } else if (ch === '十') {
      section += (current || 1) * 10;
      current = 0;
    } else if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
    } else if (ch === '零' || ch === '〇') {
      // 跳过
    } else {
      return null;
    }
  }
  const total = section + current;
  return total > 0 ? total : null;
}

/**
 * 从文本抽取全部法条引用。
 * @returns {Array<{raw, law, articleNumber, item, index}>}
 */
function extractCitations(text) {
  const citations = [];
  const seen = new Set();

  // 主模式：可选的《法名》 + 第X条（可带项）
  const re =
    /《([^》]{2,30})》\s*第\s*([零〇一二三四五六七八九十百\d]{1,6})\s*条(?:\s*第\s*([（(]?[零〇一二三四五六七八九十\d]{1,3}[)）]?)\s*项)?/g;

  let m;
  while ((m = re.exec(text)) !== null) {
    const [, lawRaw, artRaw, itemRaw] = m;
    const law = LAW_ALIASES.find((a) => a.pattern.test(lawRaw));
    const articleNumber = cnToNumber(artRaw);
    const key = `${lawRaw}|${articleNumber}|${itemRaw || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      raw: m[0],
      lawRaw,
      law: law ? law.canonical : null,
      articleNumber,
      item: itemRaw || null,
      index: m.index,
    });
  }

  // 次模式：简称式"证券法第197条"（无书名号）
  const re2 = /(证券法|行政处罚法|公司法|民事诉讼法|民法典|刑法)\s*第\s*([零〇一二三四五六七八九十百\d]{1,6})\s*条/g;
  while ((m = re2.exec(text)) !== null) {
    const law = LAW_ALIASES.find((a) => a.pattern.test(m[1]));
    const articleNumber = cnToNumber(m[2]);
    const key = `${m[1]}|${articleNumber}|`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      raw: m[0],
      lawRaw: m[1],
      law: law ? law.canonical : null,
      articleNumber,
      item: null,
      index: m.index,
    });
  }

  return citations.sort((a, b) => a.index - b.index);
}

/* ------------------------------------------------------------------ */
/* ② 核验                                                               */
/* ------------------------------------------------------------------ */

const STATUS = {
  VERIFIED: 'verified',
  NOT_FOUND: 'not_found',
  LAW_UNKNOWN: 'law_unknown',
  OUT_OF_SCOPE: 'out_of_scope',
};

/** 语料库覆盖的法律 */
const COVERED_LAWS = [
  ...new Set(
    CORPUS.map((m) => {
      for (const a of LAW_ALIASES) if (a.pattern.test(m.source)) return a.canonical;
      return null;
    }).filter(Boolean),
  ),
];

function verifyCitation(cite) {
  if (!cite.law) {
    return { ...cite, status: STATUS.LAW_UNKNOWN, detail: `无法识别的法名"${cite.lawRaw}"，请人工确认` };
  }

  if (!COVERED_LAWS.includes(cite.law)) {
    return {
      ...cite,
      status: STATUS.OUT_OF_SCOPE,
      detail: `《${cite.lawRaw}》不在本语料库覆盖范围（当前覆盖：${COVERED_LAWS.join('、')}）`,
    };
  }

  const hit = CORPUS.find((m) => {
    const srcMatchesLaw = new RegExp(`《?[^》]*${cite.law}`).test(m.source);
    if (!srcMatchesLaw) return false;
    const nums = [...m.locator.matchAll(/第([零〇一二三四五六七八九十百\d]{1,6})条/g)]
      .map((x) => cnToNumber(x[1]))
      .filter(Boolean);
    return nums.includes(cite.articleNumber);
  });

  if (hit) {
    return {
      ...cite,
      status: STATUS.VERIFIED,
      detail: `已核验：${hit.source}${hit.locator}`,
      matchedId: hit.id,
      quote: hit.quote,
    };
  }

  const sameLaw = CORPUS.filter((m) => new RegExp(`《?[^》]*${cite.law}`).test(m.source));
  const knownNums = sameLaw
    .flatMap((m) => [...m.locator.matchAll(/第([零〇一二三四五六七八九十百\d]{1,6})条/g)])
    .map((x) => cnToNumber(x[1]))
    .filter(Boolean)
    .sort((a, b) => a - b);

  return {
    ...cite,
    status: STATUS.NOT_FOUND,
    detail:
      sameLaw.length > 0
        ? `语料库中${cite.law}共收录 ${sameLaw.length} 条（条号：${knownNums.join('、')}），**未收录第 ${cite.articleNumber} 条** —— 可能是编造，也可能只是超出收录范围，须人工复核原文`
        : `语料库中未收录${cite.law}`,
    knownArticleNumbers: knownNums,
  };
}

/* ------------------------------------------------------------------ */
/* ③ 汇总                                                               */
/* ------------------------------------------------------------------ */

function verifyText(text) {
  const citations = extractCitations(text).map(verifyCitation);
  const counts = {
    total: citations.length,
    verified: citations.filter((c) => c.status === STATUS.VERIFIED).length,
    notFound: citations.filter((c) => c.status === STATUS.NOT_FOUND).length,
    lawUnknown: citations.filter((c) => c.status === STATUS.LAW_UNKNOWN).length,
    outOfScope: citations.filter((c) => c.status === STATUS.OUT_OF_SCOPE).length,
  };
  return { citations, counts };
}

__exports = { cnToNumber, extractCitations, verifyCitation, verifyText, STATUS, COVERED_LAWS };
return __exports;
})();


/* -------------------------------------------------------------- */
/* 对外 API                                                         */
/* -------------------------------------------------------------- */

const { createOrchestrator } = __mod['orchestrator'];
const { createRetriever, createAnalyst, createWriter, createQc } = __mod['agents'];
const { verifyText, extractCitations } = __mod['cites'];
const { CORPUS } = __mod['corpus'];

function makeOrchestrator() {
  return createOrchestrator({
    retriever: createRetriever(),
    analyst: createAnalyst(),
    writer: createWriter(),
    qc: createQc(),
  });
}

/** 把一句话问题变成案例结构（与 cli.mjs 的 problemToCase 保持一致） */
function problemToCase(text, id) {
  const clean = String(text || '').trim();
  const parts = clean.split(/(?<=[？?。！!；;])/).map((s) => s.trim()).filter(Boolean);
  const looksQuestion = (s) => /[？?]|是否|能否|可否|如何|怎样|哪些|什么|为何|有没有|是不是/.test(s);
  let questions = parts.filter(looksQuestion);
  if (questions.length === 0) questions = [clean];
  return {
    id: id || 'USER-QUERY',
    title: clean.slice(0, 40) + (clean.length > 40 ? '…' : ''),
    facts: clean,
    questions: questions.map((q, i) => ({ id: 'Q' + (i + 1), text: q.replace(/[？?。！!；;]+$/, '') })),
  };
}

window.LegalEngine = {
  /** 分析一个法律问题，返回四智能体流水线结果 */
  async ask(question) {
    const caseObj = problemToCase(question);
    const result = await makeOrchestrator().run(caseObj);
    return {
      status: result.status,
      materials: result.retrieval?.materials || [],
      issues: result.analysis?.issues || [],
      draft: result.draft || null,
      qc: result.qc || null,
      audit: result.audit || null,
      noResultReason: result.retrieval?.noResultReason || null,
    };
  },

  /** 核验一段文字里的法条引用 */
  check(text) {
    return verifyText(text);
  },

  /** 语料库概览 */
  corpus() {
    const byKind = {};
    for (const m of CORPUS) {
      (byKind[m.kind] ||= []).push({ id: m.id, source: m.source, locator: m.locator });
    }
    return { total: CORPUS.length, byKind };
  },

  /** 引擎自检：返回版本与模块状态，供 App 启动时确认可用 */
  hello() {
    return {
      ok: true,
      modules: Object.keys(__mod),
      corpusSize: CORPUS.length,
    };
  },
};

})();
