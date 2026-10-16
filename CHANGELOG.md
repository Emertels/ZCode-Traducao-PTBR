### Textos da página de Recompensas — ZCode 3.15.3 — 14/10/2026
- Traduzidos os rótulos que ainda apareciam em inglês na página de indicações: link, copiar link, compartilhar imagem, tarefas e nomes das recompensas.
- Adicionada tradução dinâmica para contadores de novos usuários indicados e metas semanais ou da campanha, incluindo valores numéricos variáveis.

### Recompensas e marketplace — ZCode 3.15.3 — 14/10/2026
- Corrigida a ponte da tela Recompensas: o contexto local aceita `pt-BR`, mas envia `en-US` ao conteúdo remoto, mantendo a localização visual feita pelo preload. O patch reconhece o serializador usado nesta compilação e interrompe a geração se não reconhecer a estrutura, em vez de deixar a tela de recompensas sem contexto.
- Ampliadas as traduções dinâmicas dos novos itens do marketplace vistos nas capturas: Showcase, Hyper3D Rodin, MCP App Dev, Disk Cleaner, Video2code, Video Agent Kit, Blender, Excalidraw, OpenPencil, Tripo 3D, Visualize e itens de finanças, incluindo nomes e descrições em inglês e chinês.
- O pacote precisa ser reinstalado com o ZCode fechado para carregar a correção; a instância atualmente aberta não é alterada por esta edição.

# Histórico de Alterações

### Seletor de idioma e detecção automática — ZCode 3.15.3 — 14/10/2026
- Corrigidos os seletores de idioma das Configurações Gerais e da barra lateral para exibir “Português (Brasil)” na compilação 3.15.3.
- Corrigidos os schemas centrais de preferências para aceitar e persistir `pt-BR`, preservando os catálogos originais de inglês e chinês.
- “Padrão do sistema” agora prioriza o locale `pt-*` do Windows antes do fallback `en-US` do serviço do ZCode.
- O instalador confirma que `locale` e `localePreference` foram gravados em `pt-BR`; se não conseguir, informa erro em vez de declarar sucesso.
- Gerado e inspecionado um ASAR temporário da versão 3.15.3. O aplicativo instalado não foi substituído nesta correção.

### Teste no ZCode 3.15.3 — 14/10/2026
- O usuário confirmou que testou o instalador e o restaurador; os dois reconhecem corretamente os estados traduzido e original e estão funcionando.


### Acentuação do instalador — ZCode — 14/10/2026
- Adicionado BOM UTF-8 a `aplicar-traducao.ps1`, que o Windows PowerShell 5.1 interpretava como ANSI, causando textos como `TRADUÃ‡ÃƒO`. Nenhum `chcp 65001` foi acrescentado aos lançadores.
- Corrigida a acentuação de duas mensagens de diagnóstico do patcher Node. Nenhuma string de interface foi alterada.

### Reconhecimento da tradução aplicada — ZCode — 13/10/2026
- Quando o ASAR já tem a marca PT-BR, o backup limpo da versão é válido e `locale`/`localePreference` já estão em `pt-BR`, o instalador agora informa que a tradução está aplicada e encerra sem reaplicar nem fechar o aplicativo.
- Se só a preferência estiver incompleta, o fluxo de reparo continua reconstruindo a partir do backup limpo. A restauração original permanece inalterada.

### Compatibilidade com ZCode 3.15.3 — 13/10/2026
- Atualizada a estrutura do diálogo “Sobre” para o catálogo e resolvedor `QS`/`bu` da versão 3.15.3. Foram adicionadas 7 strings em PT-BR: título, rótulo da versão, botão, otimização para Apple Silicon, direitos autorais, nome do aplicativo e crédito.
- Corrigidos os seletores do locale do sistema e da API de campanhas para os identificadores usados nessa versão; inglês e chinês permanecem disponíveis, e a API remota recebe `en-US` quando a interface está em PT-BR.
- A checagem de segunda execução agora reconhece o marcador PT-BR do diálogo “Sobre” junto ao preload. Corrigida também a leitura de `setting.json` com BOM UTF-8.
- A interface de recompensas continua localizada pelo preload; o esquema local dessa compilação agora aceita `pt-BR`. Nenhuma tradução do catálogo principal foi contada novamente nesta correção.

### Verificação da instalação atual — 13/10/2026
- Conferido o ZCode instalado no computador: permanece na versão 3.15.3. A varredura do catálogo IntlProvider mapeou 6.313 mensagens em inglês e encontrou 0 lacunas por ID ou texto.

### Console e consistência do pacote — 13/10/2026
- Lançadores CMD e scripts PowerShell foram configurados para UTF-8, preservando acentos e cedilhas.
- Esta revisão não adiciona strings à interface do ZCode.

