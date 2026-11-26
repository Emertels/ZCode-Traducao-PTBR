const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

module.exports = function patchZCode4(ctx) {
    const {
        cleanFd,
        cleanHeader,
        cleanBaseOffset,
        getCleanFile,
        dict,
        currentVersion,
        srcAsar,
        tempAsar,
        scriptDir,
        computeIntegrity,
        marketplaceDomTranslations,
        aboutCredit
    } = ctx;

    console.log("[*] Arquitetura ZCode 4.x detectada — iniciando patcher PT-BR dedicado (4.0.0+)...");

    function getAssetsFiles(dirParts) {
        let cur = cleanHeader;
        for (const p of dirParts) cur = cur.files[p];
        return Object.keys(cur.files);
    }

    const rendererAssets = getAssetsFiles(["out", "renderer", "assets"]);
    const mainFiles = getAssetsFiles(["out", "main"]);
    const hostFiles = getAssetsFiles(["out", "host"]);

    const intlFile = rendererAssets.find(f => f.startsWith("IntlProvider-") && f.endsWith(".js"));
    const valFile = rendererAssets.find(f => f.startsWith("validation-") && f.endsWith(".js"));
    const mainChunkFile = mainFiles.find(f => {
        if (!f.startsWith("chunk-") || !f.endsWith(".js")) return false;
        const c = getCleanFile("out/main/" + f);
        return c && c.includes("tray.menu.openZCode") && c.includes("resolveLocaleFromLanguageTag");
    });
    const hostChunkFile = hostFiles.find(f => {
        if (!f.startsWith("chunk-") || !f.endsWith(".js")) return false;
        const c = getCleanFile("out/host/" + f);
        return c && c.includes("isLocalePreference") && c.includes("toZhOrEnLocale");
    });

    if (!intlFile || !valFile || !mainChunkFile || !hostChunkFile) {
        console.error("[x] Arquivos essenciais da arquitetura 4.x não encontrados:", { intlFile, valFile, mainChunkFile, hostChunkFile });
        process.exit(1);
    }

    const replacements = new Map();

    // 1. IntlProvider-*.js — construir catálogo PT-BR completo para todas as chaves de en-US
    console.log(`[*] Traduzindo catálogo completo em: out/renderer/assets/${intlFile}`);
    let intlCode = getCleanFile("out/renderer/assets/" + intlFile);
    const gStart = intlCode.indexOf("var g={");
    const underscoreIdx = intlCode.indexOf(",_={", gStart);
    const vIdx = intlCode.indexOf(",v={", underscoreIdx);
    const yIdx = intlCode.indexOf(",y={", vIdx);
    const sIdx = intlCode.indexOf('S={"zh-CN":');

    if (gStart < 0 || underscoreIdx < 0 || vIdx < 0 || yIdx < 0 || sIdx < 0) {
        console.error("[x] Estrutura de mensagens no IntlProvider 4.x não reconhecida.");
        process.exit(1);
    }

    const gObj = vm.runInNewContext("(" + intlCode.slice(gStart + 6, underscoreIdx) + ")");
    const enObj = vm.runInNewContext("(" + intlCode.slice(vIdx + 3, yIdx) + ")", { g: gObj });
    const ptCatalog = {};
    let translatedCount = 0;
    for (const k of Object.keys(enObj)) {
        const enVal = enObj[k];
        if (dict[k] !== undefined) {
            ptCatalog[k] = dict[k];
            translatedCount++;
        } else if (typeof enVal === "string" && dict[enVal] !== undefined) {
            ptCatalog[k] = dict[enVal];
            translatedCount++;
        } else {
            ptCatalog[k] = enVal;
        }
    }
    const sEndTarget = ',"ko-KR":{...v,...x}}';
    const sEndPos = intlCode.indexOf(sEndTarget, sIdx);
    if (sEndPos < 0) {
        console.error("[x] Ponto final do mapa S no IntlProvider não encontrado.");
        process.exit(1);
    }
    intlCode = intlCode.slice(0, sEndPos + sEndTarget.length - 1) + ',"pt-BR":' + JSON.stringify(ptCatalog) + '}' + intlCode.slice(sEndPos + sEndTarget.length);
    replacements.set("out/renderer/assets/" + intlFile, Buffer.from(intlCode, "utf8"));
    console.log(`    [OK] Catálogo pt-BR injetado (${translatedCount}/${Object.keys(enObj).length} chaves traduzidas).`);

    // 2. validation-*.js — registrar pt-BR no seletor de idiomas e resolução automática
    console.log(`[*] Habilitando 'Português (Brasil)' em: out/renderer/assets/${valFile}`);
    let valCode = getCleanFile("out/renderer/assets/" + valFile);
    valCode = valCode.replace(
        '[`zh-CN`,`en-US`,`ja-JP`,`ru-RU`,`ko-KR`]',
        '[`zh-CN`,`en-US`,`pt-BR`,`ja-JP`,`ru-RU`,`ko-KR`]'
    );
    valCode = valCode.replace(
        '"ko-KR":`한국어`}',
        '"ko-KR":`한국어`,"pt-BR":`Português (Brasil)`}'
    );
    valCode = valCode.replace(
        'case`ko`:return`ko-KR`;',
        'case`ko`:return`ko-KR`;case`pt`:return`pt-BR`;'
    );
    valCode = valCode.replace(
        'function bl(e){return e===`zh-CN`?`zh-CN`:`en-US`}',
        'function bl(e){return e===`pt-BR`?`pt-BR`:e===`zh-CN`?`zh-CN`:`en-US`}'
    );
    replacements.set("out/renderer/assets/" + valFile, Buffer.from(valCode, "utf8"));

    // 3. out/host/chunk-*.js — aceitar pt-BR no serviço de configurações
    console.log(`[*] Habilitando 'pt-BR' no host: out/host/${hostChunkFile}`);
    let hostCode = getCleanFile("out/host/" + hostChunkFile);
    hostCode = hostCode.replace(
        '["zh-CN","en-US","ja-JP","ru-RU","ko-KR"]',
        '["zh-CN","en-US","pt-BR","ja-JP","ru-RU","ko-KR"]'
    );
    hostCode = hostCode.replace(
        'function Mn(t){return t==="zh-CN"?"zh-CN":"en-US"}',
        'function Mn(t){return t==="pt-BR"?"pt-BR":t==="zh-CN"?"zh-CN":"en-US"}'
    );
    hostCode = hostCode.replace(
        'n!=="zh-CN"&&n!=="en-US"||r!==void 0&&r!=="system"&&r!=="zh-CN"&&r!=="en-US"',
        'n!=="zh-CN"&&n!=="en-US"&&n!=="pt-BR"||r!==void 0&&r!=="system"&&r!=="zh-CN"&&r!=="en-US"&&r!=="pt-BR"'
    );
    replacements.set("out/host/" + hostChunkFile, Buffer.from(hostCode, "utf8"));

    // 4. out/main/chunk-*.js — habilitar pt-BR e traduzir 100% dos menus nativos e bandeja
    console.log(`[*] Traduzindo menus nativos e bandeja em: out/main/${mainChunkFile}`);
    let menuChunk = getCleanFile("out/main/" + mainChunkFile);
    menuChunk = menuChunk.replace(
        '["zh-CN","en-US","ja-JP","ru-RU","ko-KR"]',
        '["zh-CN","en-US","pt-BR","ja-JP","ru-RU","ko-KR"]'
    );
    menuChunk = menuChunk.replace(
        'case"ko":return"ko-KR";',
        'case"ko":return"ko-KR";case"pt":return"pt-BR";'
    );
    menuChunk = menuChunk.replace(
        'function $t(t){return t==="zh-CN"?"zh-CN":"en-US"}',
        'function $t(t){return t==="pt-BR"?"pt-BR":t==="zh-CN"?"zh-CN":"en-US"}'
    );
    menuChunk = menuChunk.replace(
        'n!=="zh-CN"&&n!=="en-US"||r!==void 0&&r!=="system"&&r!=="zh-CN"&&r!=="en-US"',
        'n!=="zh-CN"&&n!=="en-US"&&n!=="pt-BR"||r!==void 0&&r!=="system"&&r!=="zh-CN"&&r!=="en-US"&&r!=="pt-BR"'
    );

    const ptMenus = {
        "titleBar.menu.file": "Arquivo",
        "titleBar.menu.edit": "Editar",
        "titleBar.menu.view": "Exibir",
        "titleBar.menu.window": "Janela",
        "titleBar.menu.help": "Ajuda",
        "titleBar.menu.file.newTask": "Nova tarefa",
        "titleBar.menu.file.openWorkspace": "Abrir espaço de trabalho",
        "titleBar.menu.file.closeWindow": "Fechar janela",
        "titleBar.menu.edit.undo": "Desfazer",
        "titleBar.menu.edit.redo": "Refazer",
        "titleBar.menu.edit.cut": "Recortar",
        "titleBar.menu.edit.copy": "Copiar",
        "titleBar.menu.edit.paste": "Colar",
        "titleBar.menu.edit.delete": "Excluir",
        "titleBar.menu.edit.selectAll": "Selecionar tudo",
        "titleBar.menu.view.toggleFullScreen": "Alternar tela cheia",
        "titleBar.menu.view.actualSize": "Tamanho real",
        "titleBar.menu.view.zoomIn": "Ampliar",
        "titleBar.menu.view.zoomOut": "Reduzir",
        "titleBar.menu.window.minimize": "Minimizar",
        "titleBar.menu.window.zoom": "Zoom",
        "titleBar.menu.window.bringAllToFront": "Trazer tudo para frente",
        "titleBar.menu.app.services": "Serviços",
        "titleBar.menu.app.hide": "Ocultar {appName}",
        "titleBar.menu.app.hideOthers": "Ocultar outros",
        "titleBar.menu.app.showAll": "Mostrar tudo",
        "titleBar.menu.app.quit": "Sair do {appName}",
        "titleBar.menu.help.about": "Sobre o ZCode",
        "titleBar.menu.help.whatsNew": "Novidades",
        "titleBar.menu.help.checkForUpdates": "Verificar atualizações",
        "titleBar.menu.help.toggleDevTools": "Alternar ferramentas de desenvolvedor",
        "titleBar.menu.help.resourceManager": "Gerenciador de recursos",
        "titleBar.menu.help.toggleZCodeStdioTap": "Capturar comunicação stdio do Agent",
        "titleBar.menu.help.zcodeEndpoint": "Endpoint do ZCode",
        "titleBar.menu.help.zcodeEndpoint.production": "Produção (padrão)",
        "titleBar.menu.help.zcodeEndpoint.test": "Teste",
        "titleBar.menu.help.zcodeEndpoint.custom": "Personalizado...",
        "titleBar.menu.help.zcodeEndpoint.reset": "Restaurar padrão",
        "titleBar.menu.help.feedback": "Enviar feedback",
        "titleBar.menu.help.exportLogs": "Exportar logs",
        "titleBar.menu.help.clearAllData": "Limpar todos os dados",
        "desktopMenu.help.checkingForUpdates": "Verificando atualizações...",
        "desktopMenu.help.updateAvailableVersion": "Nova versão {version} disponível",
        "desktopMenu.help.downloadingUpdateVersion": "Baixando atualização {version}...",
        "desktopMenu.help.downloadingUpdateProgress": "Baixando atualização... {progress}",
        "desktopMenu.help.restartToUpdate": "Reiniciar para atualizar ({version})",
        "dock.menu.showCurrentWindow": "Mostrar janela atual",
        "tray.tooltip": "ZCode",
        "tray.menu.openZCode": "Abrir ZCode",
        "tray.menu.quit": "Sair"
    };
    const menuEndMarker = '"tray.menu.quit":"Quit"}};function ';
    if (menuChunk.includes(menuEndMarker)) {
        menuChunk = menuChunk.replace(
            menuEndMarker,
            '"tray.menu.quit":"Quit"},"pt-BR":' + JSON.stringify(ptMenus) + '};function '
        );
    }
    replacements.set("out/main/" + mainChunkFile, Buffer.from(menuChunk, "utf8"));

    // 5. out/main/index.js — Diálogo Sobre + Créditos PT-BR + textos do sistema
    console.log("[*] Aplicando tradução e créditos em: out/main/index.js");
    let mainCode = getCleanFile("out/main/index.js");
    const copyHtmlTarget = '<div>${eo(e.copyright)}</div>';
    if (mainCode.includes(copyHtmlTarget) && !mainCode.includes(aboutCredit)) {
        mainCode = mainCode.replace(
            copyHtmlTarget,
            `${copyHtmlTarget}<div style="margin-top:6px;font-size:12px;font-weight:400;color:#00adb5;letter-spacing:0.02em;text-align:left;">${aboutCredit}</div>`
        );
        mainCode = mainCode.replace('GH=312', 'GH=345');
    }
    const aboutKhEnd = 'copyright:i(e=>`Copyright \\xA9 ${e} ZCode.`,"copyright")}};';
    if (mainCode.includes(aboutKhEnd)) {
        mainCode = mainCode.replace(
            aboutKhEnd,
            'copyright:i(e=>`Copyright \\xA9 ${e} ZCode.`,"copyright")},"pt-BR":{aboutTitle:"Sobre o ZCode",versionLabel:"versão",okButtonLabel:"OK",optimizedForAppleSilicon:"Otimizado para Apple Silicon.",copyright:i(e=>`Copyright \\xA9 ${e} ZCode.`,"copyright")}};'
        );
    }
    mainCode = mainCode.replace(
        'function xm(e){return KH[Ot(e)]}',
        'function xm(e){return KH[e==="pt-BR"?"pt-BR":Ot(e)]}'
    );
    mainCode = mainCode.replace(
        'function SA(e){return e==="zh-CN"?{text:"ZCode \\u6B63\\u5728\\u64CD\\u4F5C\\u7535\\u8111",width:234}:{text:"ZCode is controlling your computer",width:308}}',
        'function SA(e){return e==="zh-CN"?{text:"ZCode \\u6B63\\u5728\\u64CD\\u4F5C\\u7535\\u8111",width:234}:e==="pt-BR"?{text:"ZCode está controlando seu computador",width:328}:{text:"ZCode is controlling your computer",width:308}}'
    );
    replacements.set("out/main/index.js", Buffer.from(mainCode, "utf8"));

    // 6. out/preload/index.cjs — tradutor DOM leve para marketplace dinâmico e crédito PT-BR
    let preloadCode = getCleanFile("out/preload/index.cjs");
    if (preloadCode) {
        const helperSnippet = `
;(function(){
  if (typeof window === "undefined" || window.__zcodePtbrDomInstalled) return;
  window.__zcodePtbrDomInstalled = true;
  const _mkt = ${JSON.stringify(marketplaceDomTranslations)};
  const _credit = ${JSON.stringify(aboutCredit)};
  function _scan(root) {
    if (!root || typeof document === "undefined") return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue && n.nodeValue.trim();
      if (!t) continue;
      if (_mkt[t] && n.nodeValue !== _mkt[t]) n.nodeValue = _mkt[t];
    }
  }
  window.addEventListener("DOMContentLoaded", () => {
    try {
      if (window.localStorage && window.localStorage.getItem("zcode-ptbr-init") !== "1") {
        window.localStorage.setItem("zcode-locale-preference", "pt-BR");
        window.localStorage.setItem("zcode-locale", "pt-BR");
        window.localStorage.setItem("zcode-ptbr-init", "1");
      }
      const obs = new MutationObserver(() => _scan(document.body));
      if (document.body) { _scan(document.body); obs.observe(document.body, { childList: true, subtree: true }); }
    } catch {}
  });
})();
`;
        preloadCode = preloadCode + helperSnippet;
        replacements.set("out/preload/index.cjs", Buffer.from(preloadCode, "utf8"));
    }

    // 7. Reconstruir app.asar a partir da base limpa preservando estrutura e hashes SHA-256
    function walkFiles(node, prefix, list) {
        for (const [k, v] of Object.entries(node.files || {})) {
            const rel = prefix ? prefix + "/" + k : k;
            if (v.files) walkFiles(v, rel, list);
            else list.push({ path: rel, entry: v });
        }
    }
    const allFiles = [];
    walkFiles(cleanHeader, "", allFiles);

    const newHeader = { files: {} };
    function setDeep(root, parts, leaf) {
        let cur = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!cur.files[p]) cur.files[p] = { files: {} };
            cur = cur.files[p];
        }
        cur.files[parts[parts.length - 1]] = leaf;
    }

    let currentOffset = 0;
    const filesToWrite = [];
    for (const item of allFiles) {
        const parts = item.path.split("/");
        if (replacements.has(item.path)) {
            const buf = replacements.get(item.path);
            const size = buf.length;
            const offset = currentOffset.toString();
            const integrity = computeIntegrity(buf);
            setDeep(newHeader, parts, { size, offset, integrity });
            filesToWrite.push({ type: "buffer", buffer: buf, size });
            currentOffset += size;
        } else if (item.entry.unpacked || item.entry.offset === undefined) {
            setDeep(newHeader, parts, item.entry);
        } else {
            const size = item.entry.size;
            const srcOffset = cleanBaseOffset + parseInt(item.entry.offset, 10);
            const offset = currentOffset.toString();
            const leaf = { size, offset };
            if (item.entry.integrity) leaf.integrity = item.entry.integrity;
            setDeep(newHeader, parts, leaf);
            filesToWrite.push({ type: "copy", srcOffset, size });
            currentOffset += size;
        }
    }

    const newJsonBuf = Buffer.from(JSON.stringify(newHeader), "utf8");
    const newJsonSize = newJsonBuf.length;
    const padding = (4 - (newJsonSize % 4)) % 4;
    const headerSize = newJsonSize + padding;
    const prefixBuf = Buffer.alloc(16);
    prefixBuf.writeUInt32LE(4, 0);
    prefixBuf.writeUInt32LE(headerSize + 8, 4);
    prefixBuf.writeUInt32LE(headerSize + 4, 8);
    prefixBuf.writeUInt32LE(newJsonSize, 12);

    console.log("[*] Gerando novo app.asar traduzido para ZCode 4.x...");
    const outFd = fs.openSync(tempAsar, "w");
    fs.writeSync(outFd, prefixBuf, 0, 16);
    fs.writeSync(outFd, newJsonBuf, 0, newJsonSize);
    if (padding > 0) fs.writeSync(outFd, Buffer.alloc(padding));

    const CHUNK_SIZE = 4 * 1024 * 1024;
    const copyBuf = Buffer.alloc(CHUNK_SIZE);
    for (const f of filesToWrite) {
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

    try { fs.copyFileSync(tempAsar, path.join(scriptDir, "app-pt.asar")); } catch {}
    fs.copyFileSync(tempAsar, srcAsar);
    try { fs.unlinkSync(tempAsar); } catch {}

    const userConfigPaths = [
        path.join(process.env.USERPROFILE || "", ".zcode", "v2", "setting.json"),
        path.join(process.env.USERPROFILE || "", ".zcode", "setting.json")
    ];
    for (const uPath of userConfigPaths) {
        if (fs.existsSync(uPath)) {
            try {
                const uCfg = JSON.parse(fs.readFileSync(uPath, "utf8").replace(/^\uFEFF/, ""));
                uCfg.locale = "pt-BR";
                uCfg.uiLocale = "pt-BR";
                uCfg.localePreference = "pt-BR";
                uCfg.uiLocalePreference = "pt-BR";
                fs.writeFileSync(uPath, JSON.stringify(uCfg, null, 2), "utf8");
                console.log(`    [OK] Configuração atualizada para 'pt-BR' em: ${uPath}`);
            } catch {}
        }
    }

    console.log("====================================================================");
    console.log(` [OK] SUCESSO! ZCode ${currentVersion} atualizado e traduzido para PT-BR!`);
    console.log("====================================================================");
};
