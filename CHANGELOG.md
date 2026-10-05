# Histórico de Alterações

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
