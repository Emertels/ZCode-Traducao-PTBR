const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync, execFileSync } = require("child_process");

console.log("====================================================================");
console.log("      PATCHER DINAMICO AUTOMATIZADO ZCODE PT-BR - EMERSON TELES     ");
console.log("====================================================================");

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const zcodeDir = process.argv[2] || path.join(localAppData, "Programs", "zcode");
const scriptDir = __dirname;
const dictPath = path.join(scriptDir, "pt_dictionary.json");

if (!fs.existsSync(dictPath)) {
    console.error("[x] Erro: Dicionário pt_dictionary.json não encontrado em:", dictPath);
    process.exit(1);
}

const resourcesDir = path.join(zcodeDir, "resources");
const srcAsar = path.join(resourcesDir, "app.asar");
const backupDir = path.join(zcodeDir, "_backups");
const tempAsar = path.join(resourcesDir, "app.asar.tmp");

if (!fs.existsSync(srcAsar)) {
    console.error("[x] Erro: app.asar não encontrado em:", srcAsar);
    process.exit(1);
}

const dict = JSON.parse(fs.readFileSync(dictPath, "utf8"));
console.log("[*] Dicionário PT-BR carregado com", Object.keys(dict).length, "termos traduzidos.");

function computeIntegrity(buffer) {
    const blockSize = 4 * 1024 * 1024;
    const blocks = [];
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    for (let i = 0; i < buffer.length; i += blockSize) {
        const chunk = buffer.subarray(i, Math.min(i + blockSize, buffer.length));
        blocks.push(crypto.createHash("sha256").update(chunk).digest("hex"));
    }
    return { algorithm: "SHA256", hash, blockSize, blocks };
}

// 1. Ler cabeçalho ASAR atual
let asarFd = fs.openSync(srcAsar, "r");
const sizeBuf = Buffer.alloc(16);
fs.readSync(asarFd, sizeBuf, 0, 16, 0);
const srcSize2 = sizeBuf.readUInt32LE(4);
const srcJsonSize = sizeBuf.readUInt32LE(12);
const srcHeaderBuf = Buffer.alloc(srcJsonSize);
fs.readSync(asarFd, srcHeaderBuf, 0, srcJsonSize, 16);
let srcHeader = JSON.parse(srcHeaderBuf.toString("utf8"));
let srcBaseOffset = 8 + srcSize2;

function readFileData(fd, baseOffset, entry) {
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, baseOffset + parseInt(entry.offset, 10));
    return buf;
}

// 2. Extrair e verificar package.json da versão atual instalada
const pkgEntry = srcHeader.files && srcHeader.files["package.json"];
if (!pkgEntry) {
    console.error("[x] Erro: package.json não encontrado dentro do app.asar");
    process.exit(1);
}
let pkgStr = readFileData(asarFd, srcBaseOffset, pkgEntry).toString("utf8");
const firstBrace = pkgStr.indexOf("{");
if (firstBrace > 0) pkgStr = pkgStr.slice(firstBrace);
const pkgObj = JSON.parse(pkgStr);
const currentVersion = pkgObj.version;
fs.closeSync(asarFd);

console.log(`[*] Versão do ZCode instalada detectada: ${currentVersion}`);
console.log(`    -> Preservando estritamente a versão ${currentVersion} (sem downgrade)!`);

function isAlreadyTranslatedAsar(filePath) {
    try {
        const fd = fs.openSync(filePath, "r");
        const sBuf = Buffer.alloc(16);
        fs.readSync(fd, sBuf, 0, 16, 0);
        const s2 = sBuf.readUInt32LE(4);
        const jSize = sBuf.readUInt32LE(12);
        const hBuf = Buffer.alloc(jSize);
        fs.readSync(fd, hBuf, 0, jSize, 16);
        const h = JSON.parse(hBuf.toString("utf8"));
        const bOff = 8 + s2;
        
        // A detecção exige as duas marcas próprias do patch: módulo principal e preload.
        const mainEntry = h.files && h.files.out && h.files.out.files && h.files.out.files.main && h.files.out.files.main.files && h.files.out.files.main.files["index.js"];
        const prelEntry = h.files && h.files.out && h.files.out.files && h.files.out.files.preload && h.files.out.files.preload.files && h.files.out.files.preload.files["index.cjs"];
        let mainTranslated = false;
        let preloadTranslated = false;
        if (mainEntry) {
            const mBuf = Buffer.alloc(mainEntry.size);
            fs.readSync(fd, mBuf, 0, mainEntry.size, bOff + parseInt(mainEntry.offset, 10));
            mainTranslated = mBuf.toString("utf8").includes("Emerson Teles");
        }
        if (prelEntry) {
            const pBuf = Buffer.alloc(prelEntry.size);
            fs.readSync(fd, pBuf, 0, prelEntry.size, bOff + parseInt(prelEntry.offset, 10));
            preloadTranslated = pBuf.toString("utf8").includes("_ptDomMap");
        }
        fs.closeSync(fd);
        return mainTranslated && preloadTranslated;
    } catch (e) {
        return false;
    }
}

const isSrcTranslated = isAlreadyTranslatedAsar(srcAsar);

// Modo somente de diagnóstico usado pelo instalador antes de gravar backups
// auxiliares: 0 = ASAR original limpo, 10 = tradução completa, 11 = estado
// modificado/inconclusivo. Não cria pastas nem altera arquivos.
if (process.argv.includes("--detect-state")) {
    if (isSrcTranslated) process.exit(10);
    try {
        const verifier = path.join(scriptDir, "tools", "verify-clean-asar.cjs");
        execFileSync(process.execPath, [verifier, "zcode", srcAsar, currentVersion], { stdio: "ignore" });
        process.exit(0);
    } catch {
        process.exit(11);
    }
}

