#!/usr/bin/env node
/**
 * Extract TypeScript types for the 584 IPC methods registered in the
 * official Claude Desktop main bundle.
 *
 * Approach:
 *   1. Scan `.tmp/official-app/.vite/build/index.js` for each
 *      `e.ipc.handle("$eipc_message$_<UID>_$_<ns>_$_<cls>_$_<method>", ...)`
 *      registration. The bundle wraps every handler in the same shape:
 *
 *        async (i, r) => {
 *          if (!ZA(i)) throw ...                  // origin guard
 *          if (!<ARG>(r)) throw ...                // arg guard (may be absent)
 *          const n = await <impl>.<method>(r)
 *          if (!<RES>(n)) throw ...                // result guard (may be absent)
 *          return n
 *        }
 *
 *   2. For each unique guard name, locate `function <name>(e) {return ...}`
 *      and translate the boolean expression to TS field annotations.
 *
 *   3. Emit one `<ns>::<cls>` group with `args` / `return` types.
 *
 * What this script does NOT do (yet):
 *   - Translate enum/union sets (e.g. `XFt = new Set([...])`) — flagged
 *     as `string` for now, manual annotation step is needed.
 *   - Extract event payloads (`ipc.on` channels, no validator wrapper).
 *
 * Run: node scripts/ipc-codegen/extract.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const bundlePath = resolve(repoRoot, '.tmp/official-app/.vite/build/index.js');
const outPath = resolve(repoRoot, 'docs/rebuild/ipc-types.d.ts');

const src = readFileSync(bundlePath, 'utf8');

/**
 * Find handler registrations. Each looks like:
 *   e.ipc.handle("$eipc_message$_<UID>_$_<NS>_$_<CLS>_$_<METHOD>",async(i,r)=>{ ...body... })
 * The body contains nested braces — regex alone can't slice it; we walk
 * forward from the channel literal and balance braces ourselves.
 */
function* findHandlers() {
  const channelRe =
    /e\.ipc\.handle\("\$eipc_message\$_[0-9a-f-]+_\$_([a-z][a-zA-Z._]+)_\$_([A-Z][A-Za-z]*)_\$_([a-z][A-Za-z]*)",async\(([^)]*)\)=>\{/g;
  let m;
  while ((m = channelRe.exec(src))) {
    const [, ns, cls, method, params] = m;
    const bodyStart = channelRe.lastIndex; // index right AFTER the opening `{`
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '"' || ch === "'" || ch === '`') {
        // skip string content (no escape concerns at this level — bundles
        // don't have stray braces inside strings that would break us)
        const quote = ch;
        i++;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') i++;
          i++;
        }
      }
      i++;
    }
    if (depth !== 0) continue;
    const body = src.slice(bodyStart, i - 1);
    yield { ns, cls, method, params, body };
  }
}

/** Extract the FIRST matching name from `if (!<NAME>(<arg>)) throw ...`
 *  in the handler body. Skips the origin guard which always uses ZA(i). */
function findValidator(body, paramName) {
  // The origin guard always uses (i) as arg. Match validator on `paramName`.
  const re = new RegExp(`if\\(!([A-Za-z_][A-Za-z0-9_$]*)\\(${paramName}\\)\\)`);
  const m = re.exec(body);
  return m ? m[1] : null;
}

/** Find a result validator: `if(!<NAME>(<localVar>))`. The local var is bound
 *  by `const <localVar>=await ...`. */
function findResultValidator(body) {
  const bind = /const\s+([a-zA-Z_$][\w$]*)\s*=\s*await\s/.exec(body);
  if (!bind) return null;
  const local = bind[1];
  const re = new RegExp(`if\\(!([A-Za-z_][A-Za-z0-9_$]*)\\(${local}\\)\\)`);
  const m = re.exec(body);
  return m ? m[1] : null;
}

/** Locate `function NAME(e){return ...}` and return the boolean body. */
function findFunctionBody(name) {
  const re = new RegExp(`function\\s+${name}\\(([^)]*)\\)\\{return!?\\(([^{}]+(?:\\{[^{}]*\\}[^{}]*)*)\\)\\}`);
  const m = re.exec(src);
  if (!m) return null;
  return { param: m[1], body: m[2] };
}

