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

import { CORPUS } from '../lib/corpus.mjs';

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
export function cnToNumber(s) {
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
export function extractCitations(text) {
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

export const STATUS = {
  VERIFIED: 'verified',
  NOT_FOUND: 'not_found',
  LAW_UNKNOWN: 'law_unknown',
  OUT_OF_SCOPE: 'out_of_scope',
};

/** 语料库覆盖的法律 */
export const COVERED_LAWS = [
  ...new Set(
    CORPUS.map((m) => {
      for (const a of LAW_ALIASES) if (a.pattern.test(m.source)) return a.canonical;
      return null;
    }).filter(Boolean),
  ),
];

export function verifyCitation(cite) {
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

export function verifyText(text) {
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