function getAsarVersion(filePath) {
    try {
        const fd = fs.openSync(filePath, "r");
        const sBuf = Buffer.alloc(16);
        fs.readSync(fd, sBuf, 0, 16, 0);
        const s2 = sBuf.readUInt32LE(4);
        const jSize = sBuf.readUInt32LE(12);
        const hBuf = Buffer.alloc(jSize);
        fs.readSync(fd, hBuf, 0, jSize, 16);
        const h = JSON.parse(hBuf.toString("utf8"));
        const bOff = 8 + s2;
        const pEnt = h.files && h.files["package.json"];
        if (!pEnt) { fs.closeSync(fd); return null; }
        const pBuf = Buffer.alloc(pEnt.size);
        fs.readSync(fd, pBuf, 0, pEnt.size, bOff + parseInt(pEnt.offset, 10));
        fs.closeSync(fd);
        const pStr = pBuf.toString("utf8").replace(/^[^{]*/, "");
        return JSON.parse(pStr).version;
    } catch (e) {
        return null;
    }
}

// Use one immutable backup per package version. Never copy a root/other-build backup.
const buildKey = currentVersion.replace(/[^a-zA-Z0-9._-]/g, "_");
const versionBackupDir = path.join(backupDir, buildKey);
const versionBackupAsar = path.join(versionBackupDir, "app.asar");
const versionBackupInfo = path.join(versionBackupDir, "backup-info.txt");
if (!fs.existsSync(versionBackupDir)) fs.mkdirSync(versionBackupDir, { recursive: true });
const infoText = `Backup original ZCode\nVersão: ${currentVersion}\nCriado: ${new Date().toLocaleString("pt-BR")}\nOrigem: ${versionBackupAsar}\n`;
if (!fs.existsSync(versionBackupAsar) && !isSrcTranslated) {
    console.log(`[*] Preservando app.asar original da versão ${currentVersion} em ${versionBackupAsar}`);
    fs.copyFileSync(srcAsar, versionBackupAsar);
    fs.writeFileSync(versionBackupInfo, infoText, "utf8");
}
let cleanAsarPath = fs.existsSync(versionBackupAsar) && getAsarVersion(versionBackupAsar) === currentVersion && !isAlreadyTranslatedAsar(versionBackupAsar)
    ? versionBackupAsar
    : (!isSrcTranslated ? srcAsar : null);
if (!cleanAsarPath || isAlreadyTranslatedAsar(cleanAsarPath) || getAsarVersion(cleanAsarPath) !== currentVersion) {
    console.error("[x] Backup original limpo desta versão ausente ou inválido; nenhum patch será aplicado.");
    console.error("    Repare/instale o ZCode oficial por cima e tente novamente. Mantenha os dados do usuário.");
    process.exit(11);
}
if (!isSrcTranslated && cleanAsarPath === versionBackupAsar) {
    console.log("[OK] Backup original em inglês desta versão encontrado e validado; ele será mantido sem substituição.");
}
if (isSrcTranslated) {
    process.exit(10);
}
console.log(`[*] Utilizando base limpa original de fábrica (em inglês) de: ${cleanAsarPath}`);
let cleanFd = fs.openSync(cleanAsarPath, "r");
const cSizeBuf = Buffer.alloc(16);
fs.readSync(cleanFd, cSizeBuf, 0, 16, 0);
const cSize2 = cSizeBuf.readUInt32LE(4);
const cJsonSize = cSizeBuf.readUInt32LE(12);
const cHeaderBuf = Buffer.alloc(cJsonSize);
fs.readSync(cleanFd, cHeaderBuf, 0, cJsonSize, 16);
const cleanHeader = JSON.parse(cHeaderBuf.toString("utf8"));
const cleanBaseOffset = 8 + cSize2;

function getCleanFile(p) {
    const parts = p.split("/");
    let cur = cleanHeader;
    for (const part of parts) {
        if (!cur.files || !cur.files[part]) return null;
        cur = cur.files[part];
    }
    const buf = Buffer.alloc(cur.size);
    fs.readSync(cleanFd, buf, 0, cur.size, cleanBaseOffset + parseInt(cur.offset, 10));
    return buf.toString("utf8");
}

// A. Patch out/main/index.js (Dialogo Sobre, Creditos e Explorador de Arquivos)
console.log("[*] Aplicando patch no modulo principal: out/main/index.js");
let mainCode = getCleanFile("out/main/index.js");
if (!mainCode) {
    console.error("[x] Erro: out/main/index.js não encontrado.");
    process.exit(1);
}

// Inserir crédito sem emoji para manter compatibilidade com a fonte/interface.
const aboutCredit = "Tradução PT-BR: Emerson Teles";
if (mainCode.includes(aboutCredit)) {
    console.log("    -> Crédito PT-BR já está presente no diálogo Sobre.");
} else if (mainCode.includes('<div>${sr(e.copyright)}</div>')) {
    mainCode = mainCode.replace(
        '<div>${sr(e.copyright)}</div>',
        `<div>\${sr(e.copyright)}</div><div style="margin-top:6px;font-size:12px;font-weight:400;color:#00adb5;letter-spacing:0.02em;text-align:left;">${aboutCredit}</div>`
    );
    mainCode = mainCode.replace('nL=312', 'nL=345');
    console.log(`    -> Crédito '${aboutCredit}' injetado abaixo dos direitos reservados no diálogo Sobre.`);
} else {
    console.warn("[!] O ponto de inserção do crédito não foi localizado no diálogo Sobre desta compilação.");
}

// Preservar o rótulo original do seletor de editores externos: uma troca
// estática por português fazia o nome permanecer traduzido no locale inglês.
// Traduzir mensagens de Sobre somente em pt-BR, preservando os catálogos originais.
const ptAboutObj = '{aboutTitle:"Sobre o ZCode",versionLabel:"versão",okButtonLabel:"OK",optimizedForAppleSilicon:"Otimizado para Apple Silicon.",copyright:s(e=>`Todos os direitos reservados \\xA9 ${e} ZCode.`,"copyright")}';
const jbNeedle = 'Jb={"zh-CN":';
const jbIdx = mainCode.indexOf(jbNeedle);
if (jbIdx !== -1) {
    const jbEnd = mainCode.indexOf(';function Be(', jbIdx);
    if (jbEnd !== -1) {
        const originalJb = mainCode.slice(jbIdx, jbEnd);
        const newJb = `${originalJb.slice(0, -1)},"pt-BR":${ptAboutObj}}`;
        mainCode = mainCode.substring(0, jbIdx) + newJb + mainCode.substring(jbEnd);
        console.log("    -> Janela Sobre traduzida em pt-BR; catálogos en-US e zh-CN preservados.");
    }
}

// Traduzir menu de contexto da bandeja do sistema (Windows Tray)
const trayLabelNeedle = 'let t=s(i=>Mt(e.getLocale(),i),"getLabel")';
if (mainCode.includes(trayLabelNeedle)) {
    const ptTrayMapCode = `const _ptTrayMap={"打开 ZCode":"Abrir ZCode","Open ZCode":"Abrir ZCode","新建任务":"Nova Tarefa","New task":"Nova Tarefa","打开工作区":"Abrir Espaço de Trabalho","Open workspace":"Abrir Espaço de Trabalho","检查更新":"Verificar Atualizações","Check for updates":"Verificar Atualizações","关于 ZCode":"Sobre o ZCode","About ZCode":"Sobre o ZCode","清除所有数据":"Limpar Todos os Dados","Clear all data":"Limpar Todos os Dados","退出":"Sair","Quit":"Sair","ZCode":"ZCode"};let locale=e.getLocale(),t=s(i=>{let val=Mt(locale,i);return locale==="pt-BR"?(_ptTrayMap[val]||val):val},"getLabel")`;
    mainCode = mainCode.replace(trayLabelNeedle, ptTrayMapCode);
    console.log("    -> Menu da bandeja do sistema (System Tray) traduzido para PT-BR.");
}

// Traduzir indicador de Computer Use apenas no locale pt-BR.
const indicatorOriginal = 'function hC(e){return e==="zh-CN"?{text:"ZCode \\u6B63\\u5728\\u64CD\\u4F5C\\u7535\\u8111",width:234}:{text:"ZCode is controlling your computer",width:308}}';
const indicatorLocalized = 'function hC(e){return e==="zh-CN"?{text:"ZCode \\u6B63\\u5728\\u64CD\\u4F5C\\u7535\\u8111",width:234}:e==="pt-BR"?{text:"ZCode está controlando seu computador",width:330}:{text:"ZCode is controlling your computer",width:308}}';
if (mainCode.includes(indicatorOriginal)) {
    mainCode = mainCode.replace(indicatorOriginal, indicatorLocalized);
    console.log("    -> Indicador de Computer Use traduzido somente em pt-BR.");
}

// A.1 Patch out/main/chunk-*.js (Modulo de Menus da Barra de Titulo, Dock e Bandeja)
const cMainNode = cleanHeader.files.out.files.main.files;
const desktopMenuChunkName = Object.keys(cMainNode).find(f => f.startsWith("chunk-") && f.endsWith(".js") && getCleanFile("out/main/" + f)?.includes('tray.menu.openZCode'));
let desktopMenuChunkCode = desktopMenuChunkName ? getCleanFile("out/main/" + desktopMenuChunkName) : null;
if (desktopMenuChunkCode) {
    console.log(`[*] Aplicando patch no modulo de menus do sistema: out/main/${desktopMenuChunkName}`);
    const ptDesktopMenu = {
        "titleBar.menu.file": "Arquivo",
        "titleBar.menu.edit": "Editar",
        "titleBar.menu.view": "Exibir",
        "titleBar.menu.window": "Janela",
        "titleBar.menu.help": "Ajuda",
        "titleBar.menu.file.newTask": "Nova Tarefa",
        "titleBar.menu.file.openWorkspace": "Abrir Espaço de Trabalho",
        "titleBar.menu.file.closeWindow": "Fechar Janela",
        "titleBar.menu.edit.undo": "Desfazer",
        "titleBar.menu.edit.redo": "Refazer",
        "titleBar.menu.edit.cut": "Recortar",
        "titleBar.menu.edit.copy": "Copiar",
        "titleBar.menu.edit.paste": "Colar",
        "titleBar.menu.edit.delete": "Excluir",
        "titleBar.menu.edit.selectAll": "Selecionar Tudo",
        "titleBar.menu.view.toggleFullScreen": "Alternar Tela Cheia",
        "titleBar.menu.view.actualSize": "Tamanho Real",
        "titleBar.menu.view.zoomIn": "Aumentar Zoom",
        "titleBar.menu.view.zoomOut": "Diminuir Zoom",
        "titleBar.menu.window.minimize": "Minimizar",
        "titleBar.menu.window.zoom": "Zoom",
        "titleBar.menu.window.bringAllToFront": "Trazer Tudo para a Frente",
        "titleBar.menu.app.services": "Serviços",
        "titleBar.menu.app.hide": "Ocultar {appName}",
        "titleBar.menu.app.hideOthers": "Ocultar Outros",
        "titleBar.menu.app.showAll": "Mostrar Tudo",
        "titleBar.menu.app.quit": "Sair do {appName}",
        "titleBar.menu.help.about": "Sobre o ZCode",
        "titleBar.menu.help.whatsNew": "Novidades",
        "titleBar.menu.help.checkForUpdates": "Verificar Atualizações",
        "titleBar.menu.help.toggleDevTools": "Alternar Ferramentas do Desenvolvedor",
        "titleBar.menu.help.resourceManager": "Gerenciador de Recursos",
        "titleBar.menu.help.toggleZCodeStdioTap": "Capturar tráfego stdio do agente",
        "titleBar.menu.help.zcodeEndpoint": "ZCode Endpoint",
        "titleBar.menu.help.zcodeEndpoint.production": "Produção (padrão)",
        "titleBar.menu.help.zcodeEndpoint.test": "Teste",
        "titleBar.menu.help.zcodeEndpoint.custom": "Personalizado...",
        "titleBar.menu.help.zcodeEndpoint.reset": "Restaurar padrão",
        "titleBar.menu.help.feedback": "Feedback",
        "titleBar.menu.help.exportLogs": "Exportar Logs",
        "titleBar.menu.help.clearAllData": "Limpar Todos os Dados",
        "desktopMenu.help.checkingForUpdates": "Verificando atualizações...",
        "desktopMenu.help.updateAvailableVersion": "Atualização disponível {version}",
        "desktopMenu.help.downloadingUpdateVersion": "Baixando atualização {version}...",
        "desktopMenu.help.downloadingUpdateProgress": "Baixando atualização... {progress}",
        "desktopMenu.help.restartToUpdate": "Reiniciar para atualizar ({version})",
        "dock.menu.showCurrentWindow": "Mostrar janela atual",
        "tray.tooltip": "ZCode",
        "tray.menu.openZCode": "Abrir ZCode",
        "tray.menu.quit": "Sair"
    };

    const startIdx = desktopMenuChunkCode.indexOf('eh={"zh-CN":');
    const endIdx = desktopMenuChunkCode.indexOf('}};function ik', startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
        const ptStr = JSON.stringify(ptDesktopMenu);
        const newEh = `${desktopMenuChunkCode.slice(startIdx, endIdx + 1)},"pt-BR":${ptStr}}`;
        desktopMenuChunkCode = desktopMenuChunkCode.substring(0, startIdx) + newEh + desktopMenuChunkCode.substring(endIdx + 2);
        console.log("    -> Menus do sistema traduzidos somente em pt-BR; en-US e zh-CN preservados.");
    }

    desktopMenuChunkCode = desktopMenuChunkCode.replace(
        'function ik(t,n){return(eh[t]??eh[fs])[n]}',
        'function ik(t,n){return(eh[t]??eh[fs]??eh["en-US"])[n]}'
    );
}


// B. Patch out/renderer/assets/styles-*.js (Seletores de Idioma em Geral e Barra Lateral + h0 Templates)
const cAssetsNode = cleanHeader.files.out.files.renderer.files.assets.files;
const stylesFileName = Object.keys(cAssetsNode).find(f => f.startsWith("styles-") && f.endsWith(".js"));
if (!stylesFileName) {
    console.error("[x] Erro: arquivo styles-*.js não encontrado.");
    process.exit(1);
}
console.log(`[*] Aplicando patch no modulo de estilos e configuracoes: out/renderer/assets/${stylesFileName}`);
let stylesCode = getCleanFile("out/renderer/assets/" + stylesFileName);

// 1. Adicionar opcao pt-BR no dropdown de Configuracoes Gerais
const gOptTarget = '(0,$.jsx)(kk,{value:`en-US`,"data-testid":Pa(ii,`en-US`),children:me.formatMessage({id:`settings.locale.en-US`})})';
const gOptReplacement = gOptTarget + ',(0,$.jsx)(kk,{value:`pt-BR`,"data-testid":Pa(ii,`pt-BR`),children:me.formatMessage({id:`settings.locale.pt-BR`})})';
if (stylesCode.includes(gOptTarget) && !stylesCode.includes('`settings.locale.pt-BR`')) {
    stylesCode = stylesCode.replace(gOptTarget, gOptReplacement);
    console.log("    -> Adicionada opcao 'Português (Brasil)' nas Configuracoes Gerais.");
}

// 2. Adicionar opcao pt-BR no dropdown da Barra Lateral
const sOptTarget = '(0,$.jsx)(DA,{value:`zh-CN`,children:v.formatMessage({id:`sidebar.settings.locale.zh-CN`})})';
const sOptReplacement = sOptTarget + ',(0,$.jsx)(DA,{value:`pt-BR`,children:v.formatMessage({id:`sidebar.settings.locale.pt-BR`})})';
if (stylesCode.includes(sOptTarget) && !stylesCode.includes('`sidebar.settings.locale.pt-BR`')) {
    stylesCode = stylesCode.replace(sOptTarget, sOptReplacement);
    console.log("    -> Adicionada opcao 'Português (Brasil)' na Barra Lateral.");
}

// 3. Permitir selecao de pt-BR nos manipuladores de evento
stylesCode = stylesCode.replace(
    '(e===`zh-CN`||e===`en-US`)&&qR({input:{featureId:`settings.locale`',
    '(e===`zh-CN`||e===`en-US`||e===`pt-BR`)&&qR({input:{featureId:`settings.locale`'
);
stylesCode = stylesCode.replace(
    '(e===`zh-CN`||e===`en-US`)&&G(e)',
    '(e===`zh-CN`||e===`en-US`||e===`pt-BR`)&&G(e)'
);

// 4. Permitir pt-BR nos getters de localStorage
stylesCode = stylesCode.replace(
    'if(e===`zh-CN`||e===`en-US`)return e',
    'if(e===`zh-CN`||e===`en-US`||e===`pt-BR`)return e'
);
stylesCode = stylesCode.replace(
    'return e===`zh-CN`||e===`en-US`||e===`system`?e:null',
    'return e===`zh-CN`||e===`en-US`||e===`system`||e===`pt-BR`?e:null'
);

// 4.1 Permitir erro Turn execution failed em PT-BR
if (stylesCode.includes('var O$e=new Set([`Internal error`,`Turn execution failed`')) {
    stylesCode = stylesCode.replace(
        'var O$e=new Set([`Internal error`,`Turn execution failed`,`Compact failed`,`Rewind failed`,`ZCode session failed`]);',
        'var O$e=new Set([`Internal error`,`Erro interno`,`Turn execution failed`,`Falha na execução do turno`,`Compact failed`,`Falha na compactação`,`Rewind failed`,`Falha no retrocesso`,`ZCode session failed`,`Falha na sessão do ZCode`]);'
    );
    console.log("    -> Set de erros de execução traduzido para PT-BR em styles.");
}

// 5. Atualizar funcao h0 para traduzir templates dinâmicos de automação e tarefas
const h0Start = stylesCode.indexOf("function h0(e,t){");
const y0Start = stylesCode.indexOf("function Y0t(e,t,n,r){", h0Start);
if (h0Start !== -1 && y0Start !== -1) {
    const h0Replacement = `function h0(e,t){
        if (!e) return "";
        let str = "";
        if (typeof e === "string") {
            str = e;
        } else if (typeof e === "object") {
            let isZh = t?.startsWith("zh") ?? false;
            str = (isZh ? e.cn : e.en) || (isZh ? e.en : e.cn) || "";
        }
        str = (str || "").trim();
        const isPt = t?.toLowerCase().startsWith("pt") ?? false;
        if (!isPt) return str || (typeof e === "string" ? e : (e.en || e.cn || ""));
        const map = {
            "Morning dev brief": "Resumo matinal de desenvolvimento",
            "Risk scan": "Varredura de riscos",
            "Release brief": "Resumo de lançamento",
            "Documentation sync check": "Verificação de sincronização de documentação",
            "Weekly Summary": "Resumo Semanal",
            "Error Fix": "Correção de Erros",
            "PPT Creation": "Criação de Apresentação PPT",
            "Idle-time task": "Tarefa em Tempo Ocioso",
            "Summarize the events of the week every Friday.": "Resuma os acontecimentos da semana toda sexta-feira.",
            "Summarize the events of the week every Friday": "Resuma os acontecimentos da semana toda sexta-feira.",
            "Please analyze the following terminal error log, find the root cause of the error, and provide a sample of fix code that can be run directly.": "Analise o seguinte log de erro do terminal, localize a causa raiz do erro e forneça um exemplo de código de correção que possa ser executado diretamente.",
            "Please analyze the following terminal error log, find the root cause of the error, and provide a sample of fix code that can be run directly": "Analise o seguinte log de erro do terminal, localize a causa raiz do erro e forneça um exemplo de código de correção que possa ser executado diretamente.",
            "Summarize commits, module changes, CI status, and follow-ups since the previous workday, then produce a concise morning report.": "Resuma commits, mudanças de módulos, status de CI e acompanhamentos desde o último dia útil e gere um relatório matinal conciso.",
            "Inspect code changes from the last 24 hours for high-confidence risks involving runtime failures, data loss, or missing dependencies.": "Inspecione mudanças de código das últimas 24 horas em busca de riscos de alta confiança envolvendo falhas em tempo de execução, perda de dados ou dependências ausentes.",
            "Organize PRs and commits merged this week into Features, Fixes, Experience improvements, and Remaining risks, linking to merge evidence.": "Organize PRs e commits mesclados esta semana em Recursos, Correções, Melhorias de experiência e Riscos restantes, com links de comprovação.",
            "Compare code, configuration, API, and documentation changes from the last seven days to identify missing or outdated docs.": "Compare alterações de código, configuração, API e documentação dos últimos sete dias para identificar documentos ausentes ou desatualizados."
        };
        if (map[str]) return map[str];
        if (str.startsWith("Summarize commits, module changes, CI status")) {
            if (str.includes("stand-up-ready bullets")) {
                return "Resuma os commits, alterações de módulos, status de CI e acompanhamentos desde o último dia útil e gere no máximo cinco tópicos prontos para a reunião de alinhamento (stand-up). Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.";
            }
            return "Resuma commits, mudanças de módulos, status de CI e acompanhamentos desde o último dia útil e gere um relatório matinal conciso.";
        }
        if (str.startsWith("Inspect code changes from the last 24 hours")) {
            if (str.includes("authorization bypasses")) {
                return "Inspecione as alterações de código das últimas 24 horas em busca de riscos de alta confiança envolvendo falhas em tempo de execução, perda de dados, desvios de autorização, vazamentos de recursos ou compatibilidade entre plataformas, anexando o código e evidências de commit/diff. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.";
            }
            return "Inspecione mudanças de código das últimas 24 horas em busca de riscos de alta confiança envolvendo falhas em tempo de execução, perda de dados ou dependências ausentes.";
        }
        if (str.startsWith("Organize PRs and commits merged this week")) {
            if (str.includes("Engineering improvements")) {
                return "Organize os PRs e commits mesclados esta semana em Recursos, Correções, Melhorias de experiência e Melhorias de engenharia, gerando em seguida um resumo para a equipe e notas de lançamento concisas voltadas aos usuários. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.";
            }
            return "Organize PRs e commits mesclados esta semana em Recursos, Correções, Melhorias de experiência e Riscos restantes, com links de comprovação.";
        }
        if (str.startsWith("Compare code, configuration, API, and documentation changes")) {
            if (str.includes("Identify high-confidence cases")) {
                return "Compare as alterações de código, configuração, API e documentação dos últimos sete dias. Identifique casos de alta confiança em que o comportamento público mudou sem a documentação correspondente, anexe caminhos de arquivos e evidências de commit/diff, e indique os locais da documentação e pontos-chave que devem ser atualizados. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.";
            }
            return "Compare alterações de código, configuração, API e documentação dos últimos sete dias para identificar documentos ausentes ou desatualizados.";
        }
        if (str.startsWith("Please create a PowerPoint presentation for me on the topic")) {
            return "Crie uma apresentação do PowerPoint para mim sobre o tema \\"A Evolução dos Agentes de IA\\", cobrindo três estágios: Engenharia de Prompts (origens, técnicas essenciais, limitações) → Engenharia de Contexto (por que o contexto é importante, tecnologias-chave como RAG/Memória/Uso de Ferramentas) → Engenharia de Harness (evolução dos frameworks de agentes, produtos representativos como AutoGPT/ACPAgent/OpenClaw). O estilo deve ser tecnológico, com fundo escuro e uma linha do tempo claramente apresentada.";
        }
        for (const [k, v] of Object.entries(map)) {
            if (str.startsWith(k) || str.includes(k) || k.includes(str)) return v;
        }
        return str || (typeof e === "string" ? e : (e.en || e.cn || ""));
    }`;
    stylesCode = stylesCode.substring(0, h0Start) + h0Replacement + stylesCode.substring(y0Start);
    console.log("    -> Injetado mapeamento universal em PT-BR para templates de automações e tarefas em styles.");
}

// B.1 Manter textos originais do host; a tradução condicional é aplicada no DOM em pt-BR.
console.log("[*] Mantidos os textos originais do host; descrições e erros são traduzidos condicionalmente no DOM.");
let hostCode = getCleanFile("out/host/index.js");
// A API de campanhas aceita somente en-US e zh-CN. Mantemos pt-BR na interface,
// mas consultamos a API de bônus com en-US e aceitamos pt-BR no relatório de resgate.
const marketingLocaleEnum = 'var AN=_.enum(["zh-CN","en-US"])';
const marketingLocaleHeader = '"X-Client-Language":AN.parse(o)';
if (hostCode && hostCode.includes(marketingLocaleEnum) && hostCode.includes(marketingLocaleHeader)) {
    hostCode = hostCode.replace(marketingLocaleEnum, 'var AN=_.enum(["zh-CN","en-US","pt-BR"])');
    hostCode = hostCode.replace(marketingLocaleHeader, '"X-Client-Language":AN.parse(o==="pt-BR"?"en-US":o)');
    console.log("    -> Bônus: consultas e resgates pt-BR usam en-US somente no cabeçalho da API de campanhas.");
} else {
    console.warn("[!] API de campanhas mudou; o fallback de locale do bônus não foi aplicado.");
}

// B.2 Manter 'New Group' no host; o DOM o traduz para 'Novo grupo' somente em pt-BR.
const cHostNode = cleanHeader.files.out.files.host.files;
const hostGroupChunkName = Object.keys(cHostNode).find(f => f.startsWith("chunk-") && f.endsWith(".js") && getCleanFile("out/host/" + f)?.includes('"New Group"'));
let chunkHostCode = hostGroupChunkName ? getCleanFile("out/host/" + hostGroupChunkName) : null;
if (chunkHostCode) {
    console.log(`    -> Nome original 'New Group' preservado em out/host/${hostGroupChunkName}; tradução condicional no DOM.`);
}

// C. Patch out/renderer/assets/IntlProvider-*.js
const intlFileName = Object.keys(cAssetsNode).find(f => f.startsWith("IntlProvider") && f.endsWith(".js"));
if (!intlFileName) {
    console.error("[x] Erro: arquivo IntlProvider-*.js não encontrado.");
    process.exit(1);
}
console.log(`[*] Aplicando patch no provedor de internacionalizacao: out/renderer/assets/${intlFileName}`);
let intlCode = getCleanFile("out/renderer/assets/" + intlFileName);

// Fazer "Padrão do sistema" reconhecer Português quando o sistema operacional usa pt-*.
const systemLocaleResolver = 'm=(0,i.useCallback)(()=>{let e=f();return e?e.toLowerCase().startsWith(`zh`)?`zh-CN`:`en-US`:t},[])';
const localizedSystemLocaleResolver = 'm=(0,i.useCallback)(()=>{let e=f();if(!e)return t;e=e.toLowerCase();return e.startsWith(`zh`)?`zh-CN`:e.startsWith(`pt`)?`pt-BR`:`en-US`},[])';
if (intlCode.includes(systemLocaleResolver)) {
    intlCode = intlCode.replace(systemLocaleResolver, localizedSystemLocaleResolver);
    console.log("    -> 'Padrão do sistema' agora resolve os idiomas pt-* para pt-BR.");
} else {
    console.warn("[!] O resolvedor de idioma do sistema mudou; não foi possível habilitar automaticamente o locale pt-BR.");
}
const systemLocaleService = 'g=(0,i.useCallback)(async()=>{let e=await s?.();return y(e)?e:m()},[s,m])';
const localizedSystemLocaleService = 'g=(0,i.useCallback)(async()=>{let e=f();if(e?.toLowerCase().startsWith(`pt`))return`pt-BR`;let n=await s?.();return y(n)?n:m()},[s,m])';
if (intlCode.includes(systemLocaleService)) {
    intlCode = intlCode.replace(systemLocaleService, localizedSystemLocaleService);
    console.log("    -> Prioridade do idioma pt-* do sistema sobre fallback en-US do serviço do ZCode.");
} else {
    console.warn("[!] O serviço de idioma do sistema mudou; confirme a resolução de pt-BR após atualizar o ZCode.");
}

const matchCleanG = intlCode.match(/g=\{"zh-CN":(\w+),"en-US":(\w+)\}/);
if (matchCleanG) {
    const fullG = matchCleanG[0];
    const zhVar = matchCleanG[1];
    const enVar = matchCleanG[2];
    const dictJson = JSON.stringify(dict);
    
    // Manter inglês e chinês originais; aplicar o dicionário próprio apenas ao pt-BR.
    const injection = `pt=Object.assign({},${enVar},${dictJson}),g={"zh-CN":Object.assign({},${zhVar},{"settings.locale.pt-BR":"葡萄牙语（巴西）","sidebar.settings.locale.pt-BR":"葡萄牙语（巴西）","updateDialog.availableTitle":"Nova versão v{version}","updateDialog.downloadingTitle":"Baixando v{version}","updateDialog.readyTitle":"v{version} está pronto","updateDialog.downloadAndUpdate":"Baixar atualização","updateDialog.cancelDownload":"Cancelar download","updateDialog.autoDownloadAndInstall":"Baixar e instalar atualizações automaticamente na próxima vez","updateDialog.downloadProgress":"Progresso do download","updateDialog.restartToUpdate":"Reiniciar para atualizar","updateDialog.skipVersion":"Pular esta versão","updateDialog.later":"Mais tarde","feedback.submit.simple.screenshotPrivacyHint":"Verifique se as imagens contêm informações confidenciais antes de enviar."}),"en-US":Object.assign({},${enVar},{"settings.locale.pt-BR":"Portuguese (Brazil)","sidebar.settings.locale.pt-BR":"Portuguese (Brazil)"}),"pt-BR":pt}`;
    intlCode = intlCode.replace(fullG, injection);

    // Permitir pt-BR no validador de localizacao
    intlCode = intlCode.replace(
        `function y(e){return e===\`zh-CN\`||e===\`en-US\`}`,
        `function y(e){return e===\`zh-CN\`||e===\`en-US\`||e===\`pt-BR\`}`
    );
    console.log("    -> Injetado dicionário PT-BR completo e funcional.");
} else {
    console.error("[x] Não foi possivel identificar o ponto de injecao no IntlProvider.");
    process.exit(1);
}

// D. Preservar a localidade selecionada nos formatadores de data nativos.
const usageFileName = Object.keys(cAssetsNode).find(f => f.startsWith("usageStatsUiParts-") && f.endsWith(".js"));
let usageCode = usageFileName ? getCleanFile("out/renderer/assets/" + usageFileName) : null;
if (usageCode) {
    console.log(`[*] Mantido formatador nativo de datas em out/renderer/assets/${usageFileName}; ele segue o locale ativo.`);
}

// A ponte local da página de recompensas aceita somente en-US/zh-CN.
// pt-BR é convertido para en-US nessa integração remota (a tradução visual
// continua sendo feita pelo preload), para evitar rejeição do contexto.
const rewardsBridgeFileName = Object.keys(cAssetsNode).find(f => f.startsWith("src-") && f.endsWith(".js") && getCleanFile("out/renderer/assets/" + f)?.includes('var XN=`persist:zcode-rewards`'));
let rewardsBridgeCode = rewardsBridgeFileName ? getCleanFile("out/renderer/assets/" + rewardsBridgeFileName) : null;
if (rewardsBridgeCode) {
    const rewardsContextSchema = 'var XN=`persist:zcode-rewards`,ZN=O({theme:M([`zai-light`,`zai-dark`]),locale:M([`zh-CN`,`en-US`]),auth:';
    const rewardsContextSchemaPt = 'var XN=`persist:zcode-rewards`,ZN=O({theme:M([`zai-light`,`zai-dark`]),locale:M([`zh-CN`,`en-US`,`pt-BR`]),auth:';
    if (rewardsBridgeCode.includes(rewardsContextSchema)) {
        rewardsBridgeCode = rewardsBridgeCode.replace(rewardsContextSchema, rewardsContextSchemaPt);
    }
    const rewardsContextSerializer = 'function tP(e,t,n){let r=ZN.parse(e),i=';
    const rewardsContextSerializerPt = 'function tP(e,t,n){let r=ZN.parse(e);if(r.locale===`pt-BR`)r={...r,locale:`en-US`};let i=';
    if (rewardsBridgeCode.includes(rewardsContextSerializer)) {
        rewardsBridgeCode = rewardsBridgeCode.replace(rewardsContextSerializer, rewardsContextSerializerPt);
        console.log(`    -> Ponte de recompensas: contexto pt-BR normalizado para en-US no conteúdo remoto.`);
    } else if (!rewardsBridgeCode.includes(rewardsContextSerializerPt)) {
        console.warn("[!] A função serializadora do contexto da página de recompensas mudou; locale remoto não foi ajustado.");
    }
} else {
    console.warn("[!] Bundle da ponte de recompensas não localizado; o locale do conteúdo remoto não foi ajustado.");
}

// E. Patch out/preload/index.cjs (Tradução DOM dinâmica de botões de atalho e títulos)
console.log("[*] Aplicando patch no preload principal: out/preload/index.cjs");
let preloadCode = getCleanFile("out/preload/index.cjs");
if (preloadCode) {
    const domStart = preloadCode.indexOf("try {\n        const _ptDomMap = {");
    if (domStart !== -1) {
        preloadCode = preloadCode.substring(0, domStart);
    }
    const domTranslator = `
    try {
        function _isPtBrActive() {
            try {
                const preference = window.localStorage?.getItem("zcode-locale-preference");
                if (typeof preference === "string" && preference.trim()) {
                    const normalized = preference.trim().toLowerCase();
                    if (normalized.startsWith("pt")) return true;
                    if (!["system", "default", "auto", "system-default"].includes(normalized)) return false;
                }
            } catch (e) {}
            const systemLanguage = typeof navigator !== "undefined" ? navigator.language : "";
            return typeof systemLanguage === "string" && systemLanguage.toLowerCase().startsWith("pt");
        }
        const _ptDomMap = {
            "Automations": "Automações",
            "Automation": "Automação",
            "Workflows": "Fluxos de trabalho",
            "Workflow": "Fluxo de trabalho",
            "Scheduled task template": "Modelo de tarefa agendada",
            "Every weekday at 09:00": "Todos os dias úteis às 09:00",
            "Daily at 10:00": "Diariamente às 10:00",
            "Weekly on Fri at 16:00": "Semanalmente às sextas-feiras às 16:00",
            "Weekly on Wed at 15:00": "Semanalmente às quartas-feiras às 15:00",
            "No available Plano Start": "Nenhum Plano Inicial disponível",
            "No available Start Plan": "Nenhum Plano Inicial disponível",
            "No available plan": "Nenhum plano disponível",
            "Log in to view and use your Start Plan": "Faça login para visualizar e usar seu Plano Inicial",
            "Start Plan expired": "Plano Inicial expirado",
            "Your login has expired. Please log in again.": "Sua sessão expirou. Por favor, faça login novamente.",
            "Weekly Summary": "Resumo Semanal",
            "Error Fix": "Correção de Erros",
            "PPT Creation": "Criação de Apresentação PPT",
            "Idle-time task": "Tarefa em Tempo Ocioso",
            "Morning dev brief": "Resumo matinal de desenvolvimento",
            "Risk scan": "Varredura de riscos",
            "Release brief": "Resumo de lançamento",
            "Documentation sync check": "Verificação de sincronização de documentação",
            "Summarize the events of the week every Friday.": "Resuma os acontecimentos da semana toda sexta-feira.",
            "Summarize the events of the week every Friday": "Resuma os acontecimentos da semana toda sexta-feira.",
            "Please analyze the following terminal error log, find the root cause of the error, and provide a sample of fix code that can be run directly.": "Analise o seguinte log de erro do terminal, localize a causa raiz do erro e forneça um exemplo de código de correção que possa ser executado diretamente.",
            "Please analyze the following terminal error log, find the root cause of the error, and provide a sample of fix code that can be run directly": "Analise o seguinte log de erro do terminal, localize a causa raiz do erro e forneça um exemplo de código de correção que possa ser executado diretamente.",
            "Summarize commits, module changes, CI status, and follow-ups since the previous workday, then produce a concise morning report.": "Resuma commits, mudanças de módulos, status de CI e acompanhamentos desde o último dia útil e gere um relatório matinal conciso.",
            "Summarize commits, module changes, CI status, and follow-ups since the previous workday, then produce no more than five stand-up-ready bullets. Perform read-only analysis using only verifiable repository facts; state when evidence is insufficient, do not speculate, and do not modify code or external state.": "Resuma os commits, alterações de módulos, status de CI e acompanhamentos desde o último dia útil e gere no máximo cinco tópicos prontos para a reunião de alinhamento (stand-up). Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.",
            "Inspect code changes from the last 24 hours for high-confidence risks involving runtime failures, data loss, or missing dependencies.": "Inspecione mudanças de código das últimas 24 horas em busca de riscos de alta confiança envolvendo falhas em tempo de execução, perda de dados ou dependências ausentes.",
            "Inspect code changes from the last 24 hours for high-confidence risks involving runtime failures, data loss, authorization bypasses, resource leaks, or cross-platform compatibility, and attach code and commit/diff evidence. Perform read-only analysis using only verifiable repository facts; state when evidence is insufficient, do not speculate, and do not modify code or external state.": "Inspecione as alterações de código das últimas 24 horas em busca de riscos de alta confiança envolvendo falhas em tempo de execução, perda de dados, desvios de autorização, vazamentos de recursos ou compatibilidade entre plataformas, anexando o código e evidências de commit/diff. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.",
            "Organize PRs and commits merged this week into Features, Fixes, Experience improvements, and Remaining risks, linking to merge evidence.": "Organize PRs e commits mesclados esta semana em Recursos, Correções, Melhorias de experiência e Riscos restantes, com links de comprovação.",
            "Organize PRs and commits merged this week into Features, Fixes, Experience improvements, and Engineering improvements, then produce both a team brief and concise user-facing release notes. Perform read-only analysis using only verifiable repository facts; state when evidence is insufficient, do not speculate, and do not modify code or external state.": "Organize os PRs e commits mesclados esta semana em Recursos, Correções, Melhorias de experiência e Melhorias de engenharia, gerando em seguida um resumo para a equipe e notas de lançamento concisas voltadas aos usuários. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.",
            "Compare code, configuration, API, and documentation changes from the last seven days to identify missing or outdated docs.": "Compare alterações de código, configuração, API e documentação dos últimos sete dias para identificar documentos ausentes ou desatualizados.",
            "Compare code, configuration, API, and documentation changes from the last seven days. Identify high-confidence cases where public behavior changed without matching documentation, attach file paths and commit/diff evidence, and name the documentation locations and key points that should be updated. Perform read-only analysis using only verifiable repository facts; state when evidence is insufficient, do not speculate, and do not modify code or external state.": "Compare as alterações de código, configuração, API e documentação dos últimos sete dias. Identifique casos de alta confiança em que o comportamento público mudou sem a documentação correspondente, anexe caminhos de arquivos e evidências de commit/diff, e indique os locais da documentação e pontos-chave que devem ser atualizados. Realize uma análise somente leitura utilizando exclusivamente fatos verificáveis do repositório; informe quando as evidências forem insuficientes, não especule e não modifique código ou estado externo.",
            "Provider rejected the model request.": "O provedor rejeitou a solicitação do modelo.",
            "Keyboard Shortcuts": "Atalhos do Teclado",
            "Search shortcuts": "Pesquisar atalhos",
            "Reset all to defaults": "Restaurar padrões",
            "Command": "Comando",
            "Keybinding": "Atalho",
            "Actions": "Ações",
            "Scope": "Escopo",
            "Open Command Center": "Abrir Centro de Comando",
            "Open Configurações": "Abrir Configurações",
            "Find in Tarefa": "Localizar na Tarefa",
            "Toggle Sidebar": "Alternar Barra Lateral",
            "Toggle Light/Dark Theme": "Alternar Tema Claro/Escuro",
            "Toggle Terminal": "Alternar Terminal",
            "Toggle Side Pane": "Alternar Painel Lateral",
            "Previous Tarefa": "Tarefa Anterior",
            "Next Tarefa": "Próxima Tarefa",
            "Navigate Back": "Voltar Navegação",
            "Navigate Forward": "Avançar Navegação",
            "Open Model Menu": "Abrir Menu de Modelos",
            "Cycle Session Mode": "Alternar Modo de Sessão",
            "Cycle Thought Level": "Alternar Nível de Raciocínio",
            "New Tarefa": "Nova Tarefa",
            "Open Espaço de trabalho": "Abrir Espaço de Trabalho",
            "Close Current Context": "Fechar Contexto Atual",
            "Zoom In": "Aumentar Zoom",
            "Zoom Out": "Diminuir Zoom",
            "Reset Zoom": "Redefinir Zoom",
            "Send Message": "Enviar Mensagem",
            "Insert Newline in Composer": "Inserir Nova Linha no Composer",
            "Visual verification using local model for screenshots.": "Verificação visual utilizando modelo local para capturas de tela.",
            "Document editor for docx files.": "Editor de documentos para arquivos docx (Word).",
            "PDF file reading and analysis.": "Leitura e análise de arquivos PDF.",
            "PowerPoint presentation editor and viewer.": "Editor e visualizador de apresentações do PowerPoint.",
            "Excel spreadsheet viewer and editor.": "Visualizador e editor de planilhas do Excel.",
            "CloudBase development skills suite.": "Conjunto de habilidades de desenvolvimento CloudBase.",
            "Shared node_repl runtime host for ZCode official capabilities. Not user-facing: it carries no skill and appears in no marketplace listing; Browser Use and Computer Use enable it and contribute their own skills, docs and runtime assets.": "Host de execução compartilhado node_repl para recursos oficiais do ZCode. Habilitado automaticamente pelo Browser Use e Computer Use.",
            "Provides Android development workflows and emulator automation for ZCode.": "Fornece fluxos de desenvolvimento Android e automação de emuladores para o ZCode.",
            "Built-in browser automation runtime and guidance for Desktop IAB and explicitly enabled CLI-managed headless CDP: open, navigate, inspect, click, type, screenshot, record workspace WebM videos, and verify web pages and local dev targets.": "Ambiente integrado de automação de navegador para navegar, inspecionar, clicar, digitar, tirar capturas de tela e verificar páginas da web e alvos locais.",
            "Provides iOS development workflows and simulator automation for ZCode.": "Fornece fluxos de desenvolvimento iOS e automação de simuladores para o ZCode.",
            "Select and restore legacy ACP-era ZCode sessions into the new ZCode task and session store.": "Selecione e restaure sessões legadas do ZCode da era ACP para o novo repositório de tarefas e sessões.",
            "Develop and validate ZCode plugins through a local dev marketplace, installation, trials and updates.": "Desenvolva e valide plugins do ZCode através de um marketplace de desenvolvimento local, com testes e atualizações.",
            "Create, edit, and iterate local ZCode skills.": "Crie, edite e itere sobre habilidades locais do ZCode.",
            "ZCode usage and self-diagnosis guide: teaches agents and users how to configure MCP servers, commands, skills, hooks, and plugins, and how to locate and fix configuration problems for each.": "Guia de uso e autodiagnóstico do ZCode: ensina a configurar servidores MCP, comandos, habilidades, hooks e plugins.",
            "Computer Use: automate desktop apps with mouse, keyboard, and UI element control.": "Computer Use: automatize aplicativos de desktop com controle de mouse, teclado e elementos de interface.",
            "New Group": "Novo grupo",
            "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.": "Agente de uso geral para pesquisar questões complexas, buscar código e executar tarefas de várias etapas.",
            "Read-only search agent for broad fan-out searches.": "Agente de pesquisa somente leitura para buscas abrangentes e distribuídas.",
            "Personal plans": "Planos individuais",
            "Team plans": "Planos para equipes",
            "Monthly": "Mensal",
            "Quarterly": "Trimestral",
            "Yearly": "Anual",
            "Start Plan": "Plano Inicial",
            "Subscribe": "Assinar",
            "BETTER WHEN SHARED": "MELHOR QUANDO COMPARTILHADO",
            "Invite new users, earn more together.": "Convide novos usuários e ganhem juntos.",
            "Invited Users": "Usuários convidados",
            "Total Earned": "Total ganho",
            "Rules": "Regras",
            "Copy Link": "Copiar link",
            "确定": "OK",
            "取消": "Cancelar",
            "资源管理器": "Explorador de Arquivos",
            "发现新版本": "Nova versão",
            "正在下载": "Baixando",
            "已准备就绪": "está pronto",
            "下载进度": "Progresso do download",
            "重启以更新": "Reiniciar para atualizar",
            "跳过此版本": "Pular esta versão",
            "稍后": "Mais tarde",
            "下载更新": "Baixar atualização",
            "取消下载": "Cancelar download",
            "Cancelar下载": "Cancelar download",
            "以后自动下载并安装更新": "Baixar e instalar atualizações automaticamente na próxima vez",
            "Please check images for private information before uploading.": "Verifique se as imagens contêm informações confidenciais antes de enviar.",
            "THE single visual acceptance pass for a rendered deliverable of these types only — pptx, docx, xlsx, pdf, poster, chart; for anything else, do not use it. Use it *instead of* looking at the page images yourself, never in addition: pick one gate — spawn visual-judge": "Revisor de aceitação visual exclusivo para entregáveis renderizados (pptx, docx, xlsx, pdf, pôster e gráficos). Use-o em vez de inspecionar as imagens manualmente.",
            "THE single visual acceptance pass for a rendered deliverable of these types only — pptx, docx, xlsx, pdf, poster, chart; for anything else, do not use it.": "Revisor de aceitação visual exclusivo para entregáveis renderizados (pptx, docx, xlsx, pdf, pôster e gráficos).",
            "CloudBase development skills and MCP integration for building, deploying, and troubleshooting Web, WeChat Mini Program, database, cloud function, CloudRun, storage, and AI projects.": "Habilidades de desenvolvimento CloudBase e integração MCP para criar, implantar e solucionar problemas em Web, WeChat Mini Program, banco de dados, funções na nuvem, CloudRun, armazenamento e projetos de IA.",
            "CloudBase development skills and MCP integration for building, deploying, and troubleshooting Web, WeChat Mini Program,": "Habilidades de desenvolvimento CloudBase e integração MCP para criar, implantar e solucionar problemas em Web, WeChat Mini Program,",
            "Use this skill for Node.js backend AI via @cloudbase/node-sdk (>=3.16.0) — cloud functions, CloudRun, Express, Koa, NestJS, serverless APIs, scheduled jobs, LLM proxies.": "Use esta habilidade para IA de backend em Node.js via @cloudbase/node-sdk (>=3.16.0) — funções na nuvem, CloudRun, Express, Koa, NestJS, APIs sem servidor, tarefas agendadas e proxies LLM.",
            "Use this skill when a browser/Web app (React, Vue, Angular, Next, Nuxt, static sites, SPAs, dashboards, AI chat UI) needs AI models via @cloudbase/js-sdk.": "Use esta habilidade quando um aplicativo Web (React, Vue, Angular, Next, Nuxt, sites estáticos, SPAs, dashboards, UI de chat de IA) precisar de modelos de IA.",
            "Use this skill for WeChat Mini Program AI via wx.cloud.extend.AI (miniprograms, enterprise miniprograms, wx.cloud apps). Features generateText and streamText.": "Use esta habilidade para IA em Mini Program do WeChat via wx.cloud.extend.AI (miniprogramas, miniprogramas corporativos, apps wx.cloud).",
            "CloudBase Node SDK auth guide for server-side identity, user lookup, and custom login tickets. This skill should be used when Node.js backend identity handling is required.": "Guia de autenticação do CloudBase Node SDK para identidade no servidor, consulta de usuários e tickets de login personalizados.",
            "CloudBase auth provider configuration and login-readiness guide. This skill should be used when users need to inspect, enable, disable, or configure auth providers.": "Guia de configuração e prontidão de login para provedores de autenticação do CloudBase.",
            "CloudBase Web Authentication Quick Guide for frontend integration after auth-tool has already been checked. Provides concise and practical integration steps.": "Guia rápido de autenticação Web do CloudBase para integração de front-end após verificação do auth-tool.",
            "CloudBase WeChat Mini Program native authentication guide. This skill should be used when users need mini program identity handling, silent login, and session state.": "Guia de autenticação nativa do CloudBase para WeChat Mini Program. Use para gerenciamento de identidade e login no miniprograma.",
            "CloudBase function runtime guide for building, deploying, and debugging your own Event Functions or HTTP Functions. This skill should be used for serverless functions.": "Guia de execução de funções do CloudBase para criar, implantar e depurar suas próprias Funções de Evento ou Funções HTTP.",
            "Complete guide for CloudBase cloud storage using Web SDK (@cloudbase/js-sdk) - upload, download, temporary URLs, file management, and permissions.": "Guia completo de armazenamento em nuvem do CloudBase usando o Web SDK (@cloudbase/js-sdk): upload, download, URLs temporárias e permissões.",
            "Build and deploy AI agents with CloudBase Agent SDK (TypeScript & Python). Implements the AG-UI protocol for streaming agent-UI communication.": "Crie e implante agentes de IA com o CloudBase Agent SDK (TypeScript e Python). Implementa o protocolo AG-UI para streaming entre agente e interface.",
            "CloudBase CLI (tcb, Tencent CloudBase CLI) resource management skill. This skill should be used when users need to deploy, manage, and automate cloud resources.": "Habilidade de gerenciamento de recursos com o CloudBase CLI (tcb, Tencent CloudBase CLI). Use para gerenciar recursos da nuvem.",
            "Code review and validation for CloudBase projects. After writing code for Web / miniprogram / CloudRun / cloud-function projects, call this skill to inspect and validate.": "Revisão e validação de código para projetos do CloudBase. Use após codificar para Web, miniprogramas, CloudRun ou funções em nuvem.",
            "Use CloudBase document database WeChat MiniProgram SDK to query, create, update, and delete data. Supports complex queries, pagination, and data transactions.": "Use o SDK de banco de dados NoSQL do CloudBase para WeChat Mini Program para consultar, criar, atualizar e excluir dados.",
            "Use CloudBase document database Web SDK only for confirmed NoSQL collection work. Query, create, update, and delete document data.": "Use o Web SDK do banco de dados NoSQL do CloudBase para trabalhar com coleções NoSQL: consultar, criar, atualizar e excluir dados de documentos.",
            "CloudBase platform overview and routing guide. This skill should be used when users need high-level capability selection, platform concepts, and architecture.": "Visão geral e guia de roteamento da plataforma CloudBase. Use para seleção de recursos de alto nível e conceitos de arquitetura.",
            "CloudBase WeChat integration guide for Mini Program WeChat Pay, Official Account JSAPI Pay, Native QR-code Pay, and Official Account OAuth.": "Guia de integração do CloudBase com WeChat para WeChat Pay em Mini Programas, JSAPI Pay em Contas Oficiais, pagamento por QR Code e OAuth.",
            "CloudBase Run backend development rules (Function mode/Container mode). Use this skill when deploying backend services that require Docker or high scalability.": "Regras de desenvolvimento backend para o CloudBase Run (modo Função / modo Contêiner). Use ao implantar serviços que exigem Docker.",
            "[Deprecated] Optional advanced tool for complex data modeling. For simple MySQL table creation, use relational-database-tool directly.": "[Descontinuado] Ferramenta opcional para modelagem complexa de dados. Para MySQL simples, use diretamente a ferramenta de banco relacional.",
            "CloudBase official HTTP API client guide. This skill should be used when backends, scripts, or non-SDK clients must call CloudBase platform APIs directly.": "Guia do cliente da API HTTP oficial do CloudBase. Use quando backends, scripts ou clientes sem SDK precisarem chamar a API CloudBase.",
            "WeChat Mini Program development skill for building, debugging, previewing, testing, publishing, and optimizing mini program projects.": "Habilidade de desenvolvimento para WeChat Mini Program: compilação, depuração, pré-visualização, testes, publicação e otimização.",
            "AIOps-style one-click inspection skill for CloudBase resources. Use this skill when users need to diagnose errors, check resource health, and inspect metrics.": "Habilidade de inspeção em um clique no estilo AIOps para recursos do CloudBase. Diagnostica erros e verifica a integridade de recursos.",
            "Use when building, debugging, or evaluating CloudBase PostgreSQL / CloudBase PG / PG mode apps, including Postgres schema setup, queries, and migrations.": "Use ao compilar, depurar ou avaliar aplicativos com CloudBase PostgreSQL / CloudBase PG, incluindo esquemas, consultas e migrações.",
            "[Deprecated] This is the required documentation for agents operating on the CloudBase Relational Database through MCP.": "[Descontinuado] Documentação necessária para agentes operando no Banco de Dados Relacional do CloudBase via MCP.",
            "[Deprecated] Use when building frontend Web apps that talk to CloudBase Relational Database via @cloudbase/js-sdk.": "[Descontinuado] Use ao compilar front-ends Web que se comunicam com o Banco de Dados Relacional do CloudBase via @cloudbase/js-sdk.",
            "Use when medium-to-large changes need explicit requirements, technical design, and task planning before implementation, especially for complex features.": "Use quando mudanças médias a grandes precisarem de requisitos explícitos, projeto técnico e planejamento de tarefas antes da implementação.",
            "Use when users need visual direction, interface hierarchy, layout decisions, design specifications, or prototypes before implementing a Web UI.": "Use quando precisar de direção visual, hierarquia de interface, decisões de layout, especificações de design ou protótipos.",
            "Use when users need to implement, integrate, debug, build, deploy, or validate a Web frontend after the product direction is already clear.": "Use para implementar, integrar, depurar, compilar, implantar ou validar um front-end Web após o direcionamento estar definido.",
            "Complete DOCX document creation, editing, and analysis capabilities with support for revisions, comments, formatting preservation, and text extraction.": "Recursos completos de criação, edição e análise de documentos DOCX com suporte a revisões, comentários e preservação de formatação.",
            "Professional PDF toolkit covering four production workflows: reports, creative visuals, academic LaTeX, and existing PDF processing.": "Kit de ferramentas profissional de PDF cobrindo quatro fluxos de produção: relatórios, recursos visuais criativos, LaTeX e processamento de PDFs.",
            "Create or update ZCode plugin source and a local test marketplace, then guide the user to add, install, update and try it in the app.": "Crie ou atualize o código-fonte de plugins do ZCode e um marketplace de teste local, guiando o usuário para adicionar, instalar, atualizar e testar.",
            "Use this skill any time a presentation file is the primary input or output. Covers: creating new .pptx decks from scratch or from an outline/document.": "Use esta habilidade sempre que um arquivo de apresentação for a entrada ou saída principal. Cria novas apresentações .pptx do zero ou de documentos.",
            "Create new skills, edit existing skills, and iterate wording. Use when writing SKILL.md from scratch, improving existing skills, or turning workflows into skills.": "Crie novas habilidades, edite habilidades existentes e aprimore textos. Use ao escrever SKILL.md do zero ou reutilizar fluxos.",
            "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix spreadsheets.": "Use esta habilidade sempre que um arquivo de planilha for a entrada ou saída principal. Permite abrir, ler, editar ou corrigir planilhas.",
            "Use to diagnose and fix ZCode custom slash-command (/command) configuration problems in the ZCode client.": "Use para diagnosticar e corrigir problemas de configuração de comandos de barra personalizados (/comando) no cliente ZCode.",
            "Use to diagnose and fix ZCode hook configuration problems in the ZCode client. Applies when a hook does not trigger or an event name is wrong.": "Use para diagnosticar e corrigir problemas de configuração de hooks no cliente ZCode.",
            "Use to diagnose and fix ZCode MCP (Model Context Protocol) server configuration problems in the ZCode client.": "Use para diagnosticar e corrigir problemas de configuração de servidores MCP (Model Context Protocol) no cliente ZCode.",
            "Use to diagnose and fix ZCode plugin and marketplace problems in the ZCode client. Applies when a plugin is not listed or fails to install.": "Use para diagnosticar e corrigir problemas de plugins e marketplaces no cliente ZCode.",
            "Use to diagnose and fix ZCode skill configuration problems in the ZCode client. Applies when a skill is not discovered or does not trigger.": "Use para diagnosticar e corrigir problemas de configuração de habilidades no cliente ZCode.",
            "Use when configuring ZCode's extension resources (MCP servers, slash commands, skills, hooks, and plugins) or instruction files such as AGENTS.md.": "Use ao configurar os recursos de extensão do ZCode (servidores MCP, comandos de barra, habilidades, hooks e plugins) ou instruções como AGENTS.md.",
            "Report issue": "Informar problema",
            "Reconnect": "Reconectar",
            "Entitlement Rules": "Regras de Benefícios",
            "When you use GLM through Coding Plan in ZCode, quota consumption is converted at a 0.67 coefficient throughout the campaign period.": "Ao utilizar o GLM por meio do Coding Plan no ZCode, o consumo da cota é convertido a um coeficiente de 0,67 durante todo o período da campanha.",
            "In other words, the same model usage only deducts 67% from quota. Effectively, your available quota during the campaign is about 1.5x the original amount.": "Em outras palavras, o mesmo uso do modelo consome apenas 67% da cota. Na prática, sua cota disponível durante a campanha é de aproximadamente 1,5x o valor original.",
            "The conversion rules and end time of the quota benefit is subject to the official announcement.": "As regras de conversão e a data de encerramento do benefício da cota estão sujeitas ao anúncio oficial.",
            "Trust Build": "Trust Build",
            "Trust.patch": "Trust.patch",
            "Trust cannot be reset with one click. We will earn it back, one improvement at a time.": "A confiança não se recupera com um clique. Nós a reconquistaremos, uma melhoria de cada vez.",
            "The user benefits above will take effect on": "Os benefícios acima entrarão em vigor em",
            "nothing leaves your PC;": "nada sai do seu PC;",
            "your code stays local;": "seu código permanece local;",
            "// Snapshot upload removed": "// Upload de instantâneos removido",
            "// Deleted; 3rd-party verified": "// Excluído; verificado por terceiros",
            "// Cloud only if you initiate": "// Nuvem somente se você iniciar",
            "// Updated to latest": "// Atualizado para o mais recente",
            "// Synced releases": "// Lançamentos sincronizados",
            "// Return \u22641mo": "// Reembolso \u22641 mês",
            "// Valid 1 month": "// Válido por 1 mês",
            "// All ZCode users": "// Todos os usuários do ZCode",
            "You now have access to ZCode Trust Build": "Agora você tem acesso ao ZCode Trust Build",
            "is ready to use.": "está pronto para uso.",
            "GLM-5.3-Flash is ready to use.": "GLM-5.3-Flash está pronto para uso.",
            "Got it": "Entendi",
            "Share": "Compartilhar",
            "Claim": "Reivindicar",
            "Account request credential is unavailable: account:zai-start-plan": "A credencial de solicitação da conta não está disponível: account:zai-start-plan",
            "Account request credential is unavailable:": "A credencial de solicitação da conta não está disponível:",
            "Account request credential is unavailable": "A credencial de solicitação da conta não está disponível",
            "Turn execution failed": "Falha na execução do turno",
            "Internal error": "Erro interno",
            "Compact failed": "Falha na compactação",
            "Rewind failed": "Falha no retrocesso",
            "ZCode session failed": "Falha na sessão do ZCode",
            "Error Summary:": "Resumo do erro:",
            "Error Summary": "Resumo do erro",
            "Error Detail:": "Detalhes do erro:",
            "Error Detail": "Detalhes do erro",
            "Error Heading:": "Título do erro:",
            "Error Heading": "Título do erro",
            "reason=unknown": "motivo=desconhecido",
            "retryable=false": "repetível=falso",
            "retryable=true": "repetível=verdadeiro",
            "Valid until": "Válido até",
            "Startup preparation failed": "Falha na preparação de inicialização",
            "The preparation process exited or disconnected. Exit and reopen ZCode to check the migration records again.": "O processo de preparação foi encerrado ou desconectado. Saia e reabra o ZCode para verificar os registros de migração novamente.",
            "Elapsed:": "Decorrido:",
            "Diagnostic ID:": "ID de diagnóstico:",
            "Copy diagnostics": "Copiar diagnósticos",
            "Exit": "Sair",
            "Image Search": "Busca de Imagens",
            "Official ZCode image search MCP server for finding illustrations and reference images.": "Servidor MCP oficial do ZCode para busca de imagens, ilustrações e referências visuais.",
            "PDF document production skills, published as an official ZCode plugin.": "Habilidades de produção de documentos PDF, publicado como um plugin oficial do ZCode.",
            "Presentations": "Apresentações",
            "PPTX presentation production skills, published as an official ZCode plugin.": "Habilidades de produção de apresentações PPTX, publicado como um plugin oficial do ZCode.",
            "Spreadsheets": "Planilhas",
            "XLSX spreadsheet production skills, published as an official ZCode plugin.": "Habilidades de produção de planilhas XLSX, publicado como um plugin oficial do ZCode.",
            "Documents": "Documentos",
            "DOCX document production skills, published as an official ZCode plugin.": "Habilidades de produção de documentos DOCX, publicado como um plugin oficial do ZCode.",
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
            "Select and restore legacy ACP-era ZCode sessions into the new ZCode task and session store.": "Selecione e restaure sessões legadas da era ACP no novo armazenamento de tarefas e sessões do ZCode.",
            "CloudBase development skills and MCP integration for building, deploying, and troubleshooting Web, WeChat Mini Program, database, cloud function, CloudRun, storage, and AI projects.": "Habilidades de desenvolvimento CloudBase e integração MCP para criar, implantar e solucionar problemas em Web, WeChat Mini Program, banco de dados, funções na nuvem, CloudRun, armazenamento e projetos de IA.",
            "Android Emulator": "Emulador Android",
            "iOS Simulator": "Simulador iOS",
            "Computer Use": "Uso do Computador (Computer Use)",
            "Browser Use": "Uso do Navegador (Browser Use)",
            "Plugin Creator": "Criador de Plugins",
            "Skill Creator": "Criador de Habilidades",
            "ZCode Guide": "Guia do ZCode",
            "Restore Legacy Sessions": "Restaurar Sessões Legadas",
            "My feedback": "Meus feedbacks",
            "Issue description": "Descrição do problema",
            "Submitted": "Enviado",
            "Completed": "Concluído",
            "just now": "agora mesmo",
            "New feedback": "Novo feedback",
            "Feedback submitted. We will review it soon.": "Feedback enviado. Iremos analisá-lo em breve.",
            "Feedback submitted": "Feedback enviado",
            "We will review it soon.": "Iremos analisá-lo em breve.",
            "Ideal for getting started": "Ideal para começar",
            "/month": "/mês",
            "10,000 Credits / week": "10.000 Créditos / semana",
            "Lightweight repo iteration": "Iteração leve em repositórios",
            "Rolling access to the latest flagship models and features": "Acesso contínuo aos mais recentes modelos topo de linha e recursos",
            "Supports 20+ coding tools, including ZCode": "Suporte a mais de 20 ferramentas de codificação, incluindo o ZCode",
            "ZCode-exclusive benefits:": "Benefícios exclusivos do ZCode:",
            "Idle-time tasks: 1/day Free token": "Tarefas em períodos ociosos: 1/dia de token gratuito",
            "Idle-time tasks: 3/day Free token": "Tarefas em períodos ociosos: 3/dia de token gratuito",
            "Idle-time tasks: 5/day Free token": "Tarefas em períodos ociosos: 5/dia de token gratuito",
            "Reset the 5-hour quota during idle hours": "Redefinir a cota de 5 horas durante os horários ociosos",
            "ZCode MCP benefits": "Benefícios MCP do ZCode",
            "150% quota with a limited-time usage multiplier discount": "150% de cota com desconto temporário no multiplicador de uso",
            "Everything in Lite": "Tudo no Lite",
            "6x Lite usage": "6x o uso do Lite",
            "Priority access to the latest flagship models and features": "Acesso prioritário aos mais recentes modelos topo de linha e recursos",
            "Includes a curated selection of MCP tools": "Inclui uma seleção com curadoria de ferramentas MCP",
            "Faster generation speeds": "Velocidades de geração mais rápidas",
            "Everything in Pro": "Tudo no Pro",
            "14x Lite usage": "14x o uso do Lite",
            "Built for advanced users working on mid-to-large repos": "Desenvolvido para usuários avançados trabalhando em repositórios médios a grandes",
            "First access to the latest flagship models and features": "Primeiro acesso aos mais recentes modelos topo de linha e recursos",
            "Dedicated resources during peak times": "Recursos dedicados durante horários de pico",
            "Expired": "Expirado",
            "Ended": "Encerrado",
            "5-day free trial, including:": "Teste gratuito de 5 dias, incluindo:",
            "GLM-5.3 · 3M tokens daily": "GLM-5.3 · 3M de tokens diários",
            "GLM-5.3-Flash · 5M tokens daily": "GLM-5.3-Flash · 5M de tokens diários",
            "Configure custom models with BYOK": "Configurar modelos personalizados com BYOK",
            "Occasional free token offers": "Ofertas ocasionais de tokens gratuitos",
            "Weekend Build": "Compilação de Fim de Semana",
            "Global Build": "Compilação Global",
            "Active": "Ativo",
            "Current Plan": "Plano Atual",
            "Upgrade Plan": "Plano de atualização",
            "Plan details": "Detalhes do plano",
            "exceed quota limit": "limite de cota excedido",
            "Exceed quota limit": "Limite de cota excedido",
            "Quota limit reached": "Limite de cota atingido",
            "min ago": "minutos atrás",
            "Error Summary: ...": "Resumo do erro: ...",
            "ZCode Desktop App": "Aplicativo Desktop ZCode",
            "Saved workflows": "Fluxos de trabalho salvos",
            "Visible from every project": "Visível em todos os projetos",
            "No global workflows yet. Good for flows that depend on no particular project, such as deep research.": "Ainda não há fluxos de trabalho globais. Eles são úteis para tarefas que não dependem de um projeto específico, como pesquisas aprofundadas.",
            "Open a local project to run this workflow": "Abra um projeto local para executar este fluxo de trabalho",
            "Open a local project to run this fluxo de trabalho": "Abra um projeto local para executar este fluxo de trabalho",
            "Saved fluxos de trabalho": "Fluxos de trabalho salvos",
            "Create in chat": "Criar no chat",
            "Open a workspace to see its workflows.": "Abra um espaço de trabalho para ver seus fluxos de trabalho.",
            "Developer Tools": "Ferramentas de desenvolvimento",
            "Utilities": "Utilitários",
            "Productivity": "Produtividade",
            "Finance": "Finanças",
            "Show less": "Mostrar menos",
            "Show more": "Mostrar mais",
            "Install": "Instalar",
            "Alibaba Cloud CLI workflows for credential setup, profile checks, and safe cloud resource operations.": "Fluxos de trabalho do Alibaba Cloud CLI para configurar credenciais, verificar perfis e operar recursos de nuvem com segurança.",
            "Lark CLI workflows for docs, sheets, Base, calendar, messaging, and other SaaS resources with guided setup and OAuth login.": "Fluxos de trabalho do Lark CLI para documentos, planilhas, Base, calendário, mensagens e outros recursos SaaS, com configuração guiada e login OAuth.",
            "Tencent Meeting CLI workflows with OAuth2 setup, meeting management, recordings, and attendee reports.": "Fluxos de trabalho do Tencent Meeting CLI com configuração OAuth2, gerenciamento de reuniões, gravações e relatórios de participantes.",
            "DingTalk Workspace CLI workflows with OAuth/device authorization, profile checks, and optional upstream Skills.": "Fluxos de trabalho do DingTalk Workspace CLI com autorização OAuth ou por dispositivo, verificação de perfil e habilidades oficiais opcionais.",
            "WeCom CLI workflows for messages, docs, sheets, mail, calendar, meetings, contacts, and todos with QR authentication.": "Fluxos de trabalho do WeCom CLI para mensagens, documentos, planilhas, e-mail, calendário, reuniões, contatos e tarefas, com autenticação por QR Code.",
            "Obsidian authoring skills from kepano/obsidian-skills: Obsidian Flavored Markdown notes, Bases database views, JSON Canvas boards, vault automation via Obsidian CLI, clean web extraction with Defuddle, and Knap template rendering — plus visualization skills from axtonliu/axton-obsidian-visual-skills: Mermaid and Excalidraw diagram generation and text-to-canvas layout. A setup skill verifies and installs the Obsidian CLI, defuddle, and knap.": "Habilidades de criação para o Obsidian, de kepano/obsidian-skills: notas em Markdown no formato Obsidian, visualizações de banco de dados Bases, quadros JSON Canvas, automação de cofres pelo Obsidian CLI, extração limpa de conteúdo da web com Defuddle e renderização de modelos com Knap. Inclui também habilidades visuais de axtonliu/axton-obsidian-visual-skills para gerar diagramas Mermaid e Excalidraw e organizar texto em telas. Uma habilidade de configuração verifica e instala o Obsidian CLI, o Defuddle e o Knap.",
            "Accounting close and statutory reporting off the company's own ledger: month-end close checks, ledger reconciliation to transaction-level root cause, account mapping for consolidation, and statutory statements delivered as review-ready drafts": "Fechamento contábil e relatórios estatutários com base no livro-razão da própria empresa: verificações de fim de mês, conciliação até a causa raiz das transações, mapeamento de contas para consolidação e demonstrações estatutárias entregues como rascunhos prontos para revisão.",
            "Corporate-banking client acquisition: prospect screening by region, industry chain, park and cluster, business-opportunity scanning, and full client portraits combining registry, relationships, opportunity signals and risk": "Prospecção de clientes para banco corporativo: triagem por região, cadeia produtiva, parque industrial e polo empresarial; busca de oportunidades; e perfis completos que combinam dados cadastrais, relacionamentos, sinais de oportunidade e riscos.",
            "Transaction structuring and modeling: accretion/dilution analysis, sources and uses with pro-forma capital structure, precedent-transaction comps, and capital-raise dilution modeling for M&A, IPO, placements, and rights issues": "Estruturação e modelagem de transações: análise de acréscimo ou diluição, fontes e usos com estrutura de capital pro forma, comparação com transações anteriores e modelagem de diluição em captações para fusões e aquisições, IPOs, colocações e ofertas de direitos.",
            "Top-down macro and strategy work: macro dashboards across growth/inflation/liquidity/credit, index valuation percentiles and earnings attribution, cross-asset allocation views, and policy and industrial-plan tracking": "Análise macroeconômica e estratégia de cima para baixo: painéis de crescimento, inflação, liquidez e crédito; percentis de avaliação de índices e atribuição de resultados; alocação entre classes de ativos; e acompanhamento de políticas e planos industriais.",
            "Corporate finance and FP&A: management reporting off a closed ledger, rolling cash-flow forecasts, budget-versus-actual variance analysis, scenario and break-even analysis, and peer benchmarking against listed comparables": "Finanças corporativas e planejamento financeiro: relatórios gerenciais com base no livro-razão fechado, projeções contínuas de fluxo de caixa, análise de desvios entre orçamento e realizado, cenários, ponto de equilíbrio e comparação com empresas listadas semelhantes.",
            "Watchlist and portfolio monitoring: after-close recaps, position event alerts (announcements, pledges, lockup expiries), and intraday move attribution for A/H/US names": "Acompanhamento de listas e carteiras: resumos após o fechamento, alertas de eventos das posições (comunicados, garantias e fim de períodos de restrição) e análise intradiária de movimentos de ações A, H e dos EUA.",
            "End-to-end investment research reports, sector analysis, earnings updates, and valuation models": "Relatórios completos de pesquisa de investimentos, análises setoriais, atualizações de resultados e modelos de avaliação.",
            "MCP services for RoyalFlush iFinD stock, global stock, index, fund, and bond data.": "Serviços MCP de dados da RoyalFlush iFinD sobre ações chinesas e globais, índices, fundos e títulos de dívida.",
            "MCP services for Wind stock, global stock, index, fund, bond, economic, and document data.": "Serviços MCP de dados da Wind sobre ações chinesas e globais, índices, fundos, títulos de dívida, indicadores econômicos e documentos.",
            "MCP service for Tianyancha company information queries.": "Serviço MCP para consultas de informações empresariais no Tianyancha.",
            "MCP services for SEC EDGAR filing search and financial web and news search.": "Serviços MCP para pesquisar documentos da SEC EDGAR, notícias e informações financeiras na web.",
            "GitHub CLI workflows for commits, pull requests, issues, releases, Actions, repositories, Codespaces, and other GitHub resources.": "Fluxos de trabalho do GitHub CLI para commits, pull requests, issues, lançamentos, Actions, repositórios, Codespaces e outros recursos do GitHub.",
            "GitLab CLI workflows based on GitLab's official Agent Skills for merge requests, issues, CI/CD, repositories, releases, and API operations.": "Fluxos de trabalho do GitLab CLI baseados nas Agent Skills oficiais do GitLab para merge requests, issues, CI/CD, repositórios, lançamentos e operações de API.",
            "Local-first security guardrails for ZCode with pre-write hooks, end-of-turn review, Git gates, commands, a security-scan skill, and an optional MCP server for sealed deep scans.": "Proteções de segurança locais para o ZCode, com hooks antes da gravação, revisão ao fim do turno, controles do Git, comandos, habilidade de análise de segurança e servidor MCP opcional para verificações aprofundadas isoladas.",
            "Code Security Protection": "Proteção de segurança do código",
            "GitHub": "GitHub",
            "Gitlab": "GitLab",
            "Gitlab CLI workflows based on GitLab's official Agent Skills...": "Fluxos de trabalho do GitLab CLI baseados nas Agent Skills oficiais do GitLab...",
            "Cloudbase Skills": "Habilidades do CloudBase",
            "Lark CLI": "Lark CLI",
            "Tencent Meeting CLI": "Tencent Meeting CLI",
            "DingTalk CLI": "DingTalk CLI",
            "WeCom CLI": "WeCom CLI",
            "Obsidian": "Obsidian",
            "Plugin Creator": "Criador de plugins",
            "Skill Creator": "Criador de habilidades",
            "ZCode Guide": "Guia do ZCode",
            "You’re out of usage": "Você atingiu seu limite de uso",
            "You're out of usage": "Você atingiu seu limite de uso",
            "Upgrade to unlock more models": "Faça upgrade para desbloquear mais modelos",
            "More models are only available on paid plans.": "Mais modelos estão disponíveis apenas nos planos pagos.",
            "Warning: Updates Apply Automatically": "Aviso: as atualizações são aplicadas automaticamente"
        };
        const _filteredMap = {};
        for (const [k, v] of Object.entries(_ptDomMap)) {
            if (k && v && k !== v) {
                _filteredMap[k] = v;
            }
        }
        const _sortedDomEntries = Object.entries(_filteredMap).sort((a, b) => b[0].length - a[0].length);
        const _visited = new WeakSet();

        function _translateExactMappedText(node) {
            if (!node) return;
            if (node.nodeType === 3) {
                const value = node.nodeValue || "";
                const key = value.trim();
                if (key.startsWith("Please create a PowerPoint presentation for me on the topic")) {
                    node.nodeValue = value.replace(key, "Crie uma apresentação de PowerPoint sobre o tema A evolução dos agentes de IA, cobrindo três etapas: Engenharia de prompts (origens, técnicas principais e limitações) → Engenharia de contexto (por que o contexto é importante e tecnologias-chave, como RAG, memória e uso de ferramentas) → Engenharia de harness (evolução dos frameworks de agentes e produtos representativos, como AutoGPT, ACPAgent e OpenClaw). O estilo deve ser tecnológico, com fundo escuro e uma linha do tempo claramente apresentada.");
                    return;
                }
                if (_filteredMap[key]) node.nodeValue = value.replace(key, _filteredMap[key]);
                return;
            }
            if (node.nodeType !== 1 || node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'CODE' || node.tagName === 'PRE') return;
            const text = (node.textContent || "").trim();
            const containsPromptTemplate = text.includes("Please create a PowerPoint presentation for me on the topic");
            if (!_filteredMap[text] && !containsPromptTemplate) return;
            for (let i = 0; i < node.childNodes.length; i++) _translateExactMappedText(node.childNodes[i]);
        }

        function _translateNode(node) {
            if (!_isPtBrActive() || !node || _visited.has(node)) return;
            _visited.add(node);

            try {
                if (node.nodeType === 3) {
                    const val = node.nodeValue;
                    if (!val) return;
                    const t = val.trim();
                    if (!t || t.length < 2) return;
                    if (_filteredMap[t]) {
                        const rep = _filteredMap[t];
                        if (rep !== t) {
                            node.nodeValue = val.replace(t, rep);
                        }
                        return;
                    }
                    if (/^\d+\s*min\s+ago$/i.test(t)) {
                        node.nodeValue = val.replace(/min\s+ago/i, 'min atrás');
                        return;
                    }
                    if (/^\d+\s*hours?\s+ago$/i.test(t)) {
                        node.nodeValue = val.replace(/hours?\s+ago/i, 'horas atrás');
                        return;
                    }
                    if (/^\d+\s*days?\s+ago$/i.test(t)) {
                        node.nodeValue = val.replace(/days?\s+ago/i, 'dias atrás');
                        return;
                    }
                    if (t.length >= 8) {
                        for (let i = 0; i < _sortedDomEntries.length; i++) {
                            const k = _sortedDomEntries[i][0];
                            if (k.length > t.length) continue;
                            if (val.includes(k)) {
                                node.nodeValue = val.replaceAll(k, _sortedDomEntries[i][1]);
                                break;
                            }
                        }
                    }
                } else if (node.nodeType === 1) {
                    const tag = node.tagName;
                    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'PRE' || tag === 'CODE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CANVAS') return;
                    const cl = node.className;
                    if (typeof cl === 'string' && (cl.includes('monaco') || cl.includes('prose') || cl.includes('conversation') || cl.includes('message') || cl.includes('terminal') || cl.includes('xterm') || cl.includes('chat'))) {
                        _translateExactMappedText(node);
                        return;
                    }

                    if (node.placeholder && _filteredMap[node.placeholder.trim()]) {
                        node.placeholder = _filteredMap[node.placeholder.trim()];
                    }
                    if (node.title && _filteredMap[node.title.trim()]) {
                        node.title = _filteredMap[node.title.trim()];
                    }
                    if (node.childNodes && node.childNodes.length > 0) {
                        for (let i = 0; i < node.childNodes.length; i++) {
                            _translateNode(node.childNodes[i]);
                        }
                    }
                }
            } catch (err) {}
        }

        if (typeof document !== "undefined") {
            const observer = new MutationObserver((mutations) => {
                for (let i = 0; i < mutations.length; i++) {
                    const m = mutations[i];
                    if (m.type === "childList") {
                        for (let j = 0; j < m.addedNodes.length; j++) {
                            _translateNode(m.addedNodes[j]);
                        }
                    } else if (m.type === "characterData" && _isPtBrActive()) {
                        // React can update existing text nodes without inserting new DOM nodes.
                        // Translate exact mapped values only; never walk the page on text mutations.
                        const textNode = m.target;
                        const value = textNode.nodeValue || "";
                        const key = value.trim();
                        if (_filteredMap[key]) textNode.nodeValue = value.replace(key, _filteredMap[key]);
                    } else if (m.type === "attributes" && _isPtBrActive()) {
                        // Quick-task labels/tooltips can be refreshed as attributes on reused nodes.
                        const element = m.target;
                        const value = element.getAttribute(m.attributeName) || "";
                        const key = value.trim();
                        if (_filteredMap[key]) element.setAttribute(m.attributeName, value.replace(key, _filteredMap[key]));
                    }
                }
            });
            const startObserving = () => {
                if (document.body) {
                    _translateNode(document.body);
                    observer.observe(document.body, {
                        childList: true,
                        characterData: true,
                        attributes: true,
                        attributeFilter: ["title", "aria-label", "placeholder"],
                        subtree: true
                    });
                }
            };
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", startObserving);
            } else {
                startObserving();
            }
        }
    } catch (e) {}
    `;
    preloadCode = preloadCode + "\n" + domTranslator;
    console.log("    -> Injetado observador DOM de tradução dinâmica no preload index.cjs.");
}

// F. Patch webviews: rewardsWebview.cjs e codingPlanWebview.cjs
console.log("[*] Aplicando patch nos preloads das Webviews (Recompensas e Planos)");
const webviewTranslator = `
try {
    function _wvShouldTranslate() {
        try {
            const fs = require("fs");
            const os = require("os");
            const path = require("path");
            const home = process.env.USERPROFILE || os.homedir();
            const settingsPath = path.join(home, ".zcode", "v2", "setting.json");
            const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
            const preference = settings.localePreference || settings.locale;
            if (typeof preference === "string" && preference.trim()) {
                const normalized = preference.trim().toLowerCase();
                if (normalized.startsWith("pt")) return true;
                if (!["system", "default", "auto", "system-default"].includes(normalized)) return false;
            }
        } catch (e) {}
        const language = typeof navigator !== "undefined" ? navigator.language : "";
        return typeof language === "string" && language.toLowerCase().startsWith("pt");
    }
    const _wvMap = {
        "Personal plans": "Planos individuais",
        "Team plans": "Planos para equipes",
        "Monthly": "Mensal",
        "Quarterly": "Trimestral",
        "Yearly": "Anual",
        "Start Plan": "Plano Inicial",
        "Subscribe": "Assinar",
        "Refer a friend": "Indique um amigo",
        "Rewards": "Recompensas",
        "Reward tasks": "Tarefas de recompensa",
        "Your referrals": "Suas indicações",
        "Referral tasks": "Tarefas de indicação",
        "Invite friends": "Convide amigos",
        "Invite new users, earn more together.": "Convide novos usuários e ganhem juntos.",
        "Invite new users,": "Convide novos usuários,",
        "earn more together.": "ganhem juntos.",
        "REWARDS": "RECOMPENSAS",
        "BUILD TOGETHER": "CRESCEMOS JUNTOS",
        "The campaign hasn’t started yet": "A campanha ainda não começou",
        "The campaign hasn't started yet": "A campanha ainda não começou",
        "The campaign hasn’t started yet.": "A campanha ainda não começou.",
        "The campaign hasn't started yet.": "A campanha ainda não começou.",
        "Task": "Tarefa",
        "Progress": "Progresso",
        "Reward": "Recompensa",
        "No reward tasks": "Nenhuma tarefa de recompensa",
        "No rewards yet": "Nenhuma recompensa ainda",
        "Friend": "Amigo",
        "Status": "Situação",
        "Friend’s reward": "Recompensa do amigo",
        "Friend's reward": "Recompensa do amigo",
        "Invited at": "Convidado em",
        "No referrals yet": "Nenhuma indicação ainda",
        "Reward history": "Histórico de recompensas",
        "Source": "Origem",
        "Received": "Recebido",
        "Claim": "Resgatar",
        "Claim now": "Resgatar agora",
        "Refresh": "Atualizar",
        "Open site": "Abrir site",
        "BETTER WHEN SHARED": "MELHOR QUANDO COMPARTILHADO",
        "Invite new users, earn more together.": "Convide novos usuários e ganhem juntos.",
        "Invited Users": "Usuários convidados",
        "Total Earned": "Total ganho",
        "Rules": "Regras",
        "Copy Link": "Copiar link",
        "Rules Details": "Detalhes das regras",
        "Reward History": "Histórico de recompensas",
        "Invite link": "Link de convite"
    };
    const _wvVisited = new WeakSet();
    function _transWv(node) {
        if (!_wvShouldTranslate() || !node || _wvVisited.has(node)) return;
        _wvVisited.add(node);
        if (node.nodeType === 3) {
            const t = node.nodeValue ? node.nodeValue.trim() : "";
            if (_wvMap[t] && _wvMap[t] !== t) {
                const rep = node.nodeValue.replace(t, _wvMap[t]);
                if (rep !== node.nodeValue) node.nodeValue = rep;
            }
        } else if (node.nodeType === 1) {
            if (node.childNodes) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    _transWv(node.childNodes[i]);
                }
            }
        }
    }
    if (typeof document !== "undefined") {
        const obs = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === "childList") {
                    for (let j = 0; j < m.addedNodes.length; j++) {
                        _transWv(m.addedNodes[j]);
                    }
                } else if (m.type === "characterData" && _wvShouldTranslate()) {
                    const textNode = m.target;
                    const value = textNode.nodeValue || "";
                    const key = value.trim();
                    if (_wvMap[key]) textNode.nodeValue = value.replace(key, _wvMap[key]);
                }
            }
        });
        window.addEventListener("DOMContentLoaded", () => {
            if (document.body) {
                _transWv(document.body);
                obs.observe(document.body, { childList: true, characterData: true, subtree: true });
            }
        });
    }
} catch(e) {}
`;

let rewardsCode = getCleanFile("out/preload/rewardsWebview.cjs");
if (rewardsCode) rewardsCode += "\n" + webviewTranslator;

let codingPlanCode = getCleanFile("out/preload/codingPlanWebview.cjs");
if (codingPlanCode) codingPlanCode += "\n" + webviewTranslator;

// Validação sintática dos códigos gerados
const tempCheckIntl = path.join(resourcesDir, "temp_check_intl.mjs");
const tempCheckMain = path.join(resourcesDir, "temp_check_main.mjs");
const tempCheckStyles = path.join(resourcesDir, "temp_check_styles.mjs");
const tempCheckPreload = path.join(resourcesDir, "temp_check_preload.cjs");
const tempCheckHost = path.join(resourcesDir, "temp_check_host.mjs");
const tempCheckDesktopMenu = path.join(resourcesDir, "temp_check_desktop_menu.mjs");
const tempCheckRewardsBridge = path.join(resourcesDir, "temp_check_rewards_bridge.mjs");

try {
    fs.writeFileSync(tempCheckIntl, intlCode, "utf8");
    execSync(`node --check "${tempCheckIntl}"`, { stdio: "inherit" });
    fs.unlinkSync(tempCheckIntl);

    fs.writeFileSync(tempCheckMain, mainCode, "utf8");
    execSync(`node --check "${tempCheckMain}"`, { stdio: "inherit" });
    fs.unlinkSync(tempCheckMain);

    fs.writeFileSync(tempCheckStyles, stylesCode, "utf8");
    execSync(`node --check "${tempCheckStyles}"`, { stdio: "inherit" });
    fs.unlinkSync(tempCheckStyles);

    if (hostCode) {
        fs.writeFileSync(tempCheckHost, hostCode, "utf8");
        execSync(`node --check "${tempCheckHost}"`, { stdio: "inherit" });
        fs.unlinkSync(tempCheckHost);
    }

    if (rewardsBridgeCode) {
        fs.writeFileSync(tempCheckRewardsBridge, rewardsBridgeCode, "utf8");
        execSync(`node --check "${tempCheckRewardsBridge}"`, { stdio: "inherit" });
        fs.unlinkSync(tempCheckRewardsBridge);
    }

    if (desktopMenuChunkCode) {
        fs.writeFileSync(tempCheckDesktopMenu, desktopMenuChunkCode, "utf8");
        execSync(`node --check "${tempCheckDesktopMenu}"`, { stdio: "inherit" });
        fs.unlinkSync(tempCheckDesktopMenu);
    }

    if (preloadCode) {
        fs.writeFileSync(tempCheckPreload, preloadCode, "utf8");
        execSync(`node --check "${tempCheckPreload}"`, { stdio: "inherit" });
        fs.unlinkSync(tempCheckPreload);
    }

    console.log("    [OK] Verificação sintatica ES Module de todos os modulos aprovada com 100% de integridade.");
} catch (e) {
    try { fs.unlinkSync(tempCheckIntl); } catch {}
    try { fs.unlinkSync(tempCheckMain); } catch {}
    try { fs.unlinkSync(tempCheckStyles); } catch {}
    try { fs.unlinkSync(tempCheckHost); } catch {}
    try { fs.unlinkSync(tempCheckDesktopMenu); } catch {}
    try { fs.unlinkSync(tempCheckRewardsBridge); } catch {}
    try { fs.unlinkSync(tempCheckPreload); } catch {}
    console.error("[x] Erro: O codigo gerado possui falhas de sintaxe e foi rejeitado para evitar quebra:", e.message);
    process.exit(1);
}

const patchedMainBuf = Buffer.from(mainCode, "utf8");
const patchedStylesBuf = Buffer.from(stylesCode, "utf8");
const patchedHostBuf = hostCode ? Buffer.from(hostCode, "utf8") : null;
const patchedDesktopMenuBuf = desktopMenuChunkCode ? Buffer.from(desktopMenuChunkCode, "utf8") : null;
const patchedChunkHostBuf = chunkHostCode ? Buffer.from(chunkHostCode, "utf8") : null;
const patchedIntlBuf = Buffer.from(intlCode, "utf8");
const patchedUsageBuf = usageCode ? Buffer.from(usageCode, "utf8") : null;
const patchedRewardsBridgeBuf = rewardsBridgeCode ? Buffer.from(rewardsBridgeCode, "utf8") : null;
const patchedPreloadBuf = preloadCode ? Buffer.from(preloadCode, "utf8") : null;
const patchedRewardsBuf = rewardsCode ? Buffer.from(rewardsCode, "utf8") : null;
const patchedCodingPlanBuf = codingPlanCode ? Buffer.from(codingPlanCode, "utf8") : null;
const cleanPkgBuf = Buffer.from(JSON.stringify(pkgObj, null, 2) + "\n", "utf8");

// Escanear e reconstruir arvore completa do ASAR
function scan(node, prefix = "") {
    let items = [];
    for (const [k, v] of Object.entries(node.files || {})) {
        const full = prefix ? prefix + "/" + k : k;
        if (v.files) {
            items = items.concat(scan(v, full));
        } else {
            items.push({ path: full, entry: v });
        }
    }
    return items;
}

const allItems = scan(cleanHeader);
let currentOffset = 0;
const filesToWrite = [];

function setDeep(obj, pathArr, leaf) {
    let cur = obj;
    for (let i = 0; i < pathArr.length - 1; i++) {
        const p = pathArr[i];
        if (!cur.files) cur.files = {};
        if (!cur.files[p]) cur.files[p] = {};
        cur = cur.files[p];
    }
    if (!cur.files) cur.files = {};
    cur.files[pathArr[pathArr.length - 1]] = leaf;
}

const newHeader = { files: {} };
const targetIntlRelPath = `out/renderer/assets/${intlFileName}`;
const targetStylesRelPath = `out/renderer/assets/${stylesFileName}`;
const targetUsageRelPath = usageFileName ? `out/renderer/assets/${usageFileName}` : null;
const targetRewardsBridgeRelPath = rewardsBridgeFileName ? `out/renderer/assets/${rewardsBridgeFileName}` : null;

for (const item of allItems) {
    const p = item.path;
    const e = item.entry;
    const parts = p.split("/");

    if (e.unpacked) {
        setDeep(newHeader, parts, { size: e.size, unpacked: true });
        continue;
    }

    if (p === targetIntlRelPath) {
        const size = patchedIntlBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedIntlBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedIntlBuf, size, path: p });
        currentOffset += size;
    } else if (p === targetStylesRelPath) {
        const size = patchedStylesBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedStylesBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedStylesBuf, size, path: p });
        currentOffset += size;
    } else if (targetUsageRelPath && p === targetUsageRelPath && patchedUsageBuf) {
        const size = patchedUsageBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedUsageBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedUsageBuf, size, path: p });
        currentOffset += size;
    } else if (targetRewardsBridgeRelPath && p === targetRewardsBridgeRelPath && patchedRewardsBridgeBuf) {
        const size = patchedRewardsBridgeBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedRewardsBridgeBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedRewardsBridgeBuf, size, path: p });
        currentOffset += size;
    } else if (p === "out/preload/index.cjs" && patchedPreloadBuf) {
        const size = patchedPreloadBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedPreloadBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedPreloadBuf, size, path: p });
        currentOffset += size;
    } else if (p === "out/preload/rewardsWebview.cjs" && patchedRewardsBuf) {
        const size = patchedRewardsBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedRewardsBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedRewardsBuf, size, path: p });
        currentOffset += size;
    } else if (p === "out/preload/codingPlanWebview.cjs" && patchedCodingPlanBuf) {
        const size = patchedCodingPlanBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedCodingPlanBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedCodingPlanBuf, size, path: p });
        currentOffset += size;
    } else if (p === "out/host/index.js" && patchedHostBuf) {
        const size = patchedHostBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedHostBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedHostBuf, size, path: p });
        currentOffset += size;
    } else if (hostGroupChunkName && p === `out/host/${hostGroupChunkName}` && patchedChunkHostBuf) {
        const size = patchedChunkHostBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedChunkHostBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedChunkHostBuf, size, path: p });
        currentOffset += size;
    } else if (p === "out/main/index.js") {
        const size = patchedMainBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedMainBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedMainBuf, size, path: p });
        currentOffset += size;
    } else if (desktopMenuChunkName && p === `out/main/${desktopMenuChunkName}` && patchedDesktopMenuBuf) {
        const size = patchedDesktopMenuBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(patchedDesktopMenuBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: patchedDesktopMenuBuf, size, path: p });
        currentOffset += size;
    } else if (p === "package.json") {
        const size = cleanPkgBuf.length;
        const offset = currentOffset.toString();
        const integrity = computeIntegrity(cleanPkgBuf);
        setDeep(newHeader, parts, { size, offset, integrity });
        filesToWrite.push({ type: "buffer", buffer: cleanPkgBuf, size, path: p });
        currentOffset += size;
    } else {
        const size = e.size;
        const srcOffset = cleanBaseOffset + parseInt(e.offset, 10);
        const offset = currentOffset.toString();
        const leaf = { size, offset };
        if (e.integrity) leaf.integrity = e.integrity;
        setDeep(newHeader, parts, leaf);
        filesToWrite.push({ type: "copy", srcOffset, size, path: p });
        currentOffset += size;
    }
}