## [Em desenvolvimento] — ZCode 3.15.3 (13/10/2026)

### Correção da busca de instalações — 13/10/2026
- Instalador e restaurador validam primeiro caminhos do processo, registro e locais conhecidos; só quando nenhum candidato válido contém ZCode.exe e `resources\app.asar` iniciam a busca profunda em unidades fixas e removíveis. A busca ignora pastas raiz do sistema e junctions, deduplica caminhos, mantém instalações distintas selecionáveis e não usa a barra sobreposta do PowerShell. Mantenha `Find-Installations.ps1` ao lado dos scripts.
- A busca mostra a unidade atual, o número de pastas verificadas e as candidatas encontradas; não segue junctions/reparse points para evitar ciclos. Por cobrir todo o volume, pode levar mais tempo em discos grandes ou externos.
- Esta correção altera apenas a localização: 0 novas strings de interface foram adicionadas nesta etapa.

### Busca em camadas sem barra sobreposta — 13/10/2026
- O instalador e o restaurador validam primeiro caminhos obtidos do processo, registro e locais conhecidos. Só se nenhum contiver `ZCode.exe` e `resources\app.asar` fazem busca profunda em unidades fixas/removíveis.
- A busca profunda ignora pastas de sistema na raiz e junctions, valida o executável junto com `resources\app.asar`, deduplica caminhos e mantém instalações distintas selecionáveis. O progresso aparece no título da janela; a barra `Write-Progress` foi removida.
- Esta melhoria altera a busca, não a interface: 0 novas strings.


- Corrigido o diálogo “Sobre” da versão 3.15.1, que continuava em chinês porque a compilação mudou o catálogo de `Jb` para `ZS`. O patch agora reconhece essa estrutura, usa PT-BR para locales não ingleses e traduz o nome do aplicativo, a versão, os direitos autorais e o botão; o inglês continua preservado.
- Corrigida a deduplicação do instalador e restaurador: caminhos encontrados por fontes diferentes são normalizados antes de aparecer no seletor; instalações em pastas distintas continuam selecionáveis.
- Busca automática ampliada para localizar `ZCode.exe` recursivamente em todas as unidades montadas, inclusive discos externos; cada resultado é validado por `resources\app.asar`.
- Traduzidas duas mensagens ainda visíveis na tela inicial do Composer — o placeholder “Plan, Build...” e a orientação sobre mensagens durante a execução — no mapa DOM do ZCode. A orientação cobre duas pontuações e o formato misto da captura (quatro padrões literais no total, contando o placeholder); esses textos não fazem parte da contagem de 225 novas chaves do `IntlProvider`.
- Corrigidos 5 textos de saída do patcher com acentos em “módulo”, “configurações”, “possível”, “injeção” e “código”; nenhuma nova string da interface foi adicionada nesta correção.
- Ajustado o patch de idioma para a estrutura `IntlProvider` do ZCode 3.15.1: o catálogo PT-BR é adicionado ao mapa de idiomas e a validação aceita `pt-BR`; o patcher deve abortar sem alterar o ASAR se a estrutura esperada não for localizada.

### Compatibilidade, localização e restauração
- Auditado o catálogo `IntlProvider` da versão ZCode 3.15.1.8093: 225 mensagens sem tradução foram adicionadas ao dicionário PT-BR; nova varredura: 0 mensagens sem tradução por ID ou texto (6312 mensagens em inglês mapeadas).
- Adicionadas traduções para grupos e tópicos de bots, permissões do navegador, câmera/microfone, fluxos de trabalho, subagentes, visualizações interativas, Highspeed, rede, plugins e configurações.
- O instalador e o restaurador verificam `ZCode.exe` e `resources\app.asar`, procurando cópias pelo processo, locais conhecidos, registro do Windows e busca recursiva em todas as unidades montadas, inclusive externas.
- Quando mais de uma cópia válida é encontrada, os dois scripts pedem que o usuário escolha a instalação. Caminhos informados manualmente são validados antes de qualquer alteração; Enter informa que o ZCode pode não estar instalado.
- A restauração continua usando o backup imutável correspondente à versão detectada. A detecção do caminho não substitui nem ignora a validação do backup.

## [1.1.0] - 2026-10-05

