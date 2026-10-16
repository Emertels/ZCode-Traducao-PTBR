# AGENTS_PTBR.md — Diretrizes de manutenção do ZCode PT-BR

Mantenha o pacote de localização do ZCode para Windows e os atalhos de instalação e restauração em um clique.

## Aplicativo e backups

- `patch-zcode.cjs` lê o `resources/app.asar` instalado, detecta a versão e reconstrói a tradução a partir de um arquivo original limpo e verificado da mesma versão.
- O backup bruto imutável fica dentro da pasta instalada: `<pasta-do-ZCode>\_backups\<versão>\app.asar`. Nunca o substitua por um arquivo traduzido nem use o backup de outra versão.
- `_backups` é a única pasta de backup. Os instaladores e restauradores leem e gravam backups correspondentes à versão na raiz do programa instalado; a pasta do projeto mantém somente scripts, documentação e arquivos de tradução.
- Nunca use o `app-pt.asar` do repositório como backup original nem para substituir uma instalação mais recente.
- Se o ASAR estiver traduzido, só informe que a instalação está concluída quando o backup limpo da versão exata e as preferências `locale`/`localePreference` em `pt-BR` forem confirmados; nesse caso, saia sem reaplicar nem fechar o ZCode. Se as preferências estiverem incompletas, reconstrua a tradução a partir do backup limpo. Se o backup não existir, interrompa sem alterar o ASAR.
- `Restaurar-Original.bat` restaura o backup bruto correspondente à versão. Preserve os atalhos de instalar e restaurar com um clique.
- `patch-plugins.cjs` e `patch-visual-judge.cjs` podem alterar arquivos de skills/plugins no perfil do usuário. Preserve cada original uma única vez na pasta de backup da versão com `tools/auxiliary-backup.cjs`; o restaurador só grava novamente dentro do perfil ZCode ou de `resources/glm` da instalação.

## Tradução e manutenção

- `pt_dictionary.json` é a fonte de traduções do patcher dinâmico. Preserve placeholders e identificadores técnicos.
- `tools/scan-untranslated.cjs [app.asar-ou-pasta-instalada] [limite]` procura valores em inglês no `IntlProvider` da versão escolhida. O relatório contém candidatos; confira o contexto, pois pode incluir textos técnicos/de ajuda e nomes de produtos.
- Atualize as variantes do README, `LEIA-ME.txt` e estas instruções quando o instalador, os backups ou as traduções mudarem.
- Preserve o fluxo atual de instalação em um clique e não altere a versão oficial do aplicativo.

<!-- zcode-3151-about-and-discovery -->
## Schema de idioma no host
- Para o seletor PT-BR funcionar, permitir `pt-BR` nas enums `locale` e `localePreference` do serviço de configurações em `out/host/chunk-*.js`, além do seletor e do IntlProvider do renderer. O host valida `setting.json`; se rejeitar o valor, volta aos padrões `zh-CN`/`system` mesmo que a interface tenha oferecido Português.
- O menu da bandeja é construído no processo principal; leia `localePreference` e `locale` de `~/.zcode/v2/setting.json` para resolver os rótulos. `app.getLocale()` sozinho retorna o locale do sistema e não acompanha a seleção dentro do ZCode.
- No `IntlProvider`, `settingsLocalePreference` do serviço deve prevalecer sobre `storedPreference` do `localStorage`; um valor antigo pode divergir do `setting.json` e fazer o seletor reabrir em inglês/chinês apesar de a preferência atual ser `pt-BR`.
- A detecção de estado do instalador só deve classificar o ASAR como completamente atualizado se o resolvedor do `IntlProvider` e os schemas do host aceitarem `pt-BR`; ASARs com patches antigos precisam ser reconstruídos do backup limpo.
## Compatibilidade do diálogo Sobre e busca de instalação
- O diálogo Sobre do ZCode 3.15.3 usa o mapa/resolvedor `QS`/`bu`; versões anteriores podem usar `ZS`/`hu` ou `Jb`/`gl`. Preserve os três fallbacks e os catálogos originais de inglês e chinês ao atualizar.
- O detector da segunda execução deve reconhecer a marca PT-BR do diálogo Sobre em conjunto com o preload. Com backup limpo válido e as duas preferências em `pt-BR`, a instalação repetida mostra que já está traduzido e sai sem reaplicar o pacote.
- Instalador e restaurador devem usar os mesmos critérios de descoberta, normalização e deduplicação. Valide ZCode.exe e resources\app.asar; não confunda aliases de maiúsculas/minúsculas com instalações diferentes.
- Instalador e restaurador validam primeiro caminhos do processo, registro e locais conhecidos; só quando nenhum candidato válido contém ZCode.exe e `resources\app.asar` iniciam a busca profunda em unidades fixas e removíveis. A busca ignora pastas raiz do sistema e junctions, valida também o arquivo-chave, deduplica caminhos, mantém instalações distintas selecionáveis e exibe o progresso no título da janela, nunca com `Write-Progress`. Mantenha `Find-Installations.ps1` ao lado dos scripts.
<!-- /zcode-3151-about-and-discovery -->