// Serializar novo cabecalho
const newJsonStr = JSON.stringify(newHeader);
const newJsonBuf = Buffer.from(newJsonStr, "utf8");
const newJsonSize = newJsonBuf.length;

const padding = (4 - (newJsonSize % 4)) % 4;
const headerSize = newJsonSize + padding;
const size2 = headerSize + 8;
const size3 = headerSize + 4;

const prefixBuf = Buffer.alloc(16);
prefixBuf.writeUInt32LE(4, 0);
prefixBuf.writeUInt32LE(size2, 4);
prefixBuf.writeUInt32LE(size3, 8);
prefixBuf.writeUInt32LE(newJsonSize, 12);

console.log("[*] Gerando novo app.asar traduzido para ZCode (a partir da base 100% original em inglês)...");
const outFd = fs.openSync(tempAsar, "w");
fs.writeSync(outFd, prefixBuf, 0, 16);
fs.writeSync(outFd, newJsonBuf, 0, newJsonSize);
if (padding > 0) fs.writeSync(outFd, Buffer.alloc(padding));

const CHUNK_SIZE = 4 * 1024 * 1024;
const copyBuf = Buffer.alloc(CHUNK_SIZE);

for (let i = 0; i < filesToWrite.length; i++) {
    const f = filesToWrite[i];
    if (f.type === "buffer") {
        fs.writeSync(outFd, f.buffer, 0, f.buffer.length);
    } else {
        let remaining = f.size;
        let readPos = f.srcOffset;
        while (remaining > 0) {
            const toRead = Math.min(remaining, CHUNK_SIZE);
            fs.readSync(cleanFd, copyBuf, 0, toRead, readPos);
            fs.writeSync(outFd, copyBuf, 0, toRead);
            readPos += toRead;
            remaining -= toRead;
        }
    }
}

