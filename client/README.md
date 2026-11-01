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

## Reflection

# Reflektion – Integration med tredjepartssystem

## Arkitektur och integrationer

I den här uppgiften har jag vidareutvecklat en e-handelsapplikation som jag byggde under en tidigare kurs. Applikationen består av en frontend i React, en backend med Node.js och Express samt en PostgreSQL-databas via Supabase. Målet har varit att integrera externa tjänster för att göra applikationen mer lik en verklig e-handel.

Jag har arbetat med flera olika typer av integrationer: valutaomräkning med Frankfurter, produktimport via CSV och XML, produktsökning med Algolia, betalningar via Stripe, bildlagring i Supabase Storage och fraktombud via PostNord.

En viktig princip har varit att låta frontend kommunicera med min egen backend, som i sin tur hanterar externa API-anrop. Det gör att hemliga API-nycklar kan hållas på serversidan och att data kan valideras och bearbetas innan den skickas vidare till frontend.

## Tekniska utmaningar och lärdomar

En av de största utmaningarna har varit att förstå hur information rör sig mellan olika system. När användaren exempelvis väljer ett PostNord-ombud behöver frontend skicka valet till backend, som kontrollerar att ombudet finns, räknar ut fraktkostnaden och skickar rätt totalsumma vidare till Stripe.

Jag har fått en bättre förståelse för asynkron JavaScript, framför allt `async/await`, och varför man behöver hantera fel när man är beroende av externa tjänster. Jag har också arbetat med validering med hjälp av Zod och börjat förstå fördelarna med att separera API-integrationer i egna adapterfiler.

En annan lärdom är att man inte kan utgå från att externa API:er alltid fungerar som förväntat. PostNords tjänst för att hämta utlämningsställen fungerade, men jag lyckades inte få deras Transit Time API att fungera. Trots att jag testade olika adresser fick jag felmeddelanden, bland annat HTTP 403. Jag valde därför att inte presentera någon uppskattad leveranstid som jag inte kunde verifiera.

## Betalningar, säkerhet och tillförlitlighet

Stripe-integrationen var en av de mer lärorika delarna. Från början var det lätt att tänka att en betalning var klar när kunden återvände till webbshoppen. Jag har nu förstått att frontend inte är en tillförlitlig källa för att avgöra om betalningen faktiskt lyckats.

I stället använder applikationen en signerad webhook från Stripe. När Stripe bekräftar betalningen uppdateras orderns status och produktens lagersaldo i databasen. Jag har även använt en databasfunktion för att undvika att en order behandlas flera gånger om samma händelse skickas igen.

Under testningen uppstod ett konkret exempel på varför detta är viktigt: en betalning genomfördes hos Stripe, men ordern låg kvar som `pending` i Supabase. Genom att kontrollera betalningsstatusen direkt hos Stripe och undersöka webhookflödet kunde jag identifiera problemet och återställa ordern utan att genomföra en ny betalning.

## Användning av AI

Jag har använt ChatGPT som en handledare under arbetets gång. Framför allt har AI hjälpt mig att förstå nya koncept och tolka API-dokumentation.

Arbetssättet har ofta varit att först diskutera hur en integration bör fungera och varför en viss lösning är lämplig. Därefter har jag implementerat och testat lösningen i min egen utvecklingsmiljö, analyserat resultatet och vid behov fortsatt felsökningen.

AI har också hjälpt mig med kodexempel och förslag på implementationer, men en viktig del av lärandet har varit att förstå vad koden gör och kunna koppla den till applikationens övriga delar. Exempelvis har vi gått igenom varför Stripe kräver webhookhantering och hur validering av inkommande data kan förhindra felaktiga ordrar.

En begränsning som blivit tydlig är att AI-genererade förslag inte alltid är korrekta eller direkt användbara. Det märktes bland annat vid arbetet med PostNords API, där flera föreslagna anrop inte fungerade som förväntat. Jag har därför behövt verifiera förslagen genom dokumentation, egna tester och felsökning.

Sammantaget har AI varit ett värdefullt stöd för mitt lärande, men jag är samtidigt medveten om vikten av att fortsätta utveckla min självständiga problemlösningsförmåga och mina grundläggande programmeringskunskaper.

## Slutsats och förbättringar

Den viktigaste lärdomen från uppgiften är att en integration handlar om mer än att få ett API-anrop att returnera data. Man måste också tänka på validering, säkerhet, felhantering och vad som händer när olika system inte är överens.

Applikationen har fortfarande begränsningar. Exempelvis behöver adminautentiseringen vidareutvecklas, hemleverans kompletteras med adresshantering och betalningsflödet bli bättre på att hantera fördröjda webhookhändelser i användargränssnittet.

Jag har fått en betydligt bättre förståelse för hur externa tjänster kan kopplas ihop i en fullstackapplikation, även om jag fortfarande behöver mer praktisk erfarenhet för att kunna bygga liknande lösningar helt självständigt.

## About

Built by Oscar Wersäll as part of the Fullstack Developer program at Medieinstitutet, Stockholm.