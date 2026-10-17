#!/usr/bin/env node
/**
 * legal-agent 命令行工具
 *
 * 这是这个项目**在你电脑上怎么用**的答案。
 * 在此之前它只有 `node test/run.mjs`（跑测试）和 `node test/report.mjs`（跑固定案例），
 * 那不是工具，是自测脚本。现在它有了真正的入口。
 *
 * 用法（三种最主要的场景）：
 *
 *   1) 分析一个法律问题 —— 最常用
 *      node cli.mjs ask "公司未披露对外担保，投资者能否索赔？"
 *      node cli.mjs ask "..." --save            # 同时保存成 Markdown
 *      node cli.mjs ask "..." --json             # 输出结构化 JSON（喂给别的工具）
 *
 *   2) 核验一段文字里的法条引用 —— 抓 AI 编造的法条
 *      node cli.mjs check 法律意见书.md
 *      node cli.mjs check --text "根据《证券法》第九百九十九条…"
 *
 *   3) 用案例文件跑完整流水线
 *      node cli.mjs run cases/index.mjs --id CASE-001
 *
 * 设计上的取舍：
 *   · 零依赖，不需要装任何东西、不需要 API key —— clone 下来就能用。
 *   · 输出默认是人类可读的 Markdown；`--json` 给程序用。
 *   · 所有数字都来自本地语料库，不联网。用了哪些材料会在末尾列出来，可逐条核对。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOrchestrator } from './lib/orchestrator.mjs';
import { createRetriever, createAnalyst, createWriter, createQc } from './agents/index.mjs';
import { verifyText, STATUS } from './tools/check-cites.mjs';

/* ------------------------------------------------------------------ */
/* 参数解析（手写，不引依赖）                                            */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out.flags[key] = next;
        i += 1;
      } else {
        out.flags[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

/* ------------------------------------------------------------------ */
/* 把自由文本的法律问题转成案例结构                                      */
/* ------------------------------------------------------------------ */

/**
 * 用户问一句话，要变成 { facts, questions[] } 才能进流水线。
 *
 * 这里的切分很朴素：按问号/句号切成若干问题，全部原样当 facts 和 questions。
 * 为什么不做更聪明的解析：分析 Agent 本来就会围绕每个问题去做 IRAC，
 * 过度解析反而可能把用户的原意改掉。宁可笨一点、忠实一点。
 */
function problemToCase(text, id = 'USER-QUERY') {
  const clean = String(text || '').trim();
  // 按中英文问号、句号、分号切分，保留问句
  const parts = clean
    .split(/(?<=[？?。！!；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 优先选取含疑问语气的句子；若没有，整段当一个问题
  const looksQuestion = (s) => /[？?]|是否|能否|可否|如何|怎样|哪些|什么|为何|有没有|是不是/.test(s);
  let questions = parts.filter(looksQuestion);

  if (questions.length === 0) {
    questions = [clean];
  }

  return {
    id,
    title: clean.slice(0, 40) + (clean.length > 40 ? '…' : ''),
    facts: clean,
    questions: questions.map((q, i) => ({ id: `Q${i + 1}`, text: q.replace(/[？?。！!；;]+$/, '') })),
  };
}

/* ------------------------------------------------------------------ */
/* 渲染：把流水线结果变成人读的 Markdown                                 */
/* ------------------------------------------------------------------ */

const STATUS_LABEL = {
  passed: ['✅ 通过质检', C.green],
  rejected: ['⛔ 质检否决（材料不足）', C.red],
  escalated: ['⚠️ 已熔断，转人工', C.yellow],
  revise_limit: ['⚠️ 修改次数用尽仍不达标', C.yellow],
  no_materials: ['⛔ 语料库中无相关材料', C.red],
};

function renderResult(result, caseObj) {
  const [label, color] = STATUS_LABEL[result.status] || ['未知状态', C.dim];
  const L = [];

  L.push('');
  L.push(C.bold('═'.repeat(64)));
  L.push(C.bold(`  ${caseObj.title || caseObj.id}`));
  L.push(C.bold('═'.repeat(64)));
  L.push('');
  L.push(`  状态：${color(label)}`);
  if (result.revisions) L.push(`  质检打回重写：${result.revisions} 次`);
  L.push('');

  if (result.status === 'no_materials') {
    L.push(C.yellow('  本地语料库中没有与本案相关的条文或案例，因此中止分析。'));
    L.push(C.dim(`  原因：${result.retrieval?.noResultReason || '未命中'}`));
    L.push('');
    L.push(C.dim('  这不是故障，而是设计：宁可说"没有"，也不硬凑几条不相关的条文。'));
    L.push('');
    return L.join('\n');
  }

  /* ---- 检索到的材料 ---- */
  const mats = result.retrieval?.materials || [];
  L.push(C.bold(`【一】检索到 ${mats.length} 条材料`));
  for (const m of mats) {
    const tag = m.viaCoreProvision ? C.dim('核心') : '';
    L.push(`  ${C.cyan(m.id)} ${m.source} ${m.locator} ${tag}`);
  }
  L.push('');

  /* ---- 争点 ---- */
  const issues = result.analysis?.issues || [];
  L.push(C.bold(`【二】分析出 ${issues.length} 个争点`));
  for (const i of issues) {
    const conf = i.confidence >= 0.75 ? C.green(`${i.confidence}`) : C.yellow(`${i.confidence}`);
    L.push(`  ${C.bold(i.id)} 置信度 ${conf}  ${i.question}`);
    L.push(C.dim(`      引用：${i.cites.join('、')}`));
  }
  L.push('');

  /* ---- 文书 ---- */
  const secs = result.draft?.sections || [];
  if (secs.length) {
    L.push(C.bold('【三】法律分析意见书'));
    L.push('');
    for (const s of secs) {
      L.push(`  ${C.bold('▍' + s.heading)}`);
      for (const line of s.body.split('\n')) {
        L.push(line ? `    ${line}` : '');
      }
      L.push('');
    }
  }

  /* ---- 质检 ---- */
  const qc = result.qc;
  if (qc) {
    L.push(C.bold('【四】质检结论'));
    L.push(`  裁决：${qc.verdict}`);
    if (qc.findings?.length) {
      for (const f of qc.findings) {
        L.push(`  · [${f.severity}] ${f.issueId}: ${f.problem}`);
        L.push(C.dim(`      修法：${f.fix}`));
      }
    } else {
      L.push(C.dim('  未发现问题。'));
    }
    L.push('');
  }

  /* ---- 审计配额 ---- */
  if (result.audit) {
    const r = result.audit.remaining;
    L.push(C.dim(`  审计配额剩余：对抗 ${r.objectionRounds} / 裁决 ${r.rulings} / 上诉 ${r.appeals}`));
    L.push('');
  }

  L.push(C.dim('─'.repeat(64)));
  L.push(C.dim('  以上产出为工作底稿，不构成法律意见，须由执业律师复核。'));
  L.push(C.dim(`  语料库版本：本地 ${mats.length} 条材料（证券法/行政处罚法/公司法）`));
  L.push('');
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 命令：ask                                                            */
/* ------------------------------------------------------------------ */

async function cmdAsk(args) {
  const question = args._.join(' ').trim();
  if (!question) {
    console.error(C.red('用法：node cli.mjs ask "你的法律问题"'));
    process.exit(2);
  }

  const caseObj = problemToCase(question);
  const orch = createOrchestrator({
    retriever: createRetriever(),
    analyst: createAnalyst(),
    writer: createWriter(),
    qc: createQc(),
  });

  const result = await orch.run(caseObj);

  if (args.flags.json) {
    // 只输出 JSON，便于管道给别的工具
    const payload = {
      caseId: result.caseId,
      status: result.status,
      materials: result.retrieval?.materials || [],
      issues: result.analysis?.issues || [],
      draft: result.draft || null,
      qc: result.qc || null,
      audit: result.audit || null,
    };
    const out = JSON.stringify(payload, null, 2);
    if (args.flags.save) {
      const path = saveOutput(out, 'json');
      console.error(C.green(`已保存：${path}`));
    } else {
      console.log(out);
    }
    return result;
  }

  const text = renderResult(result, caseObj);
  console.log(text);

  if (args.flags.save) {
    const md = renderMarkdown(result, caseObj);
    const path = saveOutput(md, 'md');
    console.log(C.green(`已保存：${path}`));
  }
  return result;
}

/** 保存到 out/ 目录，文件名带时间戳 */
function saveOutput(content, ext) {
  const dir = resolve(process.cwd(), 'out');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = resolve(dir, `legal-agent-${stamp}.${ext}`);
  writeFileSync(path, content, 'utf8');
  return path;
}

/** 生成不含终端颜色码的 Markdown（用于保存） */
function renderMarkdown(result, caseObj) {
  const L = [];
  L.push(`# ${caseObj.title || caseObj.id}`);
  L.push('');
  L.push(`- 生成时间：${new Date().toISOString()}`);
  L.push(`- 流水线状态：**${result.status}**`);
  if (result.revisions) L.push(`- 质检打回重写：${result.revisions} 次`);
  L.push('');

  L.push(`## 原始问题`);
  L.push('');
  L.push(caseObj.facts);
  L.push('');

  const mats = result.retrieval?.materials || [];
  if (mats.length) {
    L.push(`## 检索到的材料（${mats.length} 条）`);
    L.push('');
    L.push('| ID | 出处 | 定位 | 原文摘录 |');
    L.push('|---|---|---|---|');
    for (const m of mats) {
      const q = (m.quote || '').replace(/\|/g, '\\|').slice(0, 60);
      L.push(`| ${m.id} | ${m.source} | ${m.locator} | ${q}… |`);
    }
    L.push('');
  }

  const issues = result.analysis?.issues || [];
  if (issues.length) {
    L.push(`## 争点分析（${issues.length} 个）`);
    L.push('');
    for (const i of issues) {
      L.push(`### ${i.id} · ${i.question}`);
      L.push('');
      L.push(`- 置信度：${i.confidence}`);
      L.push(`- 引用：${i.cites.join('、')}`);
      L.push('');
    }
  }

  const secs = result.draft?.sections || [];
  if (secs.length) {
    L.push(`## 法律分析意见书`);
    L.push('');
    for (const s of secs) {
      L.push(`### ${s.heading}`);
      L.push('');
      L.push(s.body);
      L.push('');
    }
  }

  if (result.qc) {
    L.push(`## 质检结论`);
    L.push('');
    L.push(`- 裁决：**${result.qc.verdict}**`);
    if (result.qc.findings?.length) {
      L.push('');
      for (const f of result.qc.findings) {
        L.push(`- [${f.severity}] ${f.issueId}：${f.problem} → ${f.fix}`);
      }
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('> 本文为工作底稿，不构成法律意见，须由执业律师复核。');
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 命令：check（引注核验）                                              */
/* ------------------------------------------------------------------ */

function cmdCheck(args) {
  let text = null;
  let label = '';

  if (args.flags.text) {
    text = String(args.flags.text);
    label = '(命令行输入)';
  } else if (args._[0]) {
    const p = resolve(args._[0]);
    text = readFileSync(p, 'utf8');
    label = basename(p);
  } else {
    // 支持从 stdin 读，方便管道：pbpaste | node cli.mjs check
    text = readFileSync(0, 'utf8');
    label = '(标准输入)';
  }

  const { citations, counts } = verifyText(text);

  console.log('');
  console.log(C.bold(`引注核验 · ${label}`));
  console.log(C.bold('─'.repeat(64)));
  console.log(
    `  共 ${counts.total} 处引用：` +
      `${C.green('✅ ' + counts.verified)} · ` +
      `${C.red('❌ ' + counts.notFound)} · ` +
      `${C.yellow('❓ ' + counts.lawUnknown)} · ` +
      `${C.dim('➖ ' + counts.outOfScope)}`,
  );
  console.log('');

  if (counts.total === 0) {
    console.log(C.dim('  没有识别到任何法规引用。'));
    console.log('');
    return 0;
  }

  for (const c of citations) {
    const icon = { verified: '✅', not_found: '❌', law_unknown: '❓', out_of_scope: '➖' }[c.status];
    const color =
      c.status === STATUS.VERIFIED ? C.green : c.status === STATUS.NOT_FOUND ? C.red : C.yellow;
    console.log(`  ${icon} ${color(c.raw)}`);
    console.log(C.dim(`     ${c.detail}`));
    if (c.quote && c.status === STATUS.VERIFIED) {
      console.log(C.dim(`     原文：${c.quote.slice(0, 70)}…`));
    }
    console.log('');
  }

  console.log(C.dim('─'.repeat(64)));
  console.log(C.dim('  ❌ 不等于"一定编造" —— 它表示本地语料库未收录，须人工核对原文。'));
  console.log('');

  // 有疑似编造时退出码 1，可接入 CI / pre-commit
  return counts.notFound > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* 命令：run（跑案例文件）                                              */
/* ------------------------------------------------------------------ */

async function cmdRun(args) {
  const file = args._[0] || 'cases/index.mjs';
  const path = resolve(file);
  const mod = await import(pathToFileURL(path).href);

  let cases = mod.CASES || mod.default || [];
  if (!Array.isArray(cases)) cases = [cases];

  const id = args.flags.id;
  if (id) {
    cases = cases.filter((c) => c.id === id);
    if (cases.length === 0) {
      console.error(C.red(`没找到案例 ${id}`));
      process.exit(2);
    }
  }

  const orch = createOrchestrator({
    retriever: createRetriever(),
    analyst: createAnalyst(),
    writer: createWriter(),
    qc: createQc(),
  });

  for (const c of cases) {
    const result = await orch.run(c);
    console.log(renderResult(result, c));
  }
}

/* ------------------------------------------------------------------ */
/* 命令：list（列出语料库能处理什么）                                     */
/* ------------------------------------------------------------------ */

async function cmdList() {
  const { CORPUS } = await import('./lib/corpus.mjs');
  const byKind = {};
  for (const m of CORPUS) {
    (byKind[m.kind] ||= []).push(m);
  }
  const kindName = { statute: '法律条文', case: '案例/司法解释', regulation: '规章', doctrine: '学理' };

  console.log('');
  console.log(C.bold(`本地语料库 · 共 ${CORPUS.length} 条`));
  console.log(C.bold('─'.repeat(64)));
  for (const [kind, items] of Object.entries(byKind)) {
    console.log('');
    console.log(C.cyan(`  ${kindName[kind] || kind}（${items.length} 条）`));
    for (const m of items) {
      console.log(`    ${C.dim(m.id)} ${m.source} ${m.locator}`);
    }
  }
  console.log('');
  console.log(C.dim('  这些是检索 Agent 唯一可用的材料来源 —— 它不会编造语料库里没有的条文。'));
  console.log(C.dim('  要扩充覆盖范围，编辑 lib/corpus.mjs。'));
  console.log('');
}

/* ------------------------------------------------------------------ */
/* 帮助                                                                 */
/* ------------------------------------------------------------------ */

function printHelp() {
  console.log(`
${C.bold('legal-agent · 四智能体法律检索工作流')}

${C.bold('用法')}
  node cli.mjs <命令> [参数]

${C.bold('命令')}
  ${C.cyan('ask')} "你的法律问题"        分析一个问题，产出法律意见书（最常用）
      --save                        同时保存 Markdown 到 out/
      --json                        输出结构化 JSON（给程序用）

  ${C.cyan('check')} <文件>              核验一份文件里的法条引用
      --text "文字"                 直接核验一段文字
      (无参数时从标准输入读，例如：pbpaste | node cli.mjs check)
      发现疑似编造时退出码为 1

  ${C.cyan('run')} [案例文件]            跑案例文件里的完整流水线
      --id CASE-001                 只跑指定案例

  ${C.cyan('list')}                      列出本地语料库能处理哪些法条与案例

${C.bold('例子')}
  node cli.mjs ask "公司未披露对外担保，投资者能否索赔？"
  node cli.mjs ask "虚假陈述的责任主体有哪些？" --save
  node cli.mjs check 我的法律意见书.md
  node cli.mjs check --text "根据《证券法》第九百九十九条…"
  node cli.mjs run cases/index.mjs --id CASE-001
  node cli.mjs list

${C.bold('说明')}
  · 零依赖，不需要 API key，不联网。
  · 材料只来自本地语料库（证券法/行政处罚法/公司法），不会编造条文。
  · 产出为工作底稿，不构成法律意见，须由执业律师复核。
`);
}

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return 0;
  }

  const args = parseArgs(argv.slice(1));

  try {
    switch (cmd) {
      case 'ask':
        await cmdAsk(args);
        return 0;
      case 'check':
        return cmdCheck(args);
      case 'run':
        await cmdRun(args);
        return 0;
      case 'list':
        await cmdList();
        return 0;
      default:
        console.error(C.red(`未知命令：${cmd}`));
        printHelp();
        return 2;
    }
  } catch (e) {
    console.error(C.red(`\n出错：${e.message}`));
    if (e.code) console.error(C.dim(`错误码：${e.code}`));
    if (process.env.DEBUG) console.error(e.stack);
    return 1;
  }
}

/**
 * 入口判定用 pathToFileURL —— 路径含中文时字符串拼接会恒为 false
 * （踩过的坑，见 README 第 11 条）。
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
