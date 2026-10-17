/**
 * 打包脚本：把 legal-agent 的 JS 引擎打成能直接注入 WKWebView 的单个文件
 *
 * ## 为什么需要这一步
 *
 * 桌面 App 不能让用户先装 Node 才能用。所以法律逻辑不能以"调用 node 进程"的方式
 * 运行，必须能**在 WebView 里直接执行**。
 *
 * ## 做法
 *
 * 项目里的模块用的是 ESM（import/export）。要在一个没有模块加载器的 WebView 里跑，
 * 就把它转成"一个函数作用域 + 显式的依赖注入表"：
 *
 *   · 每个模块变成 function(__mod) { ... }，内部把 `export` 标成 `__exports.xxx = ...`
 *   · `import { a, b } from './x.mjs'` 变成从 __mod['x.mjs'] 解构
 *
 * 这里有意的**不引入** rollup / esbuild / webpack：一共四个模块、依赖关系简单且稳定，
 * 手写转换只有几十行，可读可调试；引入打包器反而多一层黑箱。
 *
 * ## 输出
 *
 * engine.generated.js —— 一个立即执行函数，执行后会在页面全局挂上 window.LegalEngine，
 * 提供 ask(question) / check(text) / corpus() 三个方法，返回 Promise。
 *
 * 用法：node bundle-engine.mjs <输出路径>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..'); // legal-agent/

/**
 * 模块清单。
 *
 * 顺序即依赖顺序：被依赖的排在前面。这个表是手工维护的 ——
 * 模块只有 5 个，手写比解析 ESM 图更直观，出错时错误信息也更明确。
 *
 * key = 输出到 __mod 里用的名字（在各模块内部 import 时按此名字引用）
 */
const MODULES = [
  { key: 'corpus', file: 'lib/corpus.mjs' },
  { key: 'protocol', file: 'lib/protocol.mjs' },
  { key: 'audit', file: 'lib/audit.mjs' },
  { key: 'agents', file: 'agents/index.mjs' },
  { key: 'orchestrator', file: 'lib/orchestrator.mjs' },
  { key: 'cites', file: 'lib/cites.mjs' },
];

/** 把一个 .mjs 源码转成"函数体"，并把 import/export 改写成本地绑定 */
function transform(source, moduleKey) {
  let out = source;

  // ① export function foo(...) → function foo(...)  并登记导出
  //    收集所有具名导出，最后统一挂到 __exports
  const exportNames = new Set();

  out = out.replace(/^export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, (m, asy, name) => {
    exportNames.add(name);
    return `${asy || ''}function ${name}`;
  });

  out = out.replace(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    exportNames.add(name);
    return `class ${name}`;
  });

  out = out.replace(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    exportNames.add(name);
    return `const ${name}`;
  });

  out = out.replace(/^export\s+let\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    exportNames.add(name);
    return `let ${name}`;
  });

  // ② export { a, b } 形式
  out = out.replace(/^export\s*\{([^}]*)\}\s*;?$/gm, (m, list) => {
    for (const piece of list.split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop().trim();
      if (name) exportNames.add(name);
    }
    return '// [bundler] export{} 已收集';
  });

  // ③ import ... from './xxx.mjs'
  //    解析出依赖模块 key，并从 __mod[key] 解构
  out = out.replace(
    /^import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]\s*;?$/gm,
    (m, named, def, spec) => {
      const depKey = resolveSpecifier(moduleKey, spec);
      if (named) {
        // 处理 `as` 别名与换行
        const bindings = named
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const parts = s.split(/\s+as\s+/);
            return parts.length === 2 ? `${parts[0].trim()}: ${parts[1].trim()}` : parts[0].trim();
          })
          .join(', ');
        return `const { ${bindings} } = __mod['${depKey}'];`;
      }
      return `const ${def} = __mod['${depKey}'].default;`;
    },
  );

  // ④ 个别文件有裸 import（无 from），例如 import 'x' —— 本项目没有，留个守卫
  // ⑤ 生成导出表
  const exportBlock =
    exportNames.size > 0
      ? `__exports = { ${[...exportNames].join(', ')} };`
      : '';

  return `/* ===== ${moduleKey} (${moduleKey ? '' : ''}) ===== */\n` +
    `__mod['${moduleKey}'] = (() => {\nlet __exports = {};\n${out}\n${exportBlock}\nreturn __exports;\n})();\n`;
}

/** 把 './corpus.mjs' 这种相对路径映射到模块清单里的 key */
function resolveSpecifier(fromKey, spec) {
  const map = {
    './protocol.mjs': 'protocol',
    './orchestrator.mjs': 'orchestrator',
    './audit.mjs': 'audit',
    './corpus.mjs': 'corpus',
    '../lib/protocol.mjs': 'protocol',
    '../lib/orchestrator.mjs': 'orchestrator',
    '../lib/audit.mjs': 'audit',
    '../lib/corpus.mjs': 'corpus',
    '../agents/index.mjs': 'agents',
    './index.mjs': fromKey === 'agents' ? 'agents' : 'agents',
  };
  const key = map[spec];
  if (!key) {
    throw new Error(`[bundler] 无法解析 import '${spec}'（来自模块 ${fromKey}）—— 请在 resolveSpecifier 里补一条映射`);
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* 组装                                                                 */
/* ------------------------------------------------------------------ */

function build() {
  const parts = [];

  parts.push(`/**
 * 法律分析引擎 · 打包产物（自动生成，不要手改）
 * 生成时间：${new Date().toISOString()}
 *
 * 由 desktop/build.sh 调用 bundle-engine.mjs 生成。
 * 源文件：legal-agent/{lib/*.mjs, agents/index.mjs}
 */
(function () {
'use strict';

const __mod = {};
`);

  for (const m of MODULES) {
    const src = readFileSync(resolve(ROOT, m.file), 'utf8');
    parts.push(transform(src, m.key));
  }

  // 暴露给页面的 API
  parts.push(`
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
`);

  return parts.join('\n');
}

const outPath = process.argv[2] || resolve(HERE, 'web/engine.generated.js');
const code = build();
writeFileSync(outPath, code, 'utf8');

// 语法自检：能通过 new Function 就说明至少不是语法错误
try {
  new Function(code);
} catch (e) {
  console.error(`[bundler] 生成的代码有语法错误：${e.message}`);
  process.exit(1);
}

console.log(`[bundler] 已生成 ${outPath}（${code.length} 字符，${MODULES.length} 个模块）`);
