/**
 * 引注核验器（Citation Verifier）—— `check-cites.mjs`
 *
 * 背景（来自 2026-10-16 的法律 AI 开源生态调研，gh api 实测）：
 *   - 英文侧已把"引注核验"证明为核心价值：mike（4344★）内置 citation 核验 +
 *     CourtListener；korean-law-mcp（2719★）把引用核验写进项目定位；
 *     Harvey LAB（1466★）用 rubric 给 agent 打分，把"无出处即零分"写进评分标准。
 *   - 中文侧这一层**没有对应开源项目**：现有项目都在"生成"端卷
 *     （合同出报告、检索出答案），没人做"否证"端。
 *   - 这是法律人不敢用 AI 的头号原因：模型会编造法条编号、引用已废止条文、
 *     把《民法典》条文错记成旧《合同法》条文。
 *
 * 本工具的主张：**LLM 只做抽取，判断完全确定性**。
 * 抽取（把"《证券法》第八十五条"从一段文字里认出来）可以容忍不确定性；
 * 判断（该条是否存在、内容是否相符）必须是可复现的确定性代码 ——
 * 因为一旦让模型来判断"我引的对不对"，它就同时成了运动员和裁判员。
 *
 * 用法：
 *   node tools/check-cites.mjs <文件路径>
 *   node tools/check-cites.mjs --text "某段包含引用的文字"
 *   cat 文书.md | node tools/check-cites.mjs -
 */

import { readFileSync } from 'node:fs';
import { CORPUS, getMaterial } from '../lib/corpus.mjs';

/* ------------------------------------------------------------------ */
/* ① 抽取：从自由文本中识别法条引用                                       */
/* ------------------------------------------------------------------ */

/**
 * 中文法规引用的常见写法：
 *   《中华人民共和国证券法》第八十五条
 *   《证券法》第85条
 *   《行政处罚法》第三十二条第（一）项
 *   证券法第 197 条
 *   法释〔2022〕xx 号 第x条
 *
 * 注意：抽取用到"所属法域"的别名归一 —— 实务中大量使用简称（《证券法》），
 * 若不归一，核验会因"找不到《证券法》这部法律"而全部误报。
 */

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
export function cnToNumber(s) {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  let total = 0;
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
      return null; // 含无法解析字符
    }
  }
  total = section + current;
  return total > 0 ? total : null;
}

/**
 * 从文本抽取全部法条引用。
 * @returns {Array<{raw, law, articleNumber, articleText, item, index}>}
 */
export function extractCitations(text) {
  const citations = [];
  const seen = new Set();

  // 主模式：可选的《法名》 + 第X条 —— 法名可省略（承接前文），此处要求存在以免误报
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
      articleText: `第${artRaw}条`,
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
      articleText: `第${m[2]}条`,
      item: null,
      index: m.index,
    });
  }

  return citations.sort((a, b) => a.index - b.index);
}

/* ------------------------------------------------------------------ */
/* ② 核验：确定性四态判定                                                */
/* ------------------------------------------------------------------ */

export const STATUS = {
  VERIFIED: 'verified', // ✅ 条号存在且语料库有对应条文
  NOT_FOUND: 'not_found', // ❌ 语料库中没有这条 —— 可能是编造，或超出覆盖范围
  LAW_UNKNOWN: 'law_unknown', // ❓ 无法识别法名（如"某规定"）
  OUT_OF_SCOPE: 'out_of_scope', // ➖ 该法不在本语料库覆盖范围内
};

/** 语料库覆盖的法律 */
const COVERED_LAWS = [...new Set(CORPUS.map((m) => {
  const src = m.source;
  for (const a of LAW_ALIASES) if (a.pattern.test(src)) return a.canonical;
  return null;
}).filter(Boolean))];

