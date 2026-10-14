import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// The categories the Marketplace accepts for a VS Code extension, as VS Code
// defines them in EXTENSION_CATEGORIES (src/vs/platform/extensions/common/
// extensions.ts). vsce does not check them and neither does the compiler: the
// Marketplace rejects an unknown one at upload, after CI has passed and the
// release has been built.
const MARKETPLACE_CATEGORIES = [
  'AI',
  'Azure',
  'Chat',
  'Data Science',
  'Debuggers',
  'Extension Packs',
  'Education',
  'Formatters',
  'Keymaps',
  'Language Packs',
  'Linters',
  'Machine Learning',
  'Notebooks',
  'Programming Languages',
  'SCM Providers',
  'Snippets',
  'Testing',
  'Themes',
  'Visualization',
  'Other',
];

// Compiled tests run from test-out/test, two levels below the manifest.
const extensionRoot = path.join(__dirname, '..', '..');

interface Manifest {
  categories?: string[];
  contributes?: {
    commands?: { command: string; title: string }[];
    menus?: Record<string, { command: string }[]>;
    keybindings?: { command: string; key: string }[];
  };
}

const manifest: Manifest = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'),
);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('extension manifest', () => {
  it('names only categories the Marketplace accepts, the gap that let "Agents" block the 2.1.0 upload', () => {
    const categories = manifest.categories ?? [];
    const unknown = categories.filter((category) => !MARKETPLACE_CATEGORIES.includes(category));
    assert.deepStrictEqual(unknown, []);
  });

  it('declares at least one category, so the check above cannot pass by having nothing to check', () => {
    assert.ok((manifest.categories ?? []).length > 0);
  });

  it('registers a handler for every command it advertises, the gap that put a command with no code behind it in the palette', () => {
    const source = sourceFiles(path.join(extensionRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const commands = (manifest.contributes?.commands ?? []).map((entry) => entry.command);
    assert.ok(commands.length > 0);

    const unregistered = commands.filter((command) => !source.includes(`registerCommand('${command}'`));
    assert.deepStrictEqual(unregistered, []);
  });

  it('points menus and keybindings only at commands it declares, so hiding a command cannot leave a dead menu entry or shortcut', () => {
    const declared = new Set((manifest.contributes?.commands ?? []).map((entry) => entry.command));
    const menuCommands = Object.values(manifest.contributes?.menus ?? {}).flat().map((entry) => entry.command);
    const keyCommands = (manifest.contributes?.keybindings ?? []).map((entry) => entry.command);

    const dangling = [...menuCommands, ...keyCommands].filter((command) => !declared.has(command));
    assert.deepStrictEqual(dangling, []);
  });

  it('does not bind Ctrl+K alone, which VS Code uses as the first half of many of its own shortcuts', () => {
    const keys = (manifest.contributes?.keybindings ?? []).map((entry) => entry.key.toLowerCase());
    assert.ok(!keys.includes('ctrl+k'));
  });
});
