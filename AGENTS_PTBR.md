# AGENTS_PTBR.md — Diretrizes de manutenção do ZCode PT-BR

Mantenha o pacote de localização do ZCode para Windows e os atalhos de instalação e restauração em um clique.

## Aplicativo e backups

- `patch-zcode.cjs` lê o `resources/app.asar` instalado, detecta a versão e reconstrói a tradução a partir de um arquivo original limpo e verificado da mesma versão.
- O backup bruto imutável fica dentro da pasta instalada: `<pasta-do-ZCode>\_backups\<versão>\app.asar`. Nunca o substitua por um arquivo traduzido nem use o backup de outra versão.
- `_backups` é a única pasta de backup. Os instaladores e restauradores leem e gravam backups correspondentes à versão na raiz do programa instalado; a pasta do projeto mantém somente scripts, documentação e arquivos de tradução.
- Nunca use o `app-pt.asar` do repositório como backup original nem para substituir uma instalação mais recente.
- Se o ASAR instalado já estiver traduzido e não houver backup limpo da versão exata, interrompa antes de alterá-lo. Se o backup limpo existir, reconstrua a tradução a partir dele em cada execução.
- `Restaurar-Original.bat` restaura o backup bruto correspondente à versão. Preserve os atalhos de instalar e restaurar com um clique.
- `patch-plugins.cjs` e `patch-visual-judge.cjs` podem alterar arquivos de skills/plugins no perfil do usuário. Preserve cada original uma única vez na pasta de backup da versão com `tools/auxiliary-backup.cjs`; o restaurador só grava novamente dentro do perfil ZCode ou de `resources/glm` da instalação.

## Tradução e manutenção

- `pt_dictionary.json` é a fonte de traduções do patcher dinâmico. Preserve placeholders e identificadores técnicos.
- `tools/scan-untranslated.cjs [app.asar-ou-pasta-instalada] [limite]` procura valores em inglês no `IntlProvider` da versão escolhida. O relatório contém candidatos; confira o contexto, pois pode incluir textos técnicos/de ajuda e nomes de produtos.
- Atualize as variantes do README, `LEIA-ME.txt` e estas instruções quando o instalador, os backups ou as traduções mudarem.
- Preserve o fluxo atual de instalação em um clique e não altere a versão oficial do aplicativo.

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