export function verifyCitation(cite) {
  if (!cite.law) {
    return {
      ...cite,
      status: STATUS.LAW_UNKNOWN,
      detail: `无法识别的法名"${cite.lawRaw}"，请人工确认`,
    };
  }

  if (!COVERED_LAWS.includes(cite.law)) {
    return {
      ...cite,
      status: STATUS.OUT_OF_SCOPE,
      detail: `《${cite.lawRaw}》不在本语料库覆盖范围（当前覆盖：${COVERED_LAWS.join('、')}）`,
    };
  }

  // 在语料库中按法名 + 条号定位
  const hit = CORPUS.find((m) => {
    const srcMatchesLaw = new RegExp(`《?[^》]*${cite.law}`).test(m.source);
    if (!srcMatchesLaw) return false;
    // locator 形如"第一百八十一条"或"第二条、第五条"
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

  // 找不到：区分"该法有条号体系但缺这一条"与"完全查不到"
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
/* ③ 报告                                                                */
/* ------------------------------------------------------------------ */

const ICON = {
  [STATUS.VERIFIED]: '✅',
  [STATUS.NOT_FOUND]: '❌',
  [STATUS.LAW_UNKNOWN]: '❓',
  [STATUS.OUT_OF_SCOPE]: '➖',
};

export function verifyText(text) {
  const citations = extractCitations(text);
  const results = citations.map(verifyCitation);

  const counts = {
    total: results.length,
    verified: results.filter((r) => r.status === STATUS.VERIFIED).length,
    notFound: results.filter((r) => r.status === STATUS.NOT_FOUND).length,
    lawUnknown: results.filter((r) => r.status === STATUS.LAW_UNKNOWN).length,
    outOfScope: results.filter((r) => r.status === STATUS.OUT_OF_SCOPE).length,
  };

  return { citations: results, counts };
}

function renderReport(file, { citations, counts }) {
  const lines = [];
  lines.push(`引注核验报告 · ${file}`);
  lines.push(`生成时间：${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `共抽取 ${counts.total} 处引用 —— ✅ 已核验 ${counts.verified} · ` +
      `❌ 未收录/疑似编造 ${counts.notFound} · ❓ 法名不明 ${counts.lawUnknown} · ` +
      `➖ 超出覆盖范围 ${counts.outOfScope}`,
  );
  lines.push('');
  lines.push('─'.repeat(72));

  if (citations.length === 0) {
    lines.push('未在文本中识别到任何法规引用。');
  }

  for (const c of citations) {
    lines.push(`${ICON[c.status]} ${c.raw}`);
    lines.push(`   ${c.detail}`);
    if (c.quote && c.status === STATUS.VERIFIED) {
      lines.push(`   语料原文：${c.quote.slice(0, 80)}${c.quote.length > 80 ? '…' : ''}`);
    }
    lines.push('');
  }

  lines.push('─'.repeat(72));
  lines.push('说明：本报告的"判断"完全由确定性代码完成，LLM 仅参与引用抽取。');
  lines.push('      状态 ❌ 不等于"一定编造" —— 它表示语料库未收录，须人工核对原文。');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* ④ CLI                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const args = process.argv.slice(2);
  let text = null;
  let label = 'stdin';

  if (args[0] === '--text') {
    text = args[1];
    label = '(命令行传入)';
  } else if (args[0] === '-') {
    text = readFileSync(0, 'utf8');
    label = 'stdin';
  } else if (args[0]) {
    text = readFileSync(args[0], 'utf8');
    label = args[0];
  } else {
    console.error('用法：node tools/check-cites.mjs <文件> | --text "文字" | -');
    process.exit(2);
  }

  const result = verifyText(text);
  console.log(renderReport(label, result));

  // 退出码：发现疑似编造则非零，便于接入 CI / 多 Agent 门禁
  process.exit(result.counts.notFound > 0 ? 1 : 0);
}

/**
 * 入口判定：用 pathToFileURL 而非字符串拼接。
 *
 * 踩坑记录：最初写 `import.meta.url === \`file://${process.argv[1]}\``，
 * 在本机（路径含中文「图鲲」）**恒为 false** —— import.meta.url 是
 * 百分号编码的（%E5%9B%BE%E9%B2%B2），而 argv[1] 是原始 UTF-8，
 * 两者永不相等，导致 CLI 静默不执行、还返回退出码 0。
 * 这类"看起来跑成功了但什么都没做"的失败最难发现。
 */
import { pathToFileURL } from 'node:url';

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) main();
