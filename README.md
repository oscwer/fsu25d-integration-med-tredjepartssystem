# Oscar's Random Shop

A fullstack e-commerce application built with React, Express and PostgreSQL as part of the Fullstack Developer program at Medieinstitutet.

Originally developed for a system development assignment, the application has been extended with multiple third-party integrations as part of the course **Integration med 3-partssystem**.

## Live demo

- **Frontend:** https://fsu25d-integration-med-tredjepartssystem-2ain-h8yjuxzal.vercel.app/
- **Backend health check:** https://fsu25d-integration-med-tredjepartss.vercel.app/api/health
- **GitHub:** https://github.com/oscwer/fsu25d-integration-med-tredjepartssystem

The application is an educational project. Payments use Stripe test mode. Please do not enter real payment card details or sensitive personal information.

## Features and integrations

| Integration | Functionality |
| --- | --- |
| Frankfurter API | Currency conversion between SEK and selected currencies |
| Supplier CSV/XML | Import and validate products from two external data formats |
| Algolia | Product search with typo tolerance and pagination |
| Stripe Checkout | Hosted test payments with signed webhook verification |
| Supabase Storage | Upload and display product images |
| PostNord API | Find nearby service points using a Swedish postal code |
| Supabase PostgreSQL | Persist products, orders, order items and delivery selections |

The shop also includes a product catalog, shopping cart, basic administrative functionality and inventory management.

### Checkout and payment flow

1. The customer adds products to the cart and selects a PostNord service point.
2. The Express backend validates the products, quantities and delivery selection.
3. Product prices and shipping costs are calculated on the server.
4. The customer is redirected to Stripe Checkout.
5. Stripe sends a signed webhook to the backend after payment.
6. A PostgreSQL function updates the order status and inventory atomically.

The payment handler is idempotent to prevent duplicate stock reductions when the same payment event is processed more than once.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, JavaScript, Vite, CSS |
| Backend | Node.js, Express, REST APIs, Zod |
| Database | PostgreSQL, Supabase |
| File storage | Supabase Storage |
| External services | Frankfurter, Algolia, Stripe, PostNord, supplier CSV/XML |
| Deployment | Vercel |
| Version control | Git, GitHub |

## Architecture

The React frontend communicates with the Express API over HTTP. The backend is responsible for validating requests, accessing the database and communicating with external providers.

External integrations are separated into adapter modules under `server/integrations/`. This helps keep API-specific logic separate from application routes and business logic.

The frontend and backend are deployed as separate Vercel projects connected to the same GitHub repository.

## Project structure

- `client/` – React frontend
- `server/` – Express backend
- `server/integrations/` – Third-party API adapters
- `server/services/` – Business logic
- `server/db/` – SQL migrations and database functions
- `docs/` – Supporting project documentation

## Running locally

Requires Node.js, npm and configured accounts or credentials for the external services.

### Backend

```bash
cd server
npm install
npm start
```

Create a `server/.env` file with the required environment variables, including:

```dotenv
SUPABASE_URL=
SUPABASE_SECRET_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CLIENT_URL=http://localhost:5173
POSTNORD_API_KEY=
POSTNORD_BASE_URL=
POSTNORD_ORIGIN_POSTCODE=
IMPORT_ADMIN_KEY=
```

Additional configuration is required for Algolia and the supplier integrations.

Never commit real credentials or `.env` files to Git.

The backend runs on `http://localhost:3000`.

For local Stripe webhook testing, use Stripe CLI to forward relevant Checkout events to `/api/stripe/webhook` and configure the signing secret provided by the CLI.

### Frontend

```bash
cd client
npm install
npm run dev
```

Vite runs the frontend locally and proxies `/api` requests to the Express backend when no external API URL is configured.

For the deployed frontend, `VITE_API_URL` must point to the public backend URL without a trailing slash.

## Testing and verification

Testing was performed manually through the React frontend, API requests, Stripe CLI, server logs and SQL queries.

Examples include:

- Valid and invalid supplier product imports, including repeated imports.
- Product search, pagination and invalid search parameters.
- Stripe Checkout payments and signed webhook handling.
- Repeated payment processing without duplicate inventory updates.
- Successful image uploads and rejection of unsupported or oversized files.
- PostNord service point lookup and validation of selected service points.
- Server-side shipping cost calculations and free-shipping thresholds.
- A successful end-to-end test payment on the deployed application.

