# Histórico de Alterações

## [1.1.0] - 2026-10-05

### Páginas de Planos e Recompensas
- Corrigida a detecção do idioma nos preloads: qualquer preferência explícita diferente de português (incluindo inglês e chinês) agora desativa a tradução PT-BR; o idioma do sistema só é consultado em modo automático ou sem preferência salva.
- Corrigida a tradução intermitente dos textos dinâmicos: os observadores agora tratam alterações de texto em nós existentes e traduzem somente valores exatos do mapa, sem percorrer novamente toda a interface.
- Incluídas traduções para os títulos "Reward tasks" e "Your referrals" e para outros rótulos da página de indicações.
- Corrigida a ponte de idioma da página de indicações: o contexto remoto aceita apenas `en-US` e `zh-CN`, então `pt-BR` é normalizado para `en-US` no conteúdo remoto enquanto o preload mantém os textos da interface em português. O usuário confirmou que a página de benefícios carrega.
- Ampliadas as traduções da página carregada: banner de campanha, aviso de status, cabeçalhos, estados vazios e histórico. Textos incorporados em imagens podem continuar no idioma original.
- Corrigida a tradução dinâmica após navegar por Automações e voltar a Nova tarefa: o detetor considera o idioma renderizado no documento, e inclui os rótulos `Automations`/`Automation` e `Workflows`/`Workflow`.
- O atalho `Idle-time task` agora é reaplicado em atualizações de nós e atributos reutilizados pelo React (`title`, `aria-label` e `placeholder`).
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