/**
 * Translate a `typeof e.X !== "string"` chain into TS field annotations.
 *
 * Patterns we recognise in the boolean expression (which collectively must
 * be `false` for the value to validate, hence the leading `!` outside):
 *
 *   !e
 *   typeof e !== "object"
 *   typeof e.X !== "string"            -> X: string
 *   typeof e.X !== "number"            -> X: number
 *   typeof e.X !== "boolean"           -> X: boolean
 *   !Array.isArray(e.X)                -> X: unknown[]
 *   typeof e.X !== "undefined" && typeof e.X !== "string"   -> X?: string
 *   e.X !== null && typeof e.X !== "object"                 -> X: object  (rough)
 *   !<NAME>(e.X)                       -> X: <Name>   (refers to another guard)
 *   typeof e.X !== "undefined" && !<NAME>(e.X)              -> X?: <Name>
 *
 * Anything we don't recognise becomes `unknown` with an inline comment.
 */
function translateGuard(name) {
  const fn = findFunctionBody(name);
  if (!fn) return { fields: [], unrecognised: ['<no body>'], paramName: 'e' };
  const { param, body } = fn;
  const fields = [];
  const unrecognised = [];

  // Tokenise on `||` at depth 0 — each clause should reject one bad shape.
  const clauses = splitTopLevel(body, '||');

  for (const raw of clauses) {
    const clause = raw.trim();
    // skip the umbrella !e and typeof e!=="object" checks
    if (clause === `!${param}`) continue;
    if (new RegExp(`^typeof\\s+${param}\\s*!=\\s*"object"$`).test(clause)) continue;

    const f = parseClause(clause, param);
    if (f) {
      // dedupe — optional + concrete pair collapse to optional
      const existing = fields.find((x) => x.name === f.name);
      if (existing) {
        existing.optional = existing.optional || f.optional;
        if (f.type !== 'unknown' && existing.type === 'unknown') existing.type = f.type;
      } else {
        fields.push(f);
      }
    } else {
      unrecognised.push(clause);
    }
  }
  return { fields, unrecognised, paramName: param };
}

/** Split a string on `sep` at parenthesis-depth 0. */
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (depth === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(last, i));
      last = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(s.slice(last));
  return out;
}

