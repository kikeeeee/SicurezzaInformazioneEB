# 🛂 Sistema di Autenticazione Federata OAuth2 (Google + GitHub)

> Login centralizzato con **Passport.js**, sessioni sicure ed emissione di **JWT** per API protette.

## :pushpin: Indice
1. [Panoramica](#panoramica)
2. [Funzionalità principali](#funzionalità-principali)
3. [Stack tecnologico](#stack-tecnologico)
4. [Architettura e flusso di autenticazione](#architettura-e-flusso-di-autenticazione)
5. [Prerequisiti](#prerequisiti)
6. [Configurazione credenziali OAuth2](#configurazione-credenziali-oauth2)
7. [Variabili d’ambiente](#variabili-dambiente)
8. [Avvio in locale](#avvio-in-locale)
9. [Endpoint REST & pagine](#endpoint-rest--pagine)
10. [Sicurezza & best practice](#sicurezza--best-practice)
11. [Deployment](#deployment)
12. [Roadmap & TODO](#roadmap--todo)
13. [Contribuire](#contribuire)
14. [Licenza](#licenza)

---

## Panoramica
Questo progetto fornisce un **server Node.js/Express** che permette l’accesso tramite Google o GitHub usando il protocollo **OAuth 2 / OpenID Connect**.  
Una volta autenticato il cliente, il server:
1. mantiene la sessione con *express-session*;
2. emette un **JSON Web Token** (JWT) firmato che può essere usato per consumare API protette (`/api/protected`).:contentReference[oaicite:0]{index=0}

---

## Funzionalità principali
| Feature | Descrizione |
|---------|-------------|
| **Multi-provider** | Supporto simultaneo a Google e GitHub con strategie Passport dedicate.:contentReference[oaicite:1]{index=1} |
| **Sessione + JWT** | Dopo il login, il token è salvato in sessione ed esposto via `/api/token`.:contentReference[oaicite:2]{index=2} |
| **Rotte demo** | Homepage con pulsanti di login, pagina di errore personalizzata e logout sicuro.:contentReference[oaicite:3]{index=3} |
| **API Protette** | Middleware `authenticateJWT` verifica il token prima di servire le risorse.:contentReference[oaicite:4]{index=4} |
| **DB simulato** | Per rapidità, gli utenti sono salvati in una `Map`; è semplice sostituirla con un DB reale.:contentReference[oaicite:5]{index=5} |

---

## Stack tecnologico
- **Node.js 20+** & **Express 4**
- **Passport.js** (`passport-google-oauth20`, `passport-github2`)
- **express-session** con cookie secure in *production*
- **jsonwebtoken** per la firma dei token
- **dotenv** per la gestione delle variabili d’ambiente

---

## Architettura e flusso di autenticazione
```text
Browser ──▶ /auth/google            ─┐
         ──▶ /auth/github             │ (302 redirect)
                                      ▼
                     Google / GitHub Authorization Server
                                      ▼
Browser ◀── callback (/auth/*/callback)
           │ 1. Passport valida il codice
           │ 2. L'utente viene (creato ↺/ trovato) nel DB
           │ 3. Sessione Express serializza l'ID utente
           │ 4. Viene emesso un JWT (24h di validità)
Browser ──▶ /api/protected
Server  ──▶ Middleware `authenticateJWT` convalida il token