## Verificação

- Execute `node --check` nos arquivos JavaScript alterados e valide a sintaxe dos scripts PowerShell antes de entregar.
- Confirme que a versão do backup original corresponde ao `app.asar` instalado; nunca instale nem restaure um arquivo não verificado ou já traduzido.
- Não declare cobertura completa da tradução usando apenas a contagem de uma varredura.
## Reexecução e restauração
- Ao executar novamente, o instalador reconhece uma tradução completa e informa que não precisa reaplicá-la. Se estiver parcial, recompõe a tradução a partir do backup original limpo e exato da versão.
- O backup original é criado uma única vez em `<pasta instalada>\_backups\<versão>` e nunca é substituído pela tradução. Se uma instalação já modificada não tiver backup confiável, o instalador interrompe e informa isso.
- Na restauração, arquivos que já correspondem ao original são identificados e não são copiados novamente. Backup ausente ou inválido gera uma mensagem clara e impede uma restauração insegura.
- O crédito de localização é exibido como `Tradução PT-BR: Emerson Teles`, na cor turquesa `#00adb5`, no local de crédito disponível na interface.
### Mensagens do instalador e créditos
- Se já estiver traduzido, o instalador mostra uma mensagem ciano clara e não reaplica o pacote.
- Se já estiver original, a restauração avisa em ciano que não é necessária; uma restauração real termina com a confirmação verde de sucesso.
- No prompt final, S abre o aplicativo em processo independente e a janela do CMD iniciada pelo atalho fecha automaticamente; N, Enter ou Esc encerra sem abrir o aplicativo.
- Crédito: Tradução PT-BR: Emerson Teles, em turquesa #00adb5. O crédito fica no diálogo “Sobre”, abaixo dos direitos autorais.
### Restauração idempotente e arquivos auxiliares
Sem backup da versão, o restaurador só informa em azul-turquesa que a restauração é desnecessária depois que o verificador confirma que o `app.asar` ativo está limpo e corresponde à versão instalada. Cada arquivo auxiliar é restaurado isoladamente; caminhos incompatíveis, ausentes ou com destino inesperado são mantidos e exibidos em amarelo. Se algum item falhar, o resultado final informa restauração parcial, nunca sucesso completo.
## Backup original ausente
Se o backup original da versão não estiver em _backups, o restaurador não consegue reconstruir os arquivos de fábrica e deve informar que a restauração não é possível. Repare ou instale a versão oficial do aplicativo por cima da instalação existente, preservando os projetos e dados do perfil do usuário; depois execute novamente o instalador ou restaurador.
# Atualização de 16/10/2026 — ZCode 3.15.3
- O seletor rápido do perfil agora encaminha `pt-BR` ao serviço de configurações.
- O menu da bandeja relê `localePreference`/`locale` a cada abertura e reconstrói os rótulos em clique direito, para refletir mudanças entre PT-BR, inglês e chinês.
- A detecção de tradução completa exige os marcadores dos dois comportamentos para reinstalar builds incompletos com segurança a partir do backup limpo.
