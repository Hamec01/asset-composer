// The offline UI and repository guide share a single content source.
import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/data/helpContent.ts', import.meta.url), 'utf8');
const read = name => JSON.parse(source.match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`))[1]);
const topics = read('HELP_TOPICS'), faq = read('HELP_FAQ');
const guide = '# Руководство Asset Composer\n\nРабота с текущими возможностями редактора. Справка также доступна в приложении по F1.\n\n' + topics.map(t => `<a id="${t.id}"></a>\n\n## ${t.title}\n\n${t.summary}\n\n${t.steps.map((s,i) => `${i+1}. ${s}`).join('\n')}\n`).join('\n');
const answers = '# FAQ Asset Composer\n\n' + faq.map(f => `## ${f.question}\n\n${f.answer}\n`).join('\n');
writeFileSync(new URL('../docs/user-guide.ru.md', import.meta.url), guide);
writeFileSync(new URL('../docs/faq.ru.md', import.meta.url), answers);