### Páginas de Planos e Recompensas
- Corrigida a detecção do idioma nos preloads: qualquer preferência explícita diferente de português (incluindo inglês e chinês) agora desativa a tradução PT-BR; o idioma do sistema só é consultado em modo automático ou sem preferência salva.
- Corrigida a tradução intermitente dos textos dinâmicos: os observadores agora tratam alterações de texto em nós existentes e traduzem somente valores exatos do mapa, sem percorrer novamente toda a interface.
- Incluídas traduções para os títulos "Reward tasks" e "Your referrals" e para outros rótulos da página de indicações.
- Corrigida a ponte de idioma da página de indicações: o contexto remoto aceita apenas `en-US` e `zh-CN`, então `pt-BR` é normalizado para `en-US` no conteúdo remoto enquanto o preload mantém os textos da interface em português. O usuário confirmou que a página de benefícios carrega.
- Ampliadas as traduções da página carregada: banner de campanha, aviso de status, cabeçalhos, estados vazios e histórico. Textos incorporados em imagens podem continuar no idioma original.
- Traduzido o estado vazio do histórico de recompensas: `No rewards yet` → `Nenhuma recompensa ainda`.
- Incluídos no mapa dinâmico os títulos `Automations`/`Automation` e `Workflows`/`Workflow`.
- Confirmadas no mapa PT-BR as descrições dos quatro modelos de automação exibidos na tela, incluindo “Summarize the events of the week every Friday” e a instrução completa de análise de erros do terminal; também são aceitas variantes sem ponto final.
- Revertida a tentativa de usar `document.documentElement.lang` como fonte prioritária: essa propriedade permanecia em inglês em algumas telas PT-BR e desligava as traduções dinâmicas dos atalhos e descrições. O patch voltou a usar a preferência do ZCode e, quando apropriado, o idioma do sistema.
- O usuário confirmou que as correções dos atalhos e descrições das outras telas estão funcionando; a regressão visual dos atalhos foi identificada nesta atualização e corrigida no código-fonte, aguardando nova instalação para confirmação.
- O atalho `Idle-time task` agora é reaplicado em atualizações de nós e atributos reutilizados pelo React (`title`, `aria-label` e `placeholder`).
- Traduzidas por completo as descrições das habilidades `pptx`, `skill-creator` e `xlsx`, usando as descrições integrais encontradas tanto nos pacotes instalados quanto no cache ZCode (versões de cache correspondentes).
- Corrigida a variante atual da descrição longa da habilidade `xlsx` (inclui a referência ao arquivo por nome ou caminho), que não correspondia à entrada anterior do mapa.
- Traduzidas as descrições em inglês dos cartões de due diligence de empresas e pesquisa de fundos/gestores no Marketplace financeiro.
- Corrigido o idioma do menu da bandeja: como o processo principal resolve o locale nativo apenas em inglês ou chinês, os rótulos chineses agora são traduzidos quando o ZCode está localizado em PT-BR; rótulos ingleses continuam originais para permitir a restauração do inglês.
- O instalador agora reaplica atualizações sobre uma instalação já traduzida, reconstruindo a partir do backup original limpo e validado da mesma versão.
- Corrigido o diálogo “Sobre o ZCode”: o processo principal agora usa os rótulos PT-BR no locale não inglês, incluindo versão, direitos autorais, botão e nome do aplicativo; o catálogo inglês permanece intacto.
- Corrigido o texto nativo de copyright no diálogo “Sobre”, que ignorava o catálogo localizado, e ampliado o schema de configurações para aceitar `pt-BR` em `locale` e `localePreference`, mantendo o português como idioma inicial após reiniciar.
- Corrigido o locale inicial do instalador: `locale` e `localePreference` agora são salvos no nível principal de `setting.json`, evitando que a preferência “Padrão do sistema” faça o ZCode iniciar em inglês.
- Fallback seguro de locale na API de campanhas de bônus, preservando integridade das consultas de benefícios e resgate.

### Idioma e Localização
- Corrigida a seleção de Inglês (English): o locale `en-US` preserva o catálogo original em inglês, e o dicionário da tradução é aplicado somente ao `pt-BR`. O catálogo chinês `zh-CN` também permanece disponível.
- Corrigidos os nomes de Português (Brasil) nos menus de idioma: as chaves `settings.locale.pt-BR` e `sidebar.settings.locale.pt-BR` agora possuem rótulos adequados nos catálogos PT-BR, inglês e chinês, sem expor identificadores internos.
- Corrigido o Padrão do sistema: quando o idioma informado pelo navegador do ZCode inicia com `pt`, tem prioridade sobre o fallback `en-US` do serviço nativo e resolve diretamente para `pt-BR`.
- Corrigida a substituição estática do rótulo do Explorador de Arquivos, garantindo que o nome original do aplicativo seja preservado quando em inglês.
- Limitada a tradução dinâmica das páginas internas de planos e recompensas à preferência `pt-BR`, prevenindo textos misturados quando outros idiomas estiverem selecionados.
- Auditoria do catálogo do ZCode 3.14.4 validada, com 100% dos IDs do catálogo principal traduzidos.
- Traduzidos os rótulos restantes de permissões de acesso e modelos de tarefas agendadas, incluindo horários e frequência.
- Corrigido o idioma em descrições de plugins e habilidades: o instalador não grava traduções em metadados locais e restaura campos alterados por versões anteriores do patch a partir do backup.
- Ampliada a tradução condicional do Marketplace para categorias Ferramentas de desenvolvimento, Utilitários, Produtividade e Finanças, descrições de plugins e cartões de fluxos salvos.
- Otimização do observador de interface (removido observador global de alterações de texto), eliminando qualquer risco de lentidão ou congelamento no Marketplace de Plugins.
- Validação ponta a ponta e auditoria sintática (`node --check`) de todos os módulos gerados do ASAR concluída com sucesso.

