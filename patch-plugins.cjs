const fs = require('fs');
const path = require('path');
const os = require('os');
const { preserveBeforeWrite } = require('./tools/auxiliary-backup.cjs');

console.log("====================================================================");
console.log("    TRADUTOR DE SKILLS E PLUGINS DO ZCODE - EMERSON TELES          ");
console.log("====================================================================");

const userProfile = process.env.USERPROFILE || os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
const zcodeUserDir = path.join(userProfile, '.zcode');
const versionBackupDir = process.argv[2] || null;
const zcodeGlmDir = process.argv[3] || path.join(localAppData, 'Programs', 'zcode', 'resources', 'glm');

// Mapeamento completo de descrições e títulos para SKILL.md e manifestos
const SKILL_TRANSLATIONS = {
    // 1. Cloudbase Skills (28 itens)
    "ai-model-nodejs": "Use esta habilidade para IA de backend em Node.js via @cloudbase/node-sdk (>=3.16.0) — funções na nuvem, CloudRun, Express, Koa, NestJS, APIs sem servidor, tarefas agendadas e proxies LLM.",
    "ai-model-web": "Use esta habilidade quando um aplicativo de navegador/Web (React, Vue, Angular, Next, Nuxt, sites estáticos, SPAs, dashboards, UI de chat de IA) precisar de modelos de IA.",
    "ai-model-wechat": "Use esta habilidade para IA em Mini Program do WeChat via wx.cloud.extend.AI (miniprogramas, miniprogramas corporativos, apps wx.cloud). Suporta geração de texto e streaming.",
    "auth-nodejs-cloudbase": "Guia de autenticação do CloudBase Node SDK para identidade no servidor, consulta de usuários e tickets de login personalizados. Use em código Node.js.",
    "auth-tool-cloudbase": "Guia de configuração e prontidão de login para provedores de autenticação do CloudBase. Use para inspecionar, ativar, desativar ou configurar autenticações.",
    "auth-web-cloudbase": "Guia rápido de autenticação Web do CloudBase para integração de front-end após verificação do auth-tool. Fornece passos concisos e práticos de integração.",
    "auth-wechat-miniprogram": "Guia de autenticação nativa do CloudBase para WeChat Mini Program. Use quando precisar de gerenciamento de identidade, login automático e sessão no miniprograma.",
    "cloud-functions": "Guia de execução de funções do CloudBase para criar, implantar e depurar suas próprias Funções de Evento ou Funções HTTP.",
    "cloud-storage-web": "Guia completo de armazenamento em nuvem do CloudBase usando o Web SDK (@cloudbase/js-sdk): upload, download, URLs temporárias, gerenciamento de arquivos e permissões.",
    "cloudbase": "Use esta habilidade ao desenvolver, projetar, compilar, implantar, depurar, migrar ou solucionar problemas em projetos do CloudBase (TCB, Tencent CloudBase, WeChat CloudBase).",
    "cloudbase-agent": "Crie e implante agentes de IA com o CloudBase Agent SDK (TypeScript e Python). Implementa o protocolo AG-UI para streaming de comunicação entre agente e interface.",
    "cloudbase-cli": "Habilidade de gerenciamento de recursos com o CloudBase CLI (tcb, Tencent CloudBase CLI). Use para implantar, gerenciar e automatizar recursos da nuvem.",
    "cloudbase-code-review": "Revisão e validação de código para projetos do CloudBase. Após escrever código para Web, miniprogramas, CloudRun ou funções em nuvem, use para inspecionar e validar.",
    "cloudbase-document-database-in-wechat-miniprogram": "Use o SDK de banco de dados NoSQL do CloudBase para WeChat Mini Program para consultar, criar, atualizar e excluir dados, com suporte a paginação e consultas avançadas.",
    "cloudbase-document-database-web-sdk": "Use o Web SDK do banco de dados NoSQL do CloudBase para trabalhar com coleções NoSQL: consultar, criar, atualizar e excluir dados de documentos.",
    "cloudbase-platform": "Visão geral e guia de roteamento da plataforma CloudBase. Use quando precisar de seleção de recursos de alto nível, conceitos da plataforma e arquitetura.",
    "cloudbase-wechat-integration": "Guia de integração do CloudBase com WeChat para WeChat Pay em Mini Programas, JSAPI Pay em Contas Oficiais, pagamento por QR Code nativo e OAuth.",
    "cloudrun-development": "Regras de desenvolvimento backend para o CloudBase Run (modo Função / modo Contêiner). Use ao implantar serviços backend que exigem Docker ou alta escalabilidade.",
    "data-model-creation": "[Descontinuado] Ferramenta avançada opcional para modelagem complexa de dados. Para criação simples de tabelas MySQL, utilize diretamente a ferramenta de banco relacional.",
    "http-api-cloudbase": "Guia do cliente da API HTTP oficial do CloudBase. Use quando backends, scripts ou clientes sem SDK precisarem chamar a plataforma CloudBase diretamente.",
    "miniprogram-development": "Habilidade de desenvolvimento para WeChat Mini Program: compilação, depuração, pré-visualização, testes, publicação e otimização de miniprogramas.",
    "ops-inspector": "Habilidade de inspeção em um clique no estilo AIOps para recursos do CloudBase. Diagnostica erros, verifica a saúde dos recursos e inspeciona métricas.",
    "postgresql-development-cloudbase": "Use ao compilar, depurar ou avaliar aplicativos com CloudBase PostgreSQL / CloudBase PG, incluindo configuração de esquemas Postgres, consultas e migrações.",
    "relational-database-mcp-cloudbase": "[Descontinuado] Documentação necessária para agentes operando no Banco de Dados Relacional do CloudBase via MCP.",
    "relational-database-web-cloudbase": "[Descontinuado] Use ao compilar front-ends Web que se comunicam com o Banco de Dados Relacional do CloudBase via @cloudbase/js-sdk.",
    "spec-workflow": "Use quando mudanças médias a grandes precisarem de requisitos explícitos, projeto técnico e planejamento de tarefas antes da implementação.",
    "ui-design": "Use quando precisar de direção visual, hierarquia de interface, decisões de layout, especificações de design ou protótipos antes da implementação.",
    "web-development": "Use para implementar, integrar, depurar, compilar, implantar ou validar um front-end Web após o direcionamento do produto estar definido.",

    // 2. Documentos, PDF, Apresentações e Planilhas
    "docx": "Recursos completos de criação, edição e análise de documentos DOCX com suporte a revisões, comentários, preservação de formatação e extração de texto.",
    "pdf": "Kit de ferramentas profissional de PDF cobrindo quatro fluxos de produção: relatórios, recursos visuais criativos, LaTeX acadêmico e processamento de PDFs existentes.",
    "plugin-creator": "Crie ou atualize o código-fonte de plugins do ZCode e um marketplace de teste local, guiando o usuário para adicionar, instalar, atualizar e testar no aplicativo.",
    "pptx": "Use esta habilidade sempre que um arquivo de apresentação for a entrada ou saída principal. Cria novas apresentações .pptx do zero ou a partir de um esboço/documento.",
    "skill-creator": "Crie novas habilidades, edite habilidades existentes e aprimore textos. Use ao escrever SKILL.md do zero ou transformar fluxos repetidos em habilidades reutilizáveis.",
    "xlsx": "Use esta habilidade sempre que um arquivo de planilha for a entrada ou saída principal. Permite abrir, ler, editar ou corrigir arquivos .xlsx, .xlsm e .csv existentes.",

    // 3. Guia do ZCode (ZCode Guide)
    "diagnosing-commands": "Use para diagnosticar e corrigir problemas de configuração de comandos de barra personalizados (/comando) no cliente ZCode.",
    "diagnosing-hooks": "Use para diagnosticar e corrigir problemas de configuração de hooks no cliente ZCode. Aplica-se quando um hook não dispara ou o script não é executável.",
    "diagnosing-mcp": "Use para diagnosticar e corrigir problemas de configuração de servidores MCP (Model Context Protocol) no cliente ZCode.",
    "diagnosing-plugins": "Use para diagnosticar e corrigir problemas de plugins e marketplaces no cliente ZCode. Aplica-se quando um plugin não é listado ou a instalação falha.",
    "diagnosing-skills": "Use para diagnosticar e corrigir problemas de configuração de habilidades no cliente ZCode. Aplica-se quando uma habilidade não é detectada ou não dispara.",
    "zcode-configuration-guide": "Use ao configurar os recursos de extensão do ZCode (servidores MCP, comandos de barra, habilidades, hooks e plugins) ou arquivos como AGENTS.md."
};

