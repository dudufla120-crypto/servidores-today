# WAY SERVIDORES - README DO MÓDULO

Gerencia o ciclo de vida dos servidores Minecraft:

- `src/engines.ts` – versões disponíveis por motor + verificação de compatibilidade (Minecraft × Paper/Spigot/Purpur/Fabric/Forge/NeoForge) usando as APIs oficiais.
- `src/mojang.ts` – leitura do manifest oficial da Mojang (piston-meta).
- `src/install.ts` – criação do diretório do servidor, eula.txt, server.properties, download do jar correto e script de início.
- `src/process.ts` – start/stop/restart dos processos Java com pid-file e logs.
- `src/http.ts` – cliente HTTP com timeout para as APIs externas.

> Os arquivos dos servidores (mundos, plugins, mods, logs) vivem na VM em `SERVERS_DIR` — nunca no GitHub.