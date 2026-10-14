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
const manifest: { categories?: string[] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'),
);

describe('extension manifest', () => {
  it('names only categories the Marketplace accepts, the gap that let "Agents" block the 2.1.0 upload', () => {
    const categories = manifest.categories ?? [];
    const unknown = categories.filter((category) => !MARKETPLACE_CATEGORIES.includes(category));
    assert.deepStrictEqual(unknown, []);
  });

  it('declares at least one category, so the check above cannot pass by having nothing to check', () => {
    assert.ok((manifest.categories ?? []).length > 0);
  });
});
