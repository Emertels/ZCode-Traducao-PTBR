# Registro técnico da equipe

## 2026-10-05 — Ajustes de idioma e Marketplace

- As traduções dinâmicas podiam oscilar porque o observador tratava somente nós DOM recém-inseridos; React atualiza com frequência o texto de um nó já existente. O preload agora observa também eventos `characterData` e traduz apenas correspondências exatas conhecidas, mantendo o trabalho por evento limitado.
- Reproduzido o cenário do atalho “Idle-time task”: após Nova tarefa → Idle-time task, a interface podia voltar ao texto inglês até sair e reabrir a tela. O observer agora trata também alterações restritas nos atributos `title`, `aria-label` e `placeholder`, além das mudanças de texto já cobertas.
- A detecção de locale nos preloads caía no idioma do Windows para preferências não reconhecidas; com Windows em português, inglês explícito podia receber PT-BR. Agora toda preferência explícita não portuguesa desativa as traduções; somente modo automático ou ausência de preferência usa o idioma do sistema.
- Incluídos rótulos da página de indicações que aparecem em inglês (“Reward tasks”, “Your referrals” e outros). Isso cobre o texto depois de carregado, mas não corrige por si só a falha de carregamento dos benefícios.
- Diagnóstico da falha de “Indique um amigo”: o bundle de integração mantinha um schema estrito de locale limitado a `en-US` e `zh-CN`, apesar de o ZCode poder estar em `pt-BR`. A ponte agora aceita `pt-BR` e envia `en-US` no contexto entregue à página remota, enquanto o preload traduz o conteúdo apresentado. O bundle transformado passou em `node --check`; a confirmação funcional dos benefícios ainda depende de abrir a página autenticada no ZCode.
- Depois que o usuário confirmou a abertura da página, restavam rótulos em inglês no banner e nas tabelas. Foram incluídos textos do título (inclusive trechos separados pelo DOM), aviso de status da campanha, cabeçalhos, estados vazios e histórico. Como o usuário instalou uma versão anterior e ainda viu esses itens em inglês, validar esta atualização de mapa após a próxima instalação.

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
