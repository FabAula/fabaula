# Posada en marxa pas a pas

Temps aproximat: 1 hora la primera vegada. Tot es pot fer amb plans gratuïts.

Necessitaràs:

- un compte de **GitHub**;
- un compte de **Supabase** (pots entrar-hi amb GitHub);
- el teu compte de **Google**, per configurar l'inici de sessió;
- **Node 22**, només si vols provar l'app al teu ordinador.

Al llarg de la guia, substitueix aquests valors pels teus:

| Marcador | Exemple |
|---|---|
| `ORG` | nom de l'organització de GitHub, p. ex. `fabaula-app` |
| `REPO` | nom del repositori, p. ex. `fabaula` |
| `REF` | identificador del projecte de Supabase (surt a la URL: `https://REF.supabase.co`) |

---

## 1. GitHub: organització i repositori

1. Crea l'organització a <https://github.com/organizations/new> amb el pla **Free**.
2. Dins l'organització, crea el repositori `REPO`. Ha de ser **públic**, perquè GitHub Pages és gratuït per a organitzacions només amb repos públics.
   - El codi no conté cap secret. La clau *anon/publishable* de Supabase és pública per disseny: la seguretat la fan les polítiques RLS.
   - Si el vols privat, desplega'l a Cloudflare Pages, Netlify o Vercel en lloc de GitHub Pages.
3. Puja-hi el codi:

```bash
cd fabaula
git init -b main
git add .
git commit -m "FabAula: primera versió"
git remote add origin https://github.com/ORG/REPO.git
git push -u origin main
```

4. Decideix una llicència. Sense fitxer `LICENSE`, el codi és públic però no reutilitzable. Si vols que altres centres el puguin fer servir, posa-hi MIT o AGPL-3.0.

## 2. Supabase: crear el projecte

1. A <https://supabase.com/dashboard>, crea una **organització** (pla Free) i un **projecte nou**:
   - **Name**: `fabaula`
   - **Database password**: genera'n una i guarda-la al gestor de contrasenyes
   - **Region**: **Central EU (Frankfurt)** o **West EU (Paris)**. Les dades han de quedar a la UE.
2. Espera que el projecte acabi de crear-se (1-2 minuts).
3. Ves a **Project Settings → API** (o **API Keys**) i apunta't:
   - **Project URL**: `https://REF.supabase.co`
   - la clau **anon** o **publishable**. **Mai** la `service_role` ni la `secret`.

## 3. Crear la base de dades

**Opció A (la més fàcil)**

1. Ves a **SQL Editor → New query**.
2. Obre `supabase/all-in-one.sql`, copia'n tot el contingut, enganxa'l i prem **Run**. Ha d'acabar sense errors.
3. Comprova-ho a **Table Editor**: hi ha d'haver les taules `schools`, `machines`, `sessions`, etc., i a `schools` hi ha d'haver l'"Escola de demostració".

**Opció B (amb la CLI, recomanable per a canvis futurs)**

```bash
npx supabase login
npx supabase link --project-ref REF
npx supabase db push          # aplica supabase/migrations/ en ordre
```

> ⚠️ Fes servir només una de les dues opcions. Si has fet servir l'opció A i més endavant vols passar a la CLI, primer marca les migracions com a aplicades:
>
> ```bash
> npx supabase migration repair --status applied 20261116000001 20261116000002 20261116000003 20261116000004 20261116000005 20261116000006 20261116000007
> ```

## 4. Fes-te administrador de la plataforma

Al **SQL Editor**, executa això amb el correu del compte de Google amb què entraràs:

```sql
insert into public.platform_admins (email) values ('el-teu-correu@gmail.com');
```

El correu ha d'anar en minúscules. Com a admin de plataforma pots crear centres i assignar-ne els administradors, però **no veus les dades dels centres**. Si mai les necessites veure, l'admin del centre t'hi ha d'afegir com a membre.

## 5. Inici de sessió amb Google

### 5.1 Google Cloud Console

