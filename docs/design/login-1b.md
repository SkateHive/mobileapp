# Handoff: Login Skatehive — direção 1b (full-bleed)

## Overview
Redesign da tela de login do app mobile Skatehive. E-mail passa a ser o método primário de login (fluxo e-mail → código OTP de 6 dígitos, sem senha e sem selo "beta"). O login Hive (username + posting key) vira opção avançada escondida; "Espectador" vira link discreto. Três estados: novo usuário, código OTP, conta salva.

## About the Design Files
Os arquivos desta pasta são **referências de design em HTML** — protótipos que mostram o visual e o comportamento pretendidos, não código de produção. A tarefa é **recriar essas telas no codebase existente do app** (React Native), usando os componentes, padrões e assets que o app já tem (fundo de colagem de vídeos, logo, avatares). Abra `Login Skatehive.dc.html` no navegador e olhe a fileira **1b**.

## Fidelity
**Alta fidelidade (hifi)** para layout, cores, tipografia e espaçamento dos controles. O fundo de colagem nos mocks é uma imagem estática extraída de screenshots — no app, use a colagem de vídeos real que já existe.

## Screens / Views

### 1. Novo usuário (estado padrão sem conta salva)
- **Purpose**: entrar ou criar conta com e-mail em um passo.
- **Layout**: coluna full-bleed sobre a colagem de vídeos. Logo centralizado ocupando o espaço flexível superior (~196px de largura, drop-shadow `0 10px 30px rgba(0,0,0,.85)`). Bloco de controles ancorado na base, padding `0 24px 30px`, gap 12px.
- **Scrim**: gradiente sobre a colagem: `linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.88) 72%, #000 100%)`. Opcional: overlay de scanlines `repeating-linear-gradient(0deg, rgba(0,0,0,.32) 0 2px, transparent 2px 4px)`.
- **Components** (de cima pra baixo no bloco):
  - Campo e-mail: pill (radius 999), bg `rgba(5,9,5,.85)`, borda `1px solid #3ddc3d`, padding `15px 22px`, placeholder `seu@email.com` em `#6f8a6f` 15px mono.
  - Botão primário "Continuar →": pill, bg `#3ddc3d`, texto `#041004` 16px bold, padding 15px, altura ≥44px. Pressed: `#5ce65c`.
  - Legenda: "Sem senha — código por e-mail", `#9fb59f` 12px, centralizada.
  - Rodapé (linha, gap 18px, centralizada): "Espectador" (`#3ddc3d` 12px, sublinhado) · "Login com Hive ›" (`#7a8f7a` 12px) — este abre a tela avançada atual (username + posting key + PIN/biometria).

### 2. Código OTP
- **Purpose**: confirmar o código de 6 dígitos enviado por e-mail.
- **Layout**: teclado numérico aberto; conteúdo no topo. Logo pequeno (72px) centralizado, com padding-top suficiente pra não colidir com a status bar (~62px). Abaixo, padding `18px 24px`, gap 14px.
- **Components**:
  - Título "Digite o código" — branco, 18px, bold, centralizado.
  - Subtítulo "enviado para b•••@gmail.com" — `#9fb59f` 12px; o e-mail mascarado em `#3ddc3d`.
  - 6 caixas de dígito: 42×52px, radius 999, bg `rgba(5,9,5,.85)`; preenchida: borda `#3ddc3d`, dígito `#3ddc3d` 20px bold; vazia: borda `#2c452c`. Gap 8px, centralizadas.
  - "Reenviar 0:42" — `#7a8f7a` 12px, contador em `#3ddc3d`; vira link ativo ao zerar.
- **Scrim**: mais fechado: `linear-gradient(180deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.85) 60%, #000 100%)`.

### 3. Conta salva
- **Purpose**: reentrada com um toque + biometria.
- **Layout**: logo centralizado no espaço flexível (~172px). Bloco na base, padding `0 24px 30px`, gap 12px, itens centralizados.
- **Components**:
  - Avatar 84×84px, círculo, borda `3px solid #3ddc3d`, glow `0 0 24px rgba(61,220,61,.45)`.
  - "@username" — branco, 19px, bold.
  - Botão primário "Entrar com Face ID" (ícone scan-face à esquerda, stroke 2.75): pill, bg `#3ddc3d`, texto `#041004` 16px bold, largura total. Aciona biometria; fallback PIN.
  - "Trocar de conta" — `#cfe8cf` 13px, sublinhado, nowrap (leva à lista de contas / campo de e-mail).
  - Rodapé: "Espectador" · "Login com Hive ›" (iguais à tela 1).
- **Scrim**: `linear-gradient(180deg, rgba(0,0,0,.3) 0%, rgba(0,0,0,.2) 30%, rgba(0,0,0,.88) 70%, #000 100%)`.

## Interactions & Behavior
- "Continuar" habilita só com e-mail válido; loading no próprio botão (spinner, texto some).
- OTP: foco automático, avanço entre caixas, submit automático no 6º dígito; erro = borda vermelha + shake curto + limpa.
- Reenvio bloqueado por 60s com contador regressivo.
- Biometria dispara ao tocar o botão (não automaticamente ao abrir), com fallback pra PIN.
- Multi-conta: "Trocar de conta" abre lista de contas salvas + "Adicionar conta" (campo de e-mail). Excluir conta salva via long-press/swipe na lista — não deixar o ícone de lixeira solto na tela principal.
- Transições: fade/slide curto (~200ms ease-out) entre estados; colagem de vídeos continua animando ao fundo.

## State Management
- `savedAccounts[]` (username, e-mail mascarado, avatar, método: biometria/PIN) — persistido.
- `authStep`: `idle | emailSent | verifying | error`.
- `resendCooldown` (segundos), `otpValue`.
- Spectator: sessão somente-leitura, sem credenciais.

## Design Tokens
- Verde neon (marca): `#3ddc3d` · pressed `#5ce65c`
- Texto sobre verde: `#041004`
- Fundo base: `#050705` · superfícies: `rgba(5,9,5,.85)`
- Borda inativa: `#2c452c` · placeholder: `#6f8a6f`
- Texto primário: `#ffffff` · secundário: `#9fb59f` · terciário: `#7a8f7a` · claro: `#cfe8cf`
- Fonte: mono da marca (mocks usam Fira Code; use a mono que o app já carrega)
- Radius: 999 (pills) · alvo de toque mínimo 44px
- Ícones: Lucide, stroke-width 2.75

## Assets
- `assets/logo.png`, `assets/avatar.png`, `assets/collage*.png` — extraídos de screenshots do app, só pra visualizar o mock. No app, use os assets reais.

## Screenshots
- `screenshots/1b-row.png` — as 3 telas da direção 1b renderizadas (novo usuário, OTP, conta salva). Nota: no mock o teclado aparece QWERTY; no app use teclado **numérico** na tela de OTP.

## Files
- `Login Skatehive.dc.html` — board com as telas (fileira **1b** é a escolhida; 1a é uma alternativa descartada).
- `assets/` — imagens do mock.
- `screenshots/1b-row.png` — referência visual renderizada.
- `PROMPT.md` — prompt pronto pra colar no Claude Code.