A payment recovery test also demonstrated that a paid Stripe session could be verified and an order safely finalized after the automatic webhook process had failed.

## Security

- Secret API credentials are stored on the server.
- Administrative endpoints use a server-validated admin key.
- Stripe webhook signatures are verified before payment events are processed.
- Checkout prices and shipping costs are calculated server-side rather than trusted from the browser.
- Incoming requests are validated, including with Zod.

The admin key approach is a simplified educational solution and is not a substitute for a complete authentication and authorization system.

## Known limitations

- PostNord's Transit Time API could not be accessed successfully during development, so estimated delivery dates are not displayed.
- Service point delivery is implemented in the checkout UI. Full home delivery requires additional address collection and validation.
- The payment confirmation page does not automatically poll for delayed webhook updates.
- The admin interface and authorization model require further development before real-world use.
- The application is a demonstration project and is not intended for live commercial transactions.

# Reflektion – Integration med tredjepartssystem

## 1. Integrationsmodeller och varför de passar

I uppgiften har jag integrerat flera externa tjänster med olika integrationsmodeller.

Frankfurter, Algolia och PostNord använder REST-API:er, där min Express-backend skickar HTTP-anrop och tar emot JSON-data. Det passar bra när applikationen behöver hämta information på begäran, exempelvis valutakurser, sökresultat, utlämningsställen och beräknade leveranstider.

Produktimporten använder CSV och XML. Dessa filformat passar när större mängder strukturerad produktinformation ska överföras mellan system. Backend hämtar, tolkar och validerar informationen innan produkterna sparas i Supabase.

För Stripe använder jag deras Node.js-SDK, en redirect till Stripe Checkout och webhooks. Kunden genomför betalningen hos Stripe, medan webhooken används för att bekräfta resultatet på serversidan. Supabase Storage använder ett SDK för uppladdning och hantering av produktbilder.

Jag har lärt mig att olika integrationsmodeller passar olika behov. En betalning kräver exempelvis en annan nivå av tillförlitlighet än ett anrop för att visa en valutakurs.

## 2. Varför integrationerna går via Express

Jag har valt att låta React kommunicera med min Express-backend, som sedan anropar de externa tjänsterna.

En viktig anledning är säkerheten. Hemliga API-nycklar ska inte finnas i frontend, eftersom JavaScript-koden körs i användarens webbläsare.

Backend gör det också möjligt att validera inkommande data, hantera fel och omvandla externa API-svar till ett format som passar min egen applikation. Ett exempel är Algolia, där sökträffarna normaliseras så att React inte behöver hantera leverantörsspecifika fält som `objectID` och `_highlightResult`.

Vid checkout hämtas produktpriser från databasen och fraktkostnaden beräknas på serversidan. Därmed behöver backend inte lita på priser som skickas från webbläsaren.

## 3. Varför använda externa tjänster i stället för att bygga egna?

Den största fördelen är att jag kan använda funktionalitet som redan utvecklats och underhålls av specialiserade leverantörer.

Att bygga en egen betaltjänst motsvarande Stripe skulle exempelvis kräva omfattande arbete med betalningssäkerhet, transaktioner, regelverk och kommunikation med betalningsleverantörer.

En egen sökmotor skulle behöva hantera indexering, stavfel, relevans och prestanda. Att bygga motsvarande PostNord-integration utan deras API skulle dessutom kräva tillgång till aktuella uppgifter om ombud, transporter och leveranstider.

Genom att använda externa tjänster kan jag fokusera på själva e-handelsapplikationen. Nackdelen är att jag blir beroende av leverantörernas API:er och tillgänglighet.

## 4. Vad händer om tjänsterna inte fungerar?

Olika avbrott påverkar shoppen på olika sätt.

Om Frankfurter inte är tillgängligt kan valutakurser inte uppdateras. Shoppen har fortfarande produktpriser i SEK, men valutavisningen kan behöva falla tillbaka på dessa.

Om leverantörens CSV- eller XML-tjänst är nere misslyckas importen, men befintliga produkter finns kvar i databasen.

Om Algolia inte svarar kan sökfunktionen inte visa nya resultat. Backend returnerar ett fel och frontend visar ett felmeddelande, medan den vanliga produktlistan fortfarande kan användas.

