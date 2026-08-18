# Way Servidores

Painel web para criar e gerenciar **servidores Minecraft** com **múltiplas versões** e **múltiplos motores**: Vanilla, Paper, Spigot, Purpur, Fabric, Forge e NeoForge.

Na criação do servidor, o usuário escolhe a versão do Minecraft através do seletor **[ Escolher versão ]**, que oferece duas opções:

- **Versão específica** — lista as versões estáveis disponíveis.
- **Todas as versões** — acesso à biblioteca completa de versões compatíveis com o motor escolhido (apenas **uma** versão é instalada por servidor; não são instaladas todas juntas).

A lista de versões é atualizada **automaticamente** via APIs oficiais (Mojang, PaperMC, Purpur, Fabric, Forge e NeoForge) e o sistema verifica a combinação **Minecraft + versão + motor** antes de criar qualquer servidor, bloqueando combinações incompatíveis. Exemplo do seletor:

```
[Motor: ● Paper]        [Versão do Minecraft]
                        [ Escolher versão ▾ ]
                        ○ Versão específica     (releases estáveis)
                        ○ Todas as versões      (biblioteca completa)
                        1.21.8, 1.21.7, ..., 1.8.9, snapshots...
```

---

## Arquitetura

```
way-servidores/
├── frontend/          Painel web (React + Vite + Tailwind)
├── backend/           API (Express + PostgreSQL)
├── api/               Tipos e contratos compartilhados / endpoints
├── components/        Componentes React reutilizáveis (VersionPicker, ...)
├── pages/             Telas do painel (Dashboard, Criar servidor)
├── server-manager/    Instalação/ciclo de vida dos servers (jars, eula, processos)
├── plugin-manager/    Busca/instalação de plugins
├── mod-manager/       Busca/instalação de mods
├── file-manager/      Acesso aos arquivos nas VMs (local ou SSH/SFTP)
├── workers/           Workers em background (atualização da biblioteca de versões)
├── database/          Migrações SQL + cache de versões
├── docker/            Dockerfiles, nginx e docker-compose
├── public/            Estáticos (robots.txt, favicon)
├── scripts/           Setup e backup
├── .github/workflows/ CI + Deploy (GitHub Actions)
├── .env.example       Variáveis de exemplo (nunca comite o .env)
├── package.json       Workspaces npm + scripts
├── LICENSE            MIT
└── README.md
```

Fluxo do seletor de versões:

```
Frontend (VersionPicker)
   │  GET /api/versions/:engine
   ▼
Backend (Express)
   │  lê database/cache/versions.json
   ▼
Worker (atualiza a cada 6h)
   │  Mojang (piston-meta) ── todas as versões do Minecraft
   │  PaperMC ── versões do Paper
   │  Purpur ── versões do Purpur
   │  FabricMeta ── versões suportadas pelo Fabric
   │  Forge promotions_slim ── versões com Forge
   │  NeoForge maven-metadata ── versões com NeoForge
   ▼
POST /api/servers → verificação final de compatibilidade → instalação na VM
```

> **IMPORTANTE:** o GitHub armazena **apenas o código-fonte**. Mundos, plugins, mods, logs e arquivos dos usuários vivem **nas VMs/servidores de hospedagem** (em `SERVERS_DIR`), nunca no repositório.

---

## 1. Requisitos

- Node.js **20+**
- PostgreSQL **16+** (ou Docker)
- Java **21** (JRE) nas VMs que rodarão os servidores Minecraft
- Git

---

## 2. Instalação

```bash
git clone https://github.com/SEU-USUARIO/way-servidores.git
cd way-servidores

# Windows:
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Linux/macOS:
bash scripts/setup.sh
```

O script cria o arquivo `.env` a partir de `.env.example` e instala as dependências.

### Executar localmente

```bash
# Terminal 1 — API (no servidor)
npm run dev:backend

# Terminal 2 — Worker (atualiza a biblioteca de versões)
npm run dev:worker

# Terminal 3 — Painel
npm run dev:frontend
```

Ou, em um único comando: `npm run dev` (backend + frontend juntos).

Acesse:

- Painel: <http://localhost:5173>
- API: <http://localhost:4000/api/health>

A API exige autenticação via header `Authorization: Bearer <API_KEY>` (configurado no `.env`). As rotas `/health` e `/engines` são públicas.

---

