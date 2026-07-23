# Roblox AI Studio — Plán frontendu

Profesionální, produkčně připravený **frontend** SaaS aplikace. Žádný backend, databáze, AI logika ani Roblox skripty — pouze realistické placeholdery a mock data, jasně oddělené od budoucích integrací.

## Poznámka k technologiím
Projekt běží na **TanStack Start** (React 19 + TypeScript + Vite + Tailwind v4) — což plně splňuje požadavek React/TS/Vite/Tailwind a moderní komponentovou architekturu. Routing tedy řeším přes file-based routing TanStack Routeru (`src/routes/`) místo react-router-dom, ale chování i navigace odpovídají běžné SPA. Spuštění zůstává `npm install` + `npm run dev`.

## Design systém
- Tmavý futuristický režim jako výchozí, glassmorphism karty, jemné gradienty Blue → Purple → Cyan.
- Sémantické design tokeny v `src/styles.css` (oklch), žádné hardcoded barvy.
- Zaoblené rohy, čistá typografie (moderní sans-serif přes `<link>` v root route), jemné animace (fade/scale, hover glow).
- Plně responzivní (mobile-first), keyboard navigation, focus stavy.

## Stránky (routes)
```text
/                 Landing (hero, ukázka, výhody, jak funguje, FAQ, ceník placeholder, CTA, footer)
/login            Přihlášení (Google/GitHub placeholder, email, heslo, forgot password)
/register         Registrace (heslo + potvrzení, souhlas s podmínkami)
/forgot-password  Reset hesla (placeholder)
/dashboard        Sidebar + topbar, přehled projektů, rychlé akce, aktivita, statistiky
/projects         Grid projektů, vyhledávání, filtry, mazání, duplikace
/projects/new     Formulář nového projektu (name, type, description, genre, difficulty, players, audience, Generate)
/projects/$id     Detail s taby: Overview, Files, AI Chat, Agents, Logs, Settings, Export
/agents           AI agenti (Planner, Designer, Builder, Lua, GUI, QA, Security, Documentation) — status, progress, popis
/settings         Theme, Notifications, API Keys placeholder, Profile, Billing placeholder
```
Dashboard + vnitřní stránky používají sdílený **AppLayout** (sidebar + navbar). Landing/auth mají vlastní jednodušší layout.

## Architektura složek
```text
src/
  routes/        # stránky (TanStack file-based)
  components/
    ui/          # Button, Card, Modal, Toast, Dropdown, Tabs, Dialog, Tooltip,
                 # Loader, Input, Textarea, Badge, Avatar, Table, Pagination,
                 # Breadcrumb (shadcn základ rozšířený o vlastní)
    landing/     # sekce landing page
    dashboard/   # widgety, statistiky, aktivita
    projects/    # ProjectCard, ProjectGrid, filtry
    agents/      # AgentCard
    chat/        # ChatMessage, ChatInput
  layouts/       # AppLayout, AuthLayout
  contexts/      # AuthContext (mock), ThemeContext, ProjectsContext (mock store)
  hooks/         # useProjects, useAuth, useToast, useDebounce ...
  services/      # mockApi.ts (simulované async volání s delay) — budoucí API hranice
  utils/         # formátování, helpers
  types/         # Project, Agent, User, ChatMessage ...
  constants/     # agenti, game types, genres, nav items, mock data
  assets/        # generované obrázky (hero/ukázka aplikace)
```

## Klíčové komponenty
Znovupoužitelné UI: Button, Card, Sidebar, Navbar, Modal/Dialog, Toast (sonner), Dropdown, Tabs, Tooltip, Loader/Skeleton, Input, Textarea, Badge, Avatar, Table, Pagination, Breadcrumb. Většinu pokryje existující shadcn knihovna v `components/ui/`, doplním chybějící a vlastní wrappery.

## Mock data & stav (placeholdery pro budoucí backend)
- `AuthContext`: fake login/logout, uložení „uživatele" do localStorage, žádná reálná autentizace.
- `ProjectsContext` + `useProjects`: CRUD nad mock polem projektů (vytvoření, mazání, duplikace, vyhledávání, filtry) v paměti/localStorage.
- `services/mockApi.ts`: async funkce s umělým zpožděním → snadno nahraditelné reálným API.
- AI Chat & Agents: předpřipravené placeholder odpovědi a simulovaný progress.

## UX stavy
Skeleton loading, empty states (žádné projekty), error states, loading animace, toast notifikace, potvrzovací dialogy (mazání).

## Výkon
Lazy loading těžších route komponent (Project Detail, AI Chat), code-splitting přes router, optimalizované obrázky (generované WebP/JPG), fonty přes `<link>` preconnect.

## Připravenost na budoucí rozšíření
Hranice pro Backend API, Auth, AI generování, Roblox Export, Marketplace, Platby, Předplatné, kolaboraci a pluginy jsou izolované v `services/` a `contexts/`, takže pozdější napojení nevyžaduje přepis UI. V kódu komentářem označím „FUTURE INTEGRATION".

## Co plán NEdělá
Žádný backend, DB, reálná AI, ani Roblox skripty — vše jako čisté placeholdery.

Po schválení vygeneruji obrázky (hero, ukázka UI), nastavím design tokeny a postavím všechny stránky a komponenty propojené navigací.