Om Stripe inte fungerar kan kunden inte starta eller slutföra betalningen. Ordern ska inte markeras som betald enbart för att kunden återvänder till shoppen. Under testningen upptäckte jag en betalning som var genomförd hos Stripe men fortfarande markerad som `pending` i databasen. Det visade varför signerade webhooks, loggning och idempotent orderhantering är viktiga.

Om Supabase Storage inte fungerar misslyckas bilduppladdningen, men befintliga produktuppgifter finns kvar. Om PostNord inte kan hämta utlämningsställen kan kunden däremot inte välja ett verifierat ombud och därmed inte genomföra den aktuella checkouten. Om endast leveranstidsprognosen misslyckas kan kunden fortfarande välja ombud och fortsätta betalningen.

## 5. Risker med externa beroenden

En risk är att leverantörer ändrar sina API:er, priser eller användarvillkor. Under arbetet med PostNord fick jag erfara hur viktigt det är att använda korrekt API-version och verifiera anrop mot dokumentationen.

En annan risk gäller personuppgifter. Vid betalning och leverans kan information om kunder behöva skickas till externa tjänster. Det ställer krav på att endast nödvändiga uppgifter delas, att API-nycklar skyddas och att personuppgiftshanteringen följer tillämpliga regler, exempelvis GDPR.

För att minska beroendet har jag separerat flera integrationer i adapterfiler. Det gör det lättare att ändra eller ersätta en leverantör utan att behöva skriva om hela applikationen.

## Sammanfattning

Den viktigaste lärdomen är att en integration inte bara handlar om att få ett API-anrop att fungera. Det handlar också om att välja rätt integrationsmodell, kontrollera data, skydda information och planera för att externa tjänster ibland misslyckas. Jag har fått en bättre förståelse för detta genom att implementera och felsöka integrationerna i en fungerande fullstackapplikation.



# AI-redovisning – Labb 5: PostNord

## Hur jag använde AI

Under Labb 5 använde jag ChatGPT som teknisk handledare för att förstå PostNords API:er, planera integrationen, felsöka och kontrollera implementationen.

Nedan beskriver jag arbetsprocessen steg för steg. Promptarna är sammanfattningar av våra diskussioner, inte nödvändigtvis ordagranna formuleringar.

### 1. Planera fraktintegrationen

**Exempel på prompt:**

*Hur kan jag integrera PostNord i min befintliga e-handelsapplikation med React, Express och Supabase? Jag behöver hitta närliggande ombud, beräkna frakt och visa leveranstid.*

**AI:s förslag:**

ChatGPT föreslog att kommunikationen med PostNord skulle hanteras i en separat adapter i Express-backenden. React skulle anropa mina egna endpoints i stället för PostNord direkt.

AI föreslog också att fraktpriserna skulle beräknas på serversidan och att valt ombud skulle verifieras innan ordern skapades.

**Min implementation och verifiering:**

Jag skapade en PostNord-adapter och en separat tjänst för fraktberäkningen. Jag testade API-anropen från terminalen innan de kopplades till React.

### 2. Hämta närliggande utlämningsställen

**Exempel på prompt:**

*Hur använder jag PostNords Service Points API för att hitta fem utlämningsställen utifrån ett svenskt postnummer?*

**AI:s förslag:**

ChatGPT föreslog att använda PostNords API för ombudssökning och att validera svaret innan det skickades vidare till frontend.

**Min implementation och verifiering:**

Jag använde endpointen:

`/rest/businesslocation/v5/servicepoints/nearest/byaddress`

Jag testade bland annat postnummer `11122` och fick fem utlämningsställen tillbaka.

Med hjälp av Zod validerade jag API-svaret och omvandlade det till ett enklare format med ombudets ID, namn och adress.

React visar därefter ombuden i en lista där kunden kan välja utlämningsställe.

### 3. Beräkna och verifiera fraktkostnaden

**Exempel på prompt:**

*Hur kan jag lägga till två fraktalternativ och säkerställa att kunden inte kan manipulera fraktkostnaden från React?*

**AI:s förslag:**

AI föreslog att fraktberäkningen skulle ligga i backend och att produktpriser och fraktkostnader skulle summeras innan betalningen skickades till Stripe.

**Min implementation och verifiering:**

Jag skapade en separat funktion för fraktkostnader: 59 kr för ombudsleverans och 99 kr för hemleverans, med fri frakt från 500 kr.

