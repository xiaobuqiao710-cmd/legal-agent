/**
 * check-cites.mjs —— 引注核验的**命令行程外壳**
 *
 * 核验逻辑本身在 `lib/cites.mjs`（纯函数、零 Node 依赖，WebView 里也能跑）。
 * 本文件只负责三件事：读输入、打印报告、设退出码。
 *
 * 这样分层的原因见 lib/cites.mjs 顶部注释：逻辑与调用方式必须解耦，
 * 否则同一份能力在桌面 App 里就跑不了。
 *
 * 用法：
 *   node tools/check-cites.mjs <文件路径>
 *   node tools/check-cites.mjs --text "某段包含引用的文字"
 *   cat 文书.md | node tools/check-cites.mjs -
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyText, STATUS } from '../lib/cites.mjs';

// 重新导出，保持向后兼容（之前的测试与文档都从这里取）
export { extractCitations, verifyText, cnToNumber, STATUS, COVERED_LAWS } from '../lib/cites.mjs';

const ICON = {
  [STATUS.VERIFIED]: '✅',
  [STATUS.NOT_FOUND]: '❌',
  [STATUS.LAW_UNKNOWN]: '❓',
  [STATUS.OUT_OF_SCOPE]: '➖',
};

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
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) main();
