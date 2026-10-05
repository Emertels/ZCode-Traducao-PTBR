# Registro técnico da equipe

## 2026-10-05 — Ajustes de idioma e Marketplace

- As traduções dinâmicas podiam oscilar porque o observador tratava somente nós DOM recém-inseridos; React atualiza com frequência o texto de um nó já existente. O preload agora observa também eventos `characterData` e traduz apenas correspondências exatas conhecidas, mantendo o trabalho por evento limitado.
- Reproduzido o cenário do atalho “Idle-time task”: após Nova tarefa → Idle-time task, a interface podia voltar ao texto inglês até sair e reabrir a tela. O observer agora trata também alterações restritas nos atributos `title`, `aria-label` e `placeholder`, além das mudanças de texto já cobertas.
- A detecção de locale nos preloads caía no idioma do Windows para preferências não reconhecidas; com Windows em português, inglês explícito podia receber PT-BR. Agora toda preferência explícita não portuguesa desativa as traduções; somente modo automático ou ausência de preferência usa o idioma do sistema.
- Incluídos rótulos da página de indicações que apareciam em inglês. O usuário confirmou que os benefícios agora carregam.
- Diagnóstico da falha de “Indique um amigo”: o bundle de integração mantinha um schema de locale limitado a `en-US` e `zh-CN`, apesar de o ZCode poder estar em `pt-BR`. A ponte agora aceita `pt-BR` e envia `en-US` no contexto remoto, enquanto o preload traduz a interface.
- Depois da confirmação de carregamento, foram incluídos textos adicionais do banner (inclusive trechos separados pelo DOM), status da campanha, cabeçalhos, estados vazios e histórico. Textos rasterizados/embutidos na arte não são substituíveis pelo mapa DOM.
- O usuário detalhou a sequência Nova tarefa em PT-BR → Idle-time task → Automações → Nova tarefa em inglês → abrir projeto → Nova tarefa volta a PT-BR. A prioridade de `document.documentElement.lang` foi uma regressão: o atributo podia indicar inglês com interface PT-BR, desligando o mapa dinâmico dos atalhos e descrições. Essa prioridade foi removida; a detecção voltou à preferência do ZCode e ao fallback do sistema. Os títulos Automações/Fluxos de trabalho permanecem no mapa.
- Confirmadas as traduções dos quatro cartões de automação e das duas frases enviadas pelo usuário: “Summarize the events of the week every Friday” e “Please analyze the following terminal error log…”. Incluídas variantes sem ponto final para o texto dinâmico.
- Incluída a tradução do estado vazio `No rewards yet` na página de recompensas.
- Conferidas as descrições completas de `pptx`, `skill-creator` e `xlsx` nos pacotes instalados e no cache oficial local; as cópias correspondem ao texto dos cartões. As entradas completas agora precedem as traduções de prefixo no mapa dinâmico, para evitar cartões parcialmente traduzidos.

- Causa identificada para descrições que ficavam em português no ZCode em inglês: versões anteriores do instalador alteravam diretamente arquivos `SKILL.md`, arquivos `visual-judge.md` e catálogos JSON do Marketplace.
- O patch auxiliar agora consulta o `auxiliary-manifest.json` e o backup da versão para desfazer somente valores conhecidos que tenham sido escritos pelo tradutor. Os demais campos e alterações locais são preservados.
- O instalador deixa de executar o tradutor estático de `visual-judge.md`; também inclui o cache de plugins na verificação de possíveis alterações anteriores.
- O tradutor de interface ganhou descrições do Marketplace vistas nos prints, rótulos de categorias e textos de fluxos de trabalho salvos. A alteração é aplicada apenas quando o idioma ativo é pt-BR.
- Incluído o prompt longo do modelo de criação de apresentação sobre a evolução dos agentes de IA. Em áreas de conversa, o patch só altera correspondências exatas ou trechos explícitos do mapa; texto comum digitado pelo usuário permanece inalterado.
- A observação DOM fica limitada a elementos adicionados; observar alterações de texto em toda a página poderia sobrecarregar telas dinâmicas.
- Uma validação de geração encontrou aspas não escapadas no prompt duplicado no mapa de `styles` e, em seguida, uma chave ausente no callback do `preload`; ambos foram corrigidos. A geração limpa do ZCode 3.14.4 passou integralmente depois dos reparos.
- Logs de 2026-10-05 confirmaram `marketing-touch.query` rejeitando `pt-BR` com enum limitado a `zh-CN` e `en-US`. O patch agora mantém a interface `pt-BR`, permite o locale na validação local e envia `en-US` apenas no cabeçalho da API de campanhas, inclusive no fluxo de resgate.
- O Marketplace respondeu a `plugin-management.listPlugins` e `getPluginsOverview`; pouco depois o log marcou o renderizador como não responsivo. A observação global de `characterData` foi removida e o tradutor em áreas de conversa ficou limitado a correspondências exatas para evitar percorrer ou reprocessar todo o conteúdo.
- O usuário confirmou depois que o aplicativo deixou de travar ao abrir o Marketplace de Plugins. Isso confirma a correção do travamento no uso dele, mas não confirma por si só que a oferta de bônus aparece ou pode ser resgatada.

## Validação pendente

- Executar o instalador no ZCode com inglês e pt-BR para confirmar a restauração dos metadados e a tradução dos cartões em ambas as localidades.
- Validar no aplicativo que o Marketplace abre sem ficar carregando e que uma oferta de bônus é exibida e pode ser resgatada em pt-BR; os testes estáticos confirmam somente os pontos de injeção e a sintaxe.
- A cópia validada foi temporária e não substituiu `resources/app.asar` da instalação real; fazer o teste funcional no app depois de restaurar e instalar permanece pendente.