Jag kontrollerade också att kundens valda ombuds-ID faktiskt fanns bland de ombud PostNord returnerade.

Vid ett test med varor för 179 kr blev totalsumman 238 kr inklusive frakt. Jag verifierade sedan att Stripe Checkout tog emot rätt belopp.

Hemleverans finns i backendens beräkningsmodell men är inte fullt implementerad i checkoutgränssnittet eftersom adresshantering saknas.

### 4. Försöka hämta beräknad leveranstid

**Exempel på prompt:**

*Hur hämtar jag en beräknad leveranstid från PostNords Transit Time API i sandboxmiljön?*

**AI:s första förslag:**

ChatGPT föreslog olika API-sökvägar för Transit Time, bland annat varianter med `/transittime/addresstoaddress`.

**Problem och avvikelse från dokumentationen:**

Vissa anrop gav HTTP 404 och andra HTTP 403, bland annat med felmeddelandet `API001 Please provide a valid request`.

Vi hade inte identifierat rätt version och fullständig sökväg. Jag valde därför inledningsvis att inte visa någon leveranstid som inte gick att verifiera.

**Hur problemet löstes:**

I återkopplingen på examinationen fick jag den korrekta Transit Time V2-endpointen:

`/rest/transport/v2/transittime/addresstoaddress`

Jag testade den mot `https://atapi2.postnord.com` med min sandboxnyckel och tjänstekod `19` för ombudsleverans.

Anropet gav HTTP 200 och innehöll bland annat `estimatedTimeOfArrival.timeOfArrival`.

Detta visade att AI:s tidigare förslag på sökvägar inte var tillräckligt tillförlitliga. Lösningen var att jämföra mot rätt API-version och verifiera anropet praktiskt.

### 5. Tolka Transit Time-svaret

**Exempel på prompt:**

*PostNord returnerar flera olika leveransalternativ i en array. Hur väljer jag rätt alternativ för vanlig ombudsleverans?*

**AI:s förslag:**

ChatGPT föreslog att filtrera på tjänstekod `19`, kontrollera att alternativet är tillgängligt och utesluta tilläggstjänster som Parcel Locker (`H1`) och SameDay (`F1`).

**Min implementation och verifiering:**

Jag kompletterade PostNord-adaptern med `getTransitTime()` och Zod-validering.

Jag testade att API:t accepterade enbart mottagarens postnummer, exempelvis `11122`, och att det returnerade ett beräknat leveransdatum utan att jag behövde ange någon påhittad gatuadress.

Jag införde också en förenklad regel om att paket lämnas över till PostNord nästa vardag kl. 12:00, i stället för att använda ett fast datum.

### 6. Visa leveransprognosen i React

**Exempel på prompt:**

*Hur visar jag leveransdatumet i React-kassan utan att blockera köpet om PostNords Transit Time API inte fungerar?*

**AI:s förslag:**

AI föreslog ett separat React-state för leveransprognosen och ett API-anrop efter att ombuden hade hämtats. Prognosen skulle visas som preliminär och inte som ett garanterat leveransdatum.

**Problem och felsökning:**

När jag först testade implementationen visades ombuden men ingen leveransprognos.

Med hjälp av webbläsarens Network-flik kunde jag verifiera att API-anropet fick HTTP 200 och innehöll ett giltigt `estimatedDelivery`.

Felet låg därför inte i PostNord eller Express, utan i React. Vid en kontroll av `App.jsx` upptäckte vi att JSX-blocket som skulle visa prognosen saknades.

Efter att jag lagt till det visades leveransdatumet korrekt i kassan.

## Slutsats

AI var framför allt användbart för att dela upp integrationen i mindre steg, förklara nya koncept och föreslå felsökningsmetoder.

Samtidigt visade arbetet med Transit Time API:t att AI-förslag inte bör betraktas som verifierad dokumentation. Flera föreslagna API-sökvägar fungerade inte, och lösningen krävde att jag testade anropen mot PostNords faktiska sandboxmiljö.

Min viktigaste lärdom är därför att kombinera AI-stöd med officiell dokumentation, konkreta API-tester och egen kontroll av svar och felmeddelanden.

## About

Built by Oscar Wersäll as part of the Fullstack Developer program at Medieinstitutet, Stockholm.