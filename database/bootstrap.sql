-- ============================================================
-- WAY SERVIDORES - criação do banco e usuário (rodar como superusuário)
-- ============================================================

CREATE ROLE way WITH LOGIN PASSWORD 'senha-segura';
CREATE DATABASE way_servidores OWNER way;
GRANT ALL PRIVILEGES ON DATABASE way_servidores TO way;