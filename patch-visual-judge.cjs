const fs = require('fs');
const path = require('path');
const { preserveBeforeWrite } = require('./tools/auxiliary-backup.cjs');
const versionBackupDir = process.argv[2] || null;
const userProfile = process.env.USERPROFILE || process.env.HOME || '';

const files = [
  path.join(userProfile, '.zcode/cli/plugins/cache/zcode-plugins-official/documents/0.1.7/agents/visual-judge.md'),
  path.join(userProfile, '.zcode/cli/plugins/cache/zcode-plugins-official/pdf/0.1.7/agents/visual-judge.md'),
  path.join(userProfile, '.zcode/cli/plugins/cache/zcode-plugins-official/presentations/0.1.7/agents/visual-judge.md'),
  path.join(userProfile, '.zcode/cli/plugins/cache/zcode-plugins-official/spreadsheets/0.1.7/agents/visual-judge.md')
];

for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let content = fs.readFileSync(f, 'utf8');
    const oldPrefix = 'description: "THE single visual acceptance pass';
    if (content.includes(oldPrefix)) {
        const lineEnd = content.indexOf('\n', content.indexOf(oldPrefix));
        const newDesc = 'description: "Revisor de aceitação visual exclusivo para entregáveis renderizados (pptx, docx, xlsx, pdf, pôster e gráficos)."';
        content = content.substring(0, content.indexOf(oldPrefix)) + newDesc + content.substring(lineEnd);
        preserveBeforeWrite(f, versionBackupDir);
        fs.writeFileSync(f, content, 'utf8');
        console.log('[OK] Translated visual-judge in:', f);
    }
}