## [1.0.0] - 2026-10-04

### Lançamento Inicial
- Localização profunda e completa da interface do ZCode Desktop para Português do Brasil (PT-BR).
- Dicionário com mais de 7.600 expressões mapeadas cobrindo telas, botões, modais, subagentes e comandos.
- Patcher dinâmico automatizado com suporte a detecção de versão e backup modular por compilação.
- Scripts de instalação e restauração em um clique (`Instalar-Traducao.bat` e `Restaurar-Original.bat`).
- Tradução de todos os módulos de ecossistema: Uso do Navegador, Uso do Computador, Emulador Android, Simulador iOS e Habilidades de Documentos.
- Localização dos subagentes de IA: Uso Geral (General), Explorar (Explore) e Juiz (Judge).
### Menu da bandeja do sistema — ZCode 3.15.3 — 14/10/2026
- Completada a tradução do menu mostrado na captura: abrir o ZCode, nova tarefa, abrir espaço de trabalho, verificar atualizações, sobre o ZCode, exportar logs e sair. Adicionado o mapeamento chinês que faltava para “Exportar Logs”; os rótulos já mapeados foram conferidos no mesmo menu.

### Menu da bandeja do sistema — correção de compatibilidade — ZCode 3.15.3 — 14/10/2026
- Corrigida a tradução do menu de contexto da bandeja do Windows: a versão 3.15.3 usa `$t(e.getLocale(),a)` no módulo principal, enquanto o patcher antigo procurava outro formato; agora traduz os rótulos chineses para PT-BR e mantém o inglês quando o locale é inglês.
- Corrigida também a inserção do catálogo PT-BR no menu do sistema. O patcher localiza o catálogo e o resolvedor mesmo quando a compilação muda os nomes minificados; antes, a versão 3.15.3 usava `Ah`/`II`, mas o patch procurava `eh`/`ik` e deixava o menu em chinês sem acusar falha.
- O instalador agora interrompe a aplicação se não reconhecer o resolvedor ou o catálogo do menu, evitando declarar sucesso sem aplicar a tradução. Inglês e chinês continuam usando seus catálogos próprios.

## v1.3.0 — 16/10/2026

### Seletor de idioma e serviço de configurações
- Corrigida a validação do `settingService` no processo host. Antes, o renderizador permitia selecionar `pt-BR`, mas o host rejeitava o valor, devolvia as preferências padrão e regravava o idioma como chinês/sistema.
- O patcher agora inclui `pt-BR` nos schemas de `locale` e `localePreference`, localiza o chunk de configurações pela estrutura real do ZCode e interrompe a instalação se não encontrar exatamente o alvo esperado.
- A interface pode manter Português (Brasil) como idioma escolhido, e as configurações deixam de ser substituídas por `zh-CN`/`system` durante a leitura e gravação.

### Menu da bandeja do sistema
- O menu aberto pelo ícone ao lado do relógio agora consulta o idioma salvo nas configurações do ZCode. `pt-BR`, `en-US` e `zh-CN` exibem seus catálogos correspondentes, sem deixar os rótulos presos em português ao alternar para inglês ou chinês.
- “Exportar Logs” também tem mapeamento em português no menu de contexto.

### Compatibilidade e validação
- Preservados os catálogos originais de inglês e chinês e o seletor de Português (Brasil) nas Configurações Gerais e na barra lateral.
- Validada a geração do patch sobre uma cópia limpa do ZCode 3.15.3; os módulos gerados passaram pela verificação sintática do Node.js.

### Seletor PT-BR e serviço de configurações — ZCode 3.15.3 — 16/10/2026
- Corrigido o schema Zod no bundle do host que rejeitava `pt-BR` em `locale` e `localePreference`. O renderer mostrava a opção e gravava a seleção, mas o serviço host descartava esses campos e retornava ao idioma anterior/padrão.
- O patcher localiza o chunk de configurações pelo conteúdo, inclui Português (Brasil) nas duas enums e falha de forma explícita se a estrutura mudar ou não for única.
- O menu da bandeja do Windows agora consulta o idioma salvo no ZCode e usa os catálogos correspondentes para português, inglês ou chinês; o locale do Windows deixa de sobrepor a escolha do usuário.