1. Ves a <https://console.cloud.google.com/> i crea un projecte nou (`FabAula`).
2. Configura la pantalla de consentiment a **Google Auth Platform**, o a **APIs & Services → OAuth consent screen** si et surt la interfície antiga:
   - **App name**: `FabAula`
   - **User support email**: el teu correu
   - **Audience**: **External**
   - **Scopes**: no n'afegeixis cap. N'hi ha prou amb els bàsics (`email`, `profile`, `openid`).
   - **Logo**: no en pugis cap. Amb logo, Google obliga a passar una verificació que pot trigar setmanes.
   - **Dominis autorizats**: `ORG.github.io` i `REF.supabase.co`, sense `https://`.
   - **Pàgina principal**: `https://ORG.github.io/`. Ha de ser una pàgina pública que expliqui l'app, no la pantalla de login: crea el repo `ORG.github.io` amb la pàgina de presentació.
   - **Política de privacitat**: `https://ORG.github.io/privacitat.html`
   - Verifica la propietat de `https://ORG.github.io/` a Google Search Console, amb la mateixa compta de Google que és propietària del projecte de Google Cloud.
   - **Correu de contacte del desenvolupador**: el teu.
   - Al final, **publica l'app** (*Publish app* → *In production*). Google no deixa publicar sense pàgina principal i política de privacitat, i aquestes URL han d'estar ja desplegades (pas 7). Mentrestant pots deixar-la en *Testing* i afegir-te com a usuari de prova. Amb només els scopes bàsics i sense logo, Google no demana cap verificació.
3. Ves a **Clients** (o **Credentials**) → **Create client** → **Web application**:
   - **Authorized JavaScript origins**: `https://ORG.github.io` i `http://localhost:5173`
   - **Authorized redirect URIs**: `https://REF.supabase.co/auth/v1/callback`
4. Copia el **Client ID** i el **Client secret**.

### 5.2 Supabase

1. Ves a **Authentication → Sign In / Providers → Google**, activa'l i enganxa-hi el Client ID i el Client secret.
2. Ves a **Authentication → URL Configuration**:
   - **Site URL**: `https://ORG.github.io/REPO/`
   - **Redirect URLs**: afegeix `https://ORG.github.io/REPO/**` i `http://localhost:5173/**`

> **Comptes de Google de centres educatius (p. ex. `@xtec.cat`)**: l'administrador del domini pot tenir bloquejades les apps de tercers. Si un docent no pot entrar amb Google, que faci servir l'opció **"Envia'm un enllaç d'accés"**, que funciona amb qualsevol correu.

## 6. Inici de sessió per correu (alternativa)

Ve activat per defecte (**Authentication → Sign In / Providers → Email**). El servei de correu que porta Supabase de sèrie té un límit molt baix d'enviaments per hora i només serveix per provar. Per a un claustre sencer:

1. Crea un compte gratuït en un servei SMTP com Brevo o Resend.
2. A **Authentication → Emails → SMTP Settings**, activa *Custom SMTP* i posa-hi les dades del servei.
3. Opcional: tradueix al català la plantilla **Magic Link** a **Authentication → Emails → Templates**.

## 7. Desplegar a GitHub Pages

1. Al repositori, ves a **Settings → Pages → Build and deployment → Source** i tria **GitHub Actions**.
2. A **Settings → Secrets and variables → Actions → pestanya Variables**, crea dues variables (*Variables*, no *Secrets*):
   - `VITE_SUPABASE_URL` = `https://REF.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la clau anon o publishable
3. Ves a **Actions → Test i desplegament → Run workflow**. Si no, simplement fes un push a `main`.
4. Quan acabi, l'app estarà a `https://ORG.github.io/REPO/`.

El workflow executa primer `npm run test:db`. Si algun test de seguretat falla, no es publica res.

El workflow **Keep-alive Supabase** fa una consulta cada 3 dies. Així el projecte gratuït no es pausa per inactivitat durant les vacances. Funciona sol amb les mateixes variables.

## 8. Primer ús real

