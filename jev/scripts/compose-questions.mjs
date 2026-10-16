import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(readFileSync(resolve(root, 'questions', name), 'utf8'));

// Select reusable questions; never rewrite them from evidence or a step's schema.
export function composeQuestions(presetNames, { library = read('library.json'), presets = read('presets.json').presets } = {}) {
  if (!Array.isArray(presetNames) || !presetNames.length) throw new Error('Select at least one preset');
  const ids = new Set();
  for (const name of presetNames) {
    if (!Object.hasOwn(presets, name)) throw new Error(`Unknown preset: ${name}`);
    for (const id of presets[name].question_ids) {
      if (!Object.hasOwn(library, id)) throw new Error(`Unknown question: ${id}`);
      ids.add(id);
    }
  }
  return Object.fromEntries([...ids].map(id => [id, structuredClone(library[id])]));
}

export function preparePacket(state, presetNames) {
  // Only reject an absent/empty transport value. No ticket, routing or evidence paths
  // are required. The caller owns source-access and live execution checks.
  if (state == null || (typeof state === 'string' && !state.trim()) ||
      (typeof state === 'object' && !Object.keys(state).length) ||
      !['string', 'object'].includes(typeof state)) throw new Error('Supply nonempty task evidence');
  return { state: structuredClone(state), questions: composeQuestions(presetNames) };
}

export function exportPresets() {
  return Object.entries(read('presets.json').presets).flatMap(([name, preset]) =>
    [preset.export_file, ...(preset.export_aliases ?? [])].map(filename => {
      if (typeof filename !== 'string' || !/^[a-z0-9-]+\.json$/.test(filename)) throw new Error(`Invalid export filename for ${name}`);
      return { filename, content: JSON.stringify(composeQuestions([name]), null, 2) + '\n' };
    }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--export') {
      for (const { filename, content } of exportPresets()) writeFileSync(resolve(root, 'questions', filename), content);
    } else {
      const presetNames = [];
      let stateFile;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--preset' && args[i + 1]) presetNames.push(args[++i]);
        else if (args[i] === '--state' && args[i + 1]) stateFile = args[++i];
        else throw new Error('Usage: compose-questions.mjs --preset NAME [--preset NAME] [--state FILE], or --export');
      }
      let output;
      if (stateFile) {
        const raw = readFileSync(stateFile, 'utf8');
        output = preparePacket(stateFile.endsWith('.json') ? JSON.parse(raw) : raw, presetNames);
      } else output = composeQuestions(presetNames);
      console.log(JSON.stringify(output, null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