fs.closeSync(cleanFd);
fs.closeSync(outFd);

// Atualizar app-pt.asar no diretorio do projeto
const projectPtAsar = path.join(scriptDir, "app-pt.asar");
try {
    fs.copyFileSync(tempAsar, projectPtAsar);
    console.log("    [OK] Arquivo portátil app-pt.asar sincronizado no projeto.");
} catch (e) { }

// Substituição atômica final
fs.copyFileSync(tempAsar, srcAsar);
try { fs.unlinkSync(tempAsar); } catch (e) { }

// Atualizar configuracoes do usuario para pt-BR
const userConfigPaths = [
    path.join(process.env.USERPROFILE || "", ".zcode", "v2", "setting.json"),
    path.join(process.env.USERPROFILE || "", ".zcode", "setting.json")
];

for (const uPath of userConfigPaths) {
    if (fs.existsSync(uPath)) {
        try {
            const uCfg = JSON.parse(fs.readFileSync(uPath, "utf8"));
            uCfg.locale = "pt-BR";
            uCfg.localePreference = "pt-BR";
            fs.writeFileSync(uPath, JSON.stringify(uCfg, null, 2), "utf8");
            console.log(`    [OK] Configuracao atualizada para 'pt-BR' em: ${uPath}`);
        } catch (e) {
            console.warn(`    [!] Aviso ao atualizar ${uPath}:`, e.message);
        }
    }
}

console.log("====================================================================");
console.log(` [OK] SUCESSO! ZCode atualizado e traduzido na versão ${currentVersion}!`);
console.log("====================================================================");
