-- ============================================================
-- WAY SERVIDORES - dados opcionais de exemplo
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('panel_name', 'Way Servidores'),
  ('default_motd', 'Bem-vindo ao meu servidor!'),
  ('adsense_enabled', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;