## 3. Configuração (`.env`)

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta da API (padrão 4000) |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `API_KEY` | Chave que o painel usa para falar com a API |
| `API_PUBLIC_MODE` | `true` apenas em desenvolvimento (libera a API sem chave) |
| `JWT_SECRET` | Segredo para sessões (futuro login) |
| `SERVERS_DIR` | Diretório na **VM** onde os servers são criados (padrão `/var/way/servidores`) |
| `BACKUPS_DIR` | Diretório de backups |
| `SERVER_DEFAULT_PORT_RANGE` | Faixa de portas para os servers (ex.: `25565-25665`) |
| `UPDATE_INTERVAL_MS` | Intervalo do worker de atualização de versões |
| `CURSEFORGE_API_KEY` | Opcional — para busca de mods na CurseForge |
| `FILE_SSH_*` | Credenciais SSH para o file-manager (se o painel não roda na mesma VM) |
| `PANEL_DOMAIN` / `SERVER_WILDCARD_DOMAIN` | Domínios do painel e dos servers |
| `GOOGLE_ADSENSE_CLIENT_ID` | ID do AdSense (`ca-pub-...`) |

**Segredos nunca em código.** Produção usa GitHub Secrets / variáveis de ambiente do provedor.

---

## 4. Banco de dados

1. Crie o role e o banco (rodar como superusuário Postgres):

```bash
psql -U postgres -f database/bootstrap.sql
```

2. Aplique as migrações:

```bash
psql -U way -d way_servidores -f database/migrations/001_init.sql
psql -U way -d way_servidores -f database/seed.sql
```

3. Ou use o Postgres do `docker-compose` (as migrações rodam sozinhas no primeiro boot):

```bash
docker compose -f docker/docker-compose.yml up -d db
```

Tabelas: `users`, `servers`, `installed_plugins`, `installed_mods`, `domains`, `settings`.

---

## 5. Configurar as VMs (hospedagem dos servidores Minecraft)

Cada servidor Minecraft roda em uma **VM/servidor de hospedagem** (onde ficam os dados dos usuários).

1. Instale Java 21 na VM: `sudo apt install openjdk-21-jre-headless`.
2. Defina `SERVERS_DIR=/var/way/servidores` (e crie o diretório com permissão do usuário `way`).
3. Garanta que as portas da faixa configurada estejam liberadas no firewall: `sudo ufw allow 25565:25665/tcp`.
4. Se o painel **não** roda na mesma VM, preencha `FILE_SSH_HOST/USER/PRIVATE_KEY` para o file-manager acessar os arquivos via SFTP.
5. Rode o backup agendado **na VM** (cron):

```cron
0 3 * * * /opt/way/scripts/backup.sh >> /var/log/way-backup.log 2>&1
```

