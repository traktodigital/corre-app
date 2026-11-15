import fs from 'node:fs';
import ts from 'typescript';

const KEEP = /eslint-|@ts-|prettier-ignore/;

function kindOf(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function strip(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kindOf(file));
  const cuts = new Map();
  const add = r => {
    if (!KEEP.test(text.slice(r.pos, r.end))) cuts.set(r.pos, r.end);
  };
  const visit = node => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    if (ts.isJsxExpression(node) && !node.expression) {
      const start = node.getStart(sf);
      if (!KEEP.test(text.slice(start, node.end))) cuts.set(start, node.end);
      return;
    }
    ts.getLeadingCommentRanges(text, node.pos)?.forEach(add);
    ts.getTrailingCommentRanges(text, node.end)?.forEach(add);
    for (const child of node.getChildren(sf)) visit(child);
  };
  ts.getLeadingCommentRanges(text, 0)?.forEach(add);
  visit(sf);
  ts.getLeadingCommentRanges(text, sf.endOfFileToken.pos)?.forEach(add);
  let out = text;
  let limit = Infinity;
  for (const [start, end] of [...cuts].sort((a, b) => b[0] - a[0])) {
    if (end > limit) continue;
    out = out.slice(0, start) + out.slice(end);
    limit = start;
  }
  if (out !== text) fs.writeFileSync(file, out);
  return out !== text;
}

let changed = 0;
for (const file of process.argv.slice(2)) if (strip(file)) changed++;
console.log(`${changed} arquivo(s) sem comentários`);