const PLUGIN_STRING_REPLACEMENTS = {
    // Exact items from the user's images:
    "Official ZCode image search MCP server for finding illustrations and reference images.": "Servidor MCP oficial do ZCode para busca de imagens, ilustrações e referências visuais.",
    "PDF document production skills, published as an official ZCode plugin.": "Habilidades de produção de documentos PDF, publicado como um plugin oficial do ZCode.",
    "PPTX presentation production skills, published as an official ZCode plugin.": "Habilidades de produção de apresentações PPTX, publicado como um plugin oficial do ZCode.",
    "XLSX spreadsheet production skills, published as an official ZCode plugin.": "Habilidades de produção de planilhas XLSX, publicado como um plugin oficial do ZCode.",
    "DOCX document production skills, published as an official ZCode plugin.": "Habilidades de produção de documentos DOCX, publicado como um plugin oficial do ZCode.",
    
    // Outros plugins oficiais
    "CloudBase development skills and MCP integration for building, deploying, and troubleshooting Web, WeChat Mini Program, database, cloud function, CloudRun, storage, and AI projects.": "Habilidades de desenvolvimento CloudBase e integração MCP para criar, implantar e solucionar problemas em Web, WeChat Mini Program, banco de dados, funções na nuvem, CloudRun, armazenamento e projetos de IA.",
    "Provides Android development workflows and emulator automation for ZCode.": "Fornece fluxos de trabalho de desenvolvimento Android e automação de emuladores para o ZCode.",
    "Provides iOS development workflows and simulator automation for ZCode.": "Fornece fluxos de trabalho de desenvolvimento iOS e automação de simuladores para o ZCode.",
    "Computer Use: automate desktop apps with mouse, keyboard, and UI element control.": "Uso do computador: automatize aplicativos de desktop com controle de mouse, teclado e elementos de interface.",
    "Built-in browser automation runtime and guidance for Desktop IAB and explicitly enabled CLI-managed headless CDP: open, navigate, inspect, click, type, screenshot, record workspace WebM videos, and verify web pages and local dev targets.": "Ambiente de automação de navegador integrado para navegar, inspecionar, clicar, digitar, capturar telas e gravar vídeos WebM.",
    "GitHub CLI workflows for commits, pull requests, issues, releases, Actions, repositories, Codespaces, and other GitHub resources.": "Fluxos de trabalho do GitHub CLI para commits, pull requests, issues, releases, Actions e repositórios.",
    "GitLab CLI workflows based on GitLab's official Agent Skills for merge requests, issues, CI/CD, repositories, releases, and API operations.": "Fluxos de trabalho do GitLab CLI para merge requests, issues, CI/CD, repositórios, releases e operações de API.",
    "Local-first security guardrails for ZCode with pre-write hooks, end-of-turn review, Git gates, commands, a security-scan skill, and an optional MCP server for sealed deep scans.": "Diretrizes de segurança locais para o ZCode com hooks pré-gravação, revisão pós-turno, travas Git, comandos e varredura de segurança.",
    "Develop and validate ZCode plugins through a local dev marketplace, installation, trials and updates.": "Desenvolva e valide plugins do ZCode através de um marketplace de desenvolvimento local, instalação e atualizações.",
    "Create, edit, and iterate local ZCode skills.": "Crie, edite e aprimore habilidades locais do ZCode.",
    "ZCode usage and self-diagnosis guide: teaches agents and users how to configure MCP servers, commands, skills, hooks, and plugins, and how to locate and fix configuration problems for each.": "Guia de uso e autodiagnóstico do ZCode: orienta agentes e usuários sobre como configurar servidores MCP, comandos, habilidades, hooks e plugins.",
    "Select and restore legacy ACP-era ZCode sessions into the new ZCode task and session store.": "Selecione e restaure sessões legadas da era ACP no novo armazenamento de tarefas e sessões do ZCode."
};