6. (Opcional, recomendado) Instale o [Watchtower](https://containrrr.dev/watchtower/) na VM para atualizar armadilhas/imagens automaticamente.

> Os arquivos dos servidores **nunca** são enviados ao GitHub — o repositório contém apenas código.

---

## 6. Configurar as APIs

### APIs externas usadas (todas oficiais/confiáveis, sem chave)

| Fonte | Uso |
| --- | --- |
| `https://piston-meta.mojang.com/...` | Manifest oficial do Minecraft (todas as versões) |
| `https://fill.papermc.io/v3` | Versões e builds do Paper (serviço oficial "Fill") |
| `https://api.purpurmc.org/v2/purpur` | Versões e builds do Purpur |
| `https://meta.fabricmc.net/v2` | Versões suportadas pelo Fabric |
| `https://files.minecraftforge.net/.../promotions_slim.json` | Versões com Forge |
| `https://maven.neoforged.net/.../maven-metadata.xml` | Versões com NeoForge |
| `https://api.modrinth.com` / `https://hangar.papermc.io` / `https://api.spiget.org` | Busca de plugins |
| `https://api.curseforge.com` | Busca de mods (opcional, requer `CURSEFORGE_API_KEY`) |

As URLs podem ser sobrescritas por variáveis de ambiente (ex.: `PAPER_API_URL`), boas para testes com mock.

### API do próprio sistema (ver `api/README.md`)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/engines` | Motores disponíveis |
| GET | `/api/versions/:engine?all=` | Versões compatíveis com o motor |
| GET | `/api/compatibility?mcVersion=&engine=` | Verifica compatibilidade |
| POST | `/api/servers` | Cria servidor (com verificação de compatibilidade) |
| GET | `/api/servers` | Lista servidores |
| POST | `/api/servers/:id/start\|stop\|restart` | Controle do processo |
| DELETE | `/api/servers/:id` | Remove servidor e dados |
| GET | `/api/servers/:id/files` | Lista arquivos (local ou SSH) |
| GET | `/api/plugins/search?q=` + POST instalação | Plugins |
| GET | `/api/mods/search?q=` + POST instalação | Mods |

---

## 7. Sistema de plugins

- **Busca:** `plugin-manager/` consulta Modrinth, PaperMC Hangar e Spiget.
- **Instalação:** `POST /api/servers/:id/plugins` baixa o `.jar` para `plugins/` do servidor na VM.
- **Registro:** cada instalação é gravada em `installed_plugins` no banco.
- Reinicie o servidor após instalar (rota `restart`).

Hardening sugerido: whitelist de providers, revisão manual antes da instalação e scan de hash (SHA-256) dos jars baixados.

---

## 8. Sistema de mods

- **Busca:** `mod-manager/` consulta Modrinth e CurseForge (opcional, chave em `CURSEFORGE_API_KEY`).
- **Instalação:** `POST /api/servers/:id/mods` baixa para `mods/` do servidor.
- A compatibilidade de mods com o motor (Fabric vs Forge vs NeoForge) é validada pelo usuário/lista de versões antes da instalação; o manager registra tudo em `installed_mods`.

---

## 9. Configurar os domínios

Cada servidor pode ganhar um subdomínio próprio, ex.: `meuserver.servers.seudominio.com`.

1. Aponte `*.servers.seudominio.com` (wildcard DNS) para o IP da VM (ou use um proxy como Cloudflare).
2. Inclua a rota no proxy reverso da VM (Caddy/nginx). Exemplo com **Caddy**:

```
meuserver.servers.seudominio.com {
    reverse_proxy localhost:25565
}
```

3. O painel mapeia domínio → servidor na tabela `domains` do banco.
4. Para futuro multi-VM: registre as VMs no banco e o roteador (Caddy/Nginx) decide a VM pela porta/domínio.

---

## 10. Google AdSense

1. Nos `Settings` do painel, habilite `adsense_enabled` e set `GOOGLE_ADSENSE_CLIENT_ID=ca-pub-XXXX` no `.env`.
2. Adicione o script do AdSense no `<head>` do painel (veja `frontend/index.html` — bloco comentado).
3. Para cada slot, use componentes com o criativo responsivo e o formato correto; ex. no rodapé das páginas:

```html
<ins class="adsbygoogle" style="display:block"
     data-ad-client="ca-pub-XXXX" data-ad-slot="1234567890" data-ad-format="auto"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

4. Respeite as políticas do AdSense (anúncios não podem cobrir o logotipo/navegação, cada página limita os anúncios, páginas de "erro/sucesso" não exibem anúncios).

---

## 11. GitHub Actions

- **`.github/workflows/ci.yml`** — em todo push/PR para `main`: instala dependências (`npm ci`), typecheck, lint, testes e build.
- **`.github/workflows/deploy.yml`** — no push para `main`: builda e publica as imagens Docker no **GHCR** (`ghcr.io/<seu-user>/way-servidores/backend|frontend`) e dispara os Deploy Hooks do Render (opcional, via Secrets `RENDER_BACKEND_HOOK` / `RENDER_FRONTEND_HOOK`).

Para ativar o deploy automático em VPS própria: rode o Watchtower na VM apontando para a imagem `:latest` do GHCR, ou rode `docker compose pull && up -d`.

---

## 12. Deploy

Frontend e backend são **separados** para facilitar o deploy em qualquer provedor.

### Vercel / Cloudflare Pages (frontend)

```bash
npm run build -w frontend
# deploya frontend/dist
```

- Vercel: configure o build command `npm run build -w frontend`, output `frontend/dist`.
- Cloudflare Pages: idem. Adicione a variável `VITE_API_URL=https://api.seudominio.com/api`.
- No file-manager/env: `VITE_API_URL` aponta para a API pública; o proxy `/api` do `vite.config.ts` só vale em dev.

### Render / Railway (backend)

- Render Web Service: build `npm ci && npm run build -w backend`, start `npm run start -w backend` (ou use o Dockerfile). Adicione o Postgres como serviço e configure `DATABASE_URL`.
- Railway: use o Dockerfile do backend e provisione o Postgres; defina as variáveis no painel.

### Docker Compose (VPS / VM própria)

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

So-be com Postgres + backend + worker + nginx (frontend). O nginx serve o painel e proxeia `/api` para o backend.

### Lembretes de segurança

- Use `GitHub Secrets` / variáveis de ambiente — nunca senhas, tokens, chaves SSH, API keys ou credenciais no código.
- Somente `.env.example` (valores de exemplo) vai para o repositório; `.env` está no `.gitignore`.
- Docker: não rode containers como root; use volumes para os dados.

---

## 13. Testes

```bash
npm test            # vitest (unit: versões/compatibilidade)
npm run typecheck   # tsc --noEmit (backend + frontend)
npm run lint        # eslint
npm run build       # build backend + frontend
```

---

## 14. Contribuindo / Roadmap

Próximas etapas sugeridas:

- Autenticação completa (registro/login + JWT) reutilizando `users`.
- Painel de arquivos (upload de mundos, edição de `server.properties`).
- Monitoramento de uso (CPU/RAM) por servidor.
- Multi-VM com registro de nós e scheduler automático.
- Backups agendados pelo painel (ver `scripts/backup.sh`).
- Integração de pagamentos e planos.

Contribuições são bem-vindas. Abra issues e PRs normalmente.

## Licença

MIT — veja [LICENSE](LICENSE).