const TYPEOF = /^typeof\s+([\w.$[\]"']+)\s*!=\s*"(string|number|boolean|undefined|object|function)"$/;
const TYPEOF_OPTIONAL =
  /^typeof\s+([\w.$[\]"']+)\s*<\s*"u"\s*&&\s*typeof\s+\1\s*!=\s*"(string|number|boolean|object|function)"$/;
const NOT_ARRAY = /^!Array\.isArray\(([\w.$[\]"']+)\)$/;
const GUARD_FN = /^!([A-Za-z_$][\w$]*)\(([\w.$[\]"']+)\)$/;
const GUARD_FN_OPTIONAL =
  /^typeof\s+([\w.$[\]"']+)\s*<\s*"u"\s*&&\s*!([A-Za-z_$][\w$]*)\(\1\)$/;
const NULLISH_OBJECT =
  /^([\w.$[\]"']+)\s*!==?\s*null\s*&&\s*typeof\s+\1\s*!=\s*"object"$/;

function parseClause(c, param) {
  // typeof e.X != "string"
  let m = TYPEOF.exec(c);
  if (m) {
    const path = stripPath(m[1], param);
    if (!path) return null;
    return { name: path, optional: false, type: tsType(m[2]) };
  }
  // typeof e.X < "u" && typeof e.X != "string"
  m = TYPEOF_OPTIONAL.exec(c);
  if (m) {
    const path = stripPath(m[1], param);
    if (!path) return null;
    return { name: path, optional: true, type: tsType(m[2]) };
  }
  // !Array.isArray(e.X)
  m = NOT_ARRAY.exec(c);
  if (m) {
    const path = stripPath(m[1], param);
    if (!path) return null;
    return { name: path, optional: false, type: 'unknown[]' };
  }
  // !FOO(e.X)
  m = GUARD_FN.exec(c);
  if (m) {
    const path = stripPath(m[2], param);
    if (!path) return null;
    return { name: path, optional: false, type: `/* ${m[1]} */ unknown` };
  }
  // typeof e.X < "u" && !FOO(e.X)
  m = GUARD_FN_OPTIONAL.exec(c);
  if (m) {
    const path = stripPath(m[1], param);
    if (!path) return null;
    return { name: path, optional: true, type: `/* ${m[2]} */ unknown` };
  }
  // e.X !== null && typeof e.X != "object" (object | null requirement)
  m = NULLISH_OBJECT.exec(c);
  if (m) {
    const path = stripPath(m[1], param);
    if (!path) return null;
    return { name: path, optional: false, type: 'object | null' };
  }
  return null;
}

function stripPath(path, param) {
  if (path === param) return null;
  if (path.startsWith(param + '.')) return path.slice(param.length + 1);
  return null;
}

function tsType(t) {
  if (t === 'undefined') return 'undefined';
  if (t === 'object') return 'Record<string, unknown>';
  return t;
}

// -----------------------------------------------------------------------------
// Drive

const handlers = [...findHandlers()];
console.error(`scanned ${handlers.length} handler registrations`);

const bySpec = new Map(); // ns::cls -> { method -> { argFn, retFn } }
for (const h of handlers) {
  const params = h.params.split(',').map((s) => s.trim()); // ["i","r"] usually
  const argParam = params[1]; // first user arg after origin
  const argFn = argParam ? findValidator(h.body, argParam) : null;
  const retFn = findResultValidator(h.body);
  const key = `${h.ns}::${h.cls}`;
  if (!bySpec.has(key)) bySpec.set(key, new Map());
  bySpec.get(key).set(h.method, { argFn, retFn });
}

console.error(`distinct ns::cls groups: ${bySpec.size}`);
let totalMethods = 0;
for (const m of bySpec.values()) totalMethods += m.size;
console.error(`distinct methods: ${totalMethods}`);

// Translate each unique validator
const validatorCache = new Map();
function translate(name) {
  if (!name) return null;
  if (validatorCache.has(name)) return validatorCache.get(name);
  const t = translateGuard(name);
  validatorCache.set(name, t);
  return t;
}

// -----------------------------------------------------------------------------
// Emit

function fieldsToTs(t) {
  if (!t) return 'unknown';
  if (t.fields.length === 0 && t.unrecognised.length === 0) return 'Record<string, unknown>';
  const lines = t.fields.map(
    (f) => `  ${f.name}${f.optional ? '?' : ''}: ${f.type};`,
  );
  for (const u of t.unrecognised) lines.push(`  // unparsed: ${u}`);
  return `{\n${lines.join('\n')}\n}`;
}

const out = [];
out.push('// Auto-generated by scripts/ipc-codegen/extract.mjs');
out.push('// Source: .tmp/official-app/.vite/build/index.js');
out.push('// DO NOT EDIT — re-run the script to refresh.');
out.push('');

const groups = [...bySpec.entries()].sort(([a], [b]) => a.localeCompare(b));
for (const [key, methods] of groups) {
  const [ns, cls] = key.split('::');
  out.push(`// ----- ${key} -----`);
  out.push(`export interface ${cls.replace(/[^A-Za-z0-9]/g, '')}Args {`);
  for (const [method, { argFn }] of methods) {
    const t = translate(argFn);
    out.push(`  ${method}: ${argFn ? fieldsToTs(t) : 'undefined'};`);
  }
  out.push(`}`);
  out.push(`export interface ${cls.replace(/[^A-Za-z0-9]/g, '')}Return {`);
  for (const [method, { retFn }] of methods) {
    const t = translate(retFn);
    out.push(`  ${method}: ${retFn ? fieldsToTs(t) : 'void'};`);
  }
  out.push(`}`);
  out.push('');
}

writeFileSync(outPath, out.join('\n'));
console.error(`wrote ${outPath} (${out.length} lines)`);
