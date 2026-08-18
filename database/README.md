# WAY SERVIDORES - Banco de dados

- `bootstrap.sql` – cria o role `way` e o banco `way_servidores` (rodar como superusuário Postgres).
- `migrations/001_init.sql` – schema inicial (usuários, servidores, plugins, mods, domínios).
- `seed.sql` – configurações opcionais de exemplo.
- `cache/` – cache gerado automaticamente pelo worker (não versionar no Git).

## Aplicar

```bash
psql -U postgres -f database/bootstrap.sql
psql -U way -d way_servidores -f database/migrations/001_init.sql
psql -U way -d way_servidores -f database/seed.sql
```

Ou, com docker-compose (Postgres sobe sozinho e roda as migrações automaticamente no primeiro boot).