1. Obre `https://ORG.github.io/REPO/` i entra amb Google.
2. Veuràs l'escola de demostració i l'enllaç **Administració de la plataforma**.
3. A la plataforma, crea el primer centre. Posa-hi el nom de l'escola i el correu de qui en serà l'admin (el compte de Google o el correu amb què entrarà).
4. Aquesta persona entra a l'app i:
   - a **Usuaris → Afegir molts de cop**, enganxa la llista de correus del claustre;
   - a **Mòduls**, desactiva el que no faci servir;
   - a **Llistes**, adapta els grups i les categories.
5. El gestor o l'admin dona d'alta els espais, les màquines, el material i els consumibles. A partir d'aquí, els docents ja poden registrar usos, préstecs, consum i incidències.

### Portar les dades de l'AppSheet

**Fotos:** un cop importades les dades, ves a **Administració → Importar fotos** i arrossega-hi les imatges de les carpetes `…_Images` de Google Drive. L'app les fa coincidir pel nom del fitxer, les comprimeix i les puja.

**Dades:**

Per a cada pestanya del full de càlcul de l'AppSheet:

1. Exporta-la com a CSV.
2. A Supabase, ves a **Table Editor → taula → Insert → Import data from CSV**.
3. Abans d'importar:
   - canvia les capçaleres pels noms de columna nous (estan a `supabase/migrations/20261116000002_domain.sql`);
   - afegeix-hi una columna `school_id` amb l'id del centre.

Si hi ha moltes dades, és millor fer un petit script d'importació.

## 9. Opcional: reiniciar la demo cada setmana

1. Ves a **Database → Extensions** i activa `pg_cron`.
2. Al SQL Editor, executa:

```sql
select cron.schedule('reset-demo', '0 3 * * 1', $$select public.reset_demo()$$);
```

Així la demo es reinicia cada dilluns a les 3:00 UTC. També la pots reiniciar a mà des de la pantalla **Plataforma**.

## 10. Treballar en local

```bash
cp .env.example .env      # posa-hi la URL i la clau anon
npm install
npm run dev               # http://localhost:5173
npm run test:db           # tests de la base de dades, sense Docker
```

## 11. Canvis a la base de dades

### Actualitzar una instal·lació que ja funciona

Si la base de dades ja estava creada abans d'una actualització, executa al SQL Editor **només les migracions noves**, en ordre. Per exemple, la `20261116000008_branding.sql` afegeix el color i el logotip de cada centre.

### Fer canvis nous

- **No editis mai una migració que ja s'hagi aplicat.** Crea'n una de nova, per exemple `supabase/migrations/20261201000001_camp_nou.sql`.
- Aplica-la amb `npx supabase db push`, o enganxa-la al SQL Editor.
- Afegeix-ne els tests a `supabase/tests/rls.test.mjs` i executa `npm run sql:bundle` perquè `all-in-one.sql` quedi al dia per a instal·lacions noves.

## 12. Abans d'obrir-ho a altres escoles

- **Protecció de dades.** Guardes noms i correus de docents. Respecte de cada centre ets **encarregat del tractament** (RGPD, art. 28). Amb centres públics normalment cal:
  - un contracte d'encàrrec de tractament amb cada centre o amb el Departament;
  - el DPA (acord de tractament de dades) de Supabase, que es pot sol·licitar a la mateixa Supabase.

  Per a la prova pilot amb un sol centre, n'hi ha prou amb informar-los per escrit. Abans d'oferir-ho a d'altres, informa-te'n bé.
- **Còpies de seguretat.** El pla Free no en fa. Tens dues opcions:
  - fer-ne una periòdicament amb `pg_dump` i la *connection string* del projecte (botó **Connect** del dashboard): `pg_dump "CONNECTION_STRING" --data-only --schema=public -f backup.sql`;
  - passar al pla Pro (25 $/mes), que en fa diàries.
- **Límits del pla Free**: 500 MB de base de dades i 1 GB de fitxers. Les fotos es comprimeixen a uns 200 KB, així que hi caben unes 5.000.