const SKIP_DIRS = new Set(['.git', 'node_modules', 'cache', 'caches', 'tmp', 'temp', 'logs', 'log', 'export-log', 'crash', 'artifacts']);
function walkAll(dir) {
    const results = [];
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
    for (const entry of list) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
            results.push(...walkAll(fullPath));
        } else if (entry.isFile() && (entry.name === 'SKILL.md' || entry.name === 'visual-judge.md' || entry.name.endsWith('.json'))) {
            results.push(fullPath);
        }
    }
    return results;
}

// Pesquisar somente locais que guardam skills/plugins; ignorar historicos, caches e areas de trabalho.
const targetDirs = [
    path.join(zcodeUserDir, 'skills'),
    path.join(zcodeUserDir, 'plugins'),
    path.join(zcodeUserDir, 'cli', 'plugins', 'marketplaces'),
    path.join(zcodeUserDir, 'plugin-workspace'),
    zcodeGlmDir
];
let allFiles = [];
for (const td of targetDirs) {
    if (!fs.existsSync(td)) continue;
    console.log('[*] Verificando skills/plugins em:', td);
    allFiles.push(...walkAll(td));
}
console.log(`[+] Arquivos candidatos encontrados: ${allFiles.length}`);
let count = 0;

for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
    if (fileIndex > 0 && fileIndex % 250 === 0) console.log(`[+] Processados ${fileIndex}/${allFiles.length} arquivos...`);
    const f = allFiles[fileIndex];
    // A. Traduzir SKILL.md
    if (f.endsWith('SKILL.md')) {
        try {
            let content = fs.readFileSync(f, 'utf8');
            let updated = false;

            const nameMatch = content.match(/^name:\s*([^\r\n]+)/m);
            const skillName = nameMatch ? nameMatch[1].trim() : path.basename(path.dirname(f));

            if (SKILL_TRANSLATIONS[skillName]) {
                const ptDesc = SKILL_TRANSLATIONS[skillName];
                const descMatch = content.match(/^description:\s*\"?([^\r\n\"]+)\"?/m);
                if (descMatch && descMatch[1] !== ptDesc) {
                    content = content.replace(/^description:\s*([^\r\n]+)/m, `description: "${ptDesc}"`);
                    updated = true;
                }
            }

            if (updated) {
                preserveBeforeWrite(f, versionBackupDir);
                fs.writeFileSync(f, content, 'utf8');
                count++;
                console.log(`[OK] Traduzido SKILL.md (${skillName}) em:`, f);
            }
        } catch (e) {}
    }

    // B. Traduzir visual-judge.md
    if (f.endsWith('visual-judge.md')) {
        try {
            let content = fs.readFileSync(f, 'utf8');
            const oldPrefix = 'description: "THE single visual acceptance pass';
            if (content.includes(oldPrefix)) {
                const lineEnd = content.indexOf('\n', content.indexOf(oldPrefix));
                const newDesc = 'description: "Revisor de aceitação visual exclusivo para entregáveis renderizados (pptx, docx, xlsx, pdf, pôster e gráficos). Use-o em vez de inspecionar as imagens manualmente."';
                content = content.substring(0, content.indexOf(oldPrefix)) + newDesc + content.substring(lineEnd);
                preserveBeforeWrite(f, versionBackupDir);
                fs.writeFileSync(f, content, 'utf8');
                count++;
                console.log('[OK] Traduzido visual-judge em:', f);
            }
        } catch (e) {}
    }

    // C. Traduzir manifestos de plugins e catálogos de marketplace
    if (f.endsWith('.json')) {
        try {
            let content = fs.readFileSync(f, 'utf8');
            let updated = false;

            for (const [oldEn, newPt] of Object.entries(PLUGIN_STRING_REPLACEMENTS)) {
                if (content.includes(oldEn)) {
                    content = content.replaceAll(oldEn, newPt);
                    updated = true;
                }
            }

            if (updated) {
                preserveBeforeWrite(f, versionBackupDir);
                fs.writeFileSync(f, content, 'utf8');
                count++;
                console.log('[OK] Traduzido manifesto/json em:', f);
            }
        } catch (e) {}
    }
}

console.log(`====================================================================`);
console.log(`[+] Total de arquivos de skills e plugins traduzidos: ${count}`);
console.log(`====================================================================`);
