# WAY SERVIDORES

Este diretório contém os **tipos e contratos compartilhados** entre o
frontend e o backend (API pública do sistema).

- `types.ts` – tipos globais (`Engine`, `MinecraftVersion`, `ServerConfig`,
  `CompatibilityResult`, ...) usados por todos os módulos.

## Endpoints da API pública

| Método | Rota                          | Descrição                                                            |
| ------ | ----------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/health`                 | Saúde do serviço                                                     |
| GET    | `/api/engines`                | Motores disponíveis (paper, spigot, purpur, fabric, forge, neoforge) |
| GET    | `/api/versions`               | Biblioteca completa de versões (cache atualizada pelo worker)        |
| GET    | `/api/versions/:engine`       | Versões compatíveis com o motor (`?all=true` inclui snapshots)       |
| GET    | `/api/compatibility`          | Verifica `mcVersion + motor` (`?mcVersion=1.21.8&engine=paper`)      |
| POST   | `/api/servers`                | Cria um servidor (instala o jar correto na VM)                      |
| GET    | `/api/servers`                | Lista servidores                                                     |
| GET    | `/api/servers/:id`            | Detalhes de um servidor                                              |
| POST   | `/api/servers/:id/start`      | Inicia o servidor                                                    |
| POST   | `/api/servers/:id/stop`       | Para o servidor                                                      |
| POST   | `/api/servers/:id/restart`    | Reinicia o servidor                                                  |
| GET    | `/api/servers/:id/files`      | Lista arquivos (local ou via SSH)                                    |
| GET    | `/api/plugins/search?q=`      | Busca plugins (Modrinth, Hangar, Spiget)                             |
| POST   | `/api/servers/:id/plugins`    | Instala um plugin no servidor                                        |
| GET    | `/api/mods/search?q=`         | Busca mods (Modrinth, CurseForge)                                    |
| POST   | `/api/servers/:id/mods`       | Instala um mod no servidor                                           |
| DELETE | `/api/servers/:id`            | Remove um servidor (apaga dados da VM)                               |

> Todas as rotas (exceto `/health`, `/engines`) exigem o header
> `Authorization: Bearer <API_KEY>`. Em desenvolvimento, defina
> `API_PUBLIC_MODE=true` no `.env` para liberar o acesso sem chave.