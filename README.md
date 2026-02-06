# TesteATD (React + Supabase)

Versão SPA (Create React App) do quiosque + admin, usando **Supabase (Auth + Postgres)**.

## Rotas

- `/` — Quiosque (submeter feedback)
- `/admin_rocha` — Login admin
- `/admin_rocha/dashboard` — Dashboard (protegido)
- `/admin_rocha/tv` — Modo TV (protegido)

## Configuração Supabase

1) Copie o ficheiro `.env.example` para `.env` e preencha:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

2) No Supabase:

- Authentication → ative **Email/Password** e crie utilizadores admin
- SQL Editor → execute o script [supabase.sql](supabase.sql)

Tabela usada: `feedback`.

## Acesso Admin (opcional)

Para limitar quem entra no admin, configure UM destes env vars:

- `REACT_APP_ADMIN_EMAILS` (lista separada por vírgulas)
- `REACT_APP_ADMIN_EMAIL_DOMAIN` (ex.: `minhaescola.pt`)

Se não configurar nenhum, qualquer utilizador autenticado no Supabase Auth consegue abrir o admin.

## Scripts

- `npm install`
- `npm start`
- `npm run build`
