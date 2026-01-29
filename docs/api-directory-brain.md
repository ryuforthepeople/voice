# 🌐 API Directory — Product Brain

> **Naam:** TBD (APIvault / FreeAPI.directory / OpenAPIs / ...)
> **Tagline:** "Find, test and use free APIs"
> **Status:** MVP (catalog + 2 demo's live)

---

## 🎯 Visie

De beste plek om gratis APIs te vinden, testen en gebruiken. Getest, gegraded, met werkende demo's.

**Wat het beter maakt:**
- **public-apis** (GitHub) — statische lijst, geen testing, geen grades
- **RapidAPI** — betaald, vendor lock-in, overweldigend
- **APIList.fun** — oppervlakkig, geen kwaliteitscontrole

**Wij:** getest ✅ gegraded ⭐ doorzoekbaar 🔍 met live demo's 🚀 en community-driven 👥

---

## 📐 Scope & Regels

### Protocol
- **Fase 1:** Alleen REST APIs (JSON via HTTP)
- **Later toevoegen:** OData, GraphQL, SOAP, WebSocket, gRPC

### Pricing
- Alleen APIs met gratis tier (geen auth OF gratis API key)
- Betaalde APIs worden later apart gecategoriseerd

### Geografie
- Geo-tags per API: 🌍 Global, 🇳🇱 NL, 🇺🇸 US, 🇪🇺 EU, 🇬🇧 UK, 🇩🇪 DE, etc.
- Filteerbaar op regio

---

## 🏗️ Wat er nu staat

### Live sites
- **API Catalog:** https://free-api-catalog.netlify.app — 500+ APIs, grades, filters
- **Demo CoinLore:** https://api-demo-coinlore.netlify.app — live crypto data
- **Demo Radio Browser:** https://api-demo-radio.netlify.app — werkende radiospeler
- **VoiceKit Wizard:** https://voicekit-wizard.netlify.app — (gerelateerd product)

### Grading systeem (0-100)
| Criterium | Punten |
|---|---|
| Bereikbaar (HTTP 200) | 25 |
| Response tijd (<200ms=20, <500ms=15, <1s=10, <3s=5) | 20 |
| Geldige response | 20 |
| Geen auth nodig (none=15, apiKey=10, OAuth=5) | 15 |
| HTTPS | 10 |
| Documentatie bereikbaar | 10 |

### Grades
- 90-100: ⭐ A+
- 80-89: 🟢 A
- 70-79: 🔵 B
- 60-69: 🟡 C
- 40-59: 🟠 D
- 0-39: 🔴 F

---

## 🚀 Roadmap

### Fase 1 — Foundation (NU)
- [x] 500 APIs gecatalogiseerd
- [x] Health check + grading
- [x] Catalog site met filters
- [x] 2 demo showcases (CoinLore, Radio Browser)
- [ ] Opschalen naar 2000+ APIs (REST only)
- [ ] Health check op 2000+
- [ ] Geo-tags toevoegen
- [ ] Detailpagina per API (endpoints, response voorbeelden, rate limits)

### Fase 2 — Interactief
- [ ] API Playground (probeer API in de browser)
- [ ] Dagelijkse health checks (automatisch)
- [ ] User accounts (bookmarks, reviews)
- [ ] Top 10 demo showcases
- [ ] Submit formulier voor nieuwe APIs

### Fase 3 — Community & Content
- [ ] User-submitted APIs met review process
- [ ] Tutorials ("Build X with API Y")
- [ ] Collections ("Best APIs for fintech", "APIs voor Nederlandse data")
- [ ] Weekly newsletter
- [ ] Upvote/rating systeem

### Fase 4 — Monetization
- [ ] Premium listings (providers betalen voor featured spot)
- [ ] Pro account (monitoring alerts, private collections)
- [ ] Affiliate links naar betaalde tiers
- [ ] Sponsored collections

---

## 🏷️ Categorieën

### Huidige (25)
1. Weather & Climate
2. News & Media
3. Finance & Crypto
4. Sports
5. Music & Audio
6. Movies, TV & Entertainment
7. Books & Literature
8. Food & Recipes
9. Health & Fitness
10. Science & Nature
11. Space & Astronomy
12. Geography & Maps
13. Government & Open Data
14. Education & Reference
15. Language & Translation
16. Animals
17. Art & Design
18. Technology & Development
19. Social & Communication
20. Games & Gaming
21. Transportation & Vehicles
22. Environment & Sustainability
23. Jobs & Business
24. Security & Privacy
25. Utilities & Tools

### Toe te voegen bij opschaling
- IoT & Smart Home
- Blockchain & Web3
- Machine Learning & AI
- Email & Communication
- E-commerce
- Photography & Images
- Video & Streaming
- Calendar & Events
- Documents & Files
- Authentication & Identity

---

## 💡 Notities

- CBS (Nederland) heeft OData API — toevoegen in fase "andere protocollen"
- Elk land heeft een statistiekbureau met API (Eurostat, ONS, Census Bureau, Destatis, INSEE, etc.)
- World Bank API is de beste voor cross-country vergelijkingen
- Statistiekbureaus zijn vaak OData/SDMX — niet REST, dus later
- Demo showcases zijn krachtig voor marketing — laten zien wat je kunt bouwen

---

*Dit document evolueert. Update regelmatig met learnings.*
