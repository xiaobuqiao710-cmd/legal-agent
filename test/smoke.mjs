import { createOrchestrator } from '../lib/orchestrator.mjs';
import { createRetriever, createAnalyst, createWriter, createQc } from '../agents/index.mjs';
import { CASES } from '../cases/index.mjs';

const orch = createOrchestrator({
  retriever: createRetriever(),
  analyst: createAnalyst(),
  writer: createWriter(),
  qc: createQc(),
  onEvent: (e) => console.log(`  [${e.type}]`, e.stage ? `${e.stage}${e.attempt!==undefined?`(try ${e.attempt})`:''}` : (e.verdict||e.reason||'')),
});

const r = await orch.run(CASES[0]);
console.log('\n=== RESULT ===');
console.log('status:', r.status, '| revisions:', r.revisions);
console.log('materials:', r.retrieval?.materials?.length);
console.log('issues:', r.analysis?.issues?.length);
console.log('draft sections:', r.draft?.sections?.length);
console.log('qc verdict:', r.qc?.verdict, '| findings:', r.qc?.findings?.length);
console.log('transcript len:', r.transcript?.length);
