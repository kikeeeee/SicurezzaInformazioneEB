# Sistema OAuth2/OpenID Connect - Spiegazione Completa del Server

## Introduzione

Questo documento fornisce una spiegazione dettagliata di ogni blocco di codice del server OAuth2/OpenID Connect implementato in Node.js con Express.js. Il sistema supporta l'autenticazione federata tramite Google e GitHub, utilizza JWT per l'autorizzazione e offre un'interfaccia web moderna e responsive.

## Struttura del Sistema

Il sistema è composto da:
- **Backend**: Server Express.js con Passport.js per OAuth2
- **Autenticazione**: Google OAuth2 e GitHub OAuth2
- **Autorizzazione**: JWT (JSON Web Tokens)
- **Sessioni**: Express Session per la gestione delle sessioni
- **Database**: Simulato in memoria (Map JavaScript)
- **UI**: Interfaccia web responsive con CSS moderno

---

## 1. Importazioni e Configurazione Iniziale

```javascript
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
```

**Spiegazione:**
- `require('dotenv').config();`  
  Carica le variabili d'ambiente dal file `.env` e le aggiunge a `process.env`, mantenendo segreti e configurazioni esterni al codice.

- `const express = require('express');`  
  Importa il framework Express, che semplifica la gestione di routing e middleware per il server HTTP.

- `const session = require('express-session');`  
  Carica il middleware per creare e gestire cookie di sessione (`connect.sid`), consentendo di mantenere lo stato di autenticazione tra le richieste.

- `const passport = require('passport');`  
  Importa Passport, la libreria che fornisce un'unica API per autenticazione e autorizzazione, con strategie modulari.

- `const GoogleStrategy = require('passport-google-oauth20').Strategy;`  
  Importa la strategia OAuth2 per Google, che gestisce redirect, scambio del codice e recupero del profilo utente.

- `const GitHubStrategy = require('passport-github2').Strategy;`  
  Importa la strategia OAuth2 per GitHub, simile a quella di Google ma con endpoint e scope specifici.

- `const jwt = require('jsonwebtoken');`  
  Carica la libreria per creare e verificare JSON Web Token, utilizzati per autorizzazione stateless delle API.

- `const crypto = require('crypto');`  
  Importa il modulo crittografico di Node.js, utilizzato qui per generare identificativi unici (`crypto.randomUUID()`) in maniera sicura.
---

## 2. Verifica della Configurazione

```javascript
console.log('🔍 Verifica configurazione:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✅ PRESENTE' : '❌ MANCANTE');
```

**Spiegazione:**
- Verifica che le variabili d'ambiente necessarie siano presenti
- Fornisce feedback visivo durante l'avvio dell'applicazione
- Aiuta nel debug della configurazione OAuth2

---

## 3. Configurazione dell'Applicazione

```javascript
const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    callbackURL: '/auth/google/callback'
  },
  github: {
    clientID: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret',
    callbackURL: '/auth/github/callback'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    expiresIn: '24h'
  },
  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret'
  }
};
```

**Spiegazione:**
- `const app = express();`  
  Crea un'istanza di Express, che sarà il server HTTP su cui definisci rotte, middleware e ascolti le richieste.

- `const PORT = process.env.PORT || 3000;`  
  Imposta la porta su cui il server ascolterà. Usa la variabile d'ambiente `PORT` (utile in ambienti di hosting) oppure 3000 come fallback.

## Oggetto `config`

Raccoglie in un unico posto tutte le chiavi e impostazioni sensibili, permettendo di cambiare ambiente (locale, staging, produzione) senza modificare il codice.

- **`google`**  
  - `clientID`: ID pubblico dell’app Google OAuth2, preso da `process.env.GOOGLE_CLIENT_ID` o fallback di sviluppo.  
  - `clientSecret`: Segreto privato per Google OAuth2, preso da `process.env.GOOGLE_CLIENT_SECRET` o fallback.  
  - `callbackURL`: Percorso in cui l’utente torna dopo il login Google.

- **`github`**  
  - `clientID`: ID pubblico dell’app GitHub OAuth2 (`process.env.GITHUB_CLIENT_ID` o fallback).  
  - `clientSecret`: Segreto privato per GitHub OAuth2 (`process.env.GITHUB_CLIENT_SECRET` o fallback).  
  - `callbackURL`: Percorso in cui GitHub reindirizza l’utente dopo l’autenticazione.

- **`jwt`**  
  - `secret`: Chiave segreta per firmare e verificare i JSON Web Token, letta da `process.env.JWT_SECRET` o fallback.  
  - `expiresIn`: Durata di validità del token (qui 24 ore).

- **`session`**  
  - `secret`: Segreto per firmare il cookie di sessione (`connect.sid`), preso da `process.env.SESSION_SECRET` o fallback.
---

## 4. Middleware di Base

```javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());
```

**Spiegazione:**
- `app.use(express.json());`  
  Aggiunge un middleware che analizza automaticamente il corpo delle richieste in formato JSON e popola `req.body` con l’oggetto risultante.

- `app.use(express.urlencoded({ extended: true }));`  
  Monta un middleware per interpretare il corpo delle richieste `application/x-www-form-urlencoded` (tipico dei form HTML) e popola `req.body`.  
  - `extended: true` usa la libreria `qs` per parsing avanzato (nested object, array).

- `app.use(session({ ... }));`  
  Avvia il middleware di sessione `express-session` con le seguenti opzioni:  
  - `secret`: chiave per firmare il cookie di sessione.  
  - `resave: false`: non registra la sessione se non viene modificata.  
  - `saveUninitialized: false`: non crea una sessione vuota se l’utente non ha effettuato il login.  
  - `cookie.secure`: imposta `true` per inviare il cookie solo su HTTPS in produzione.

- `app.use(passport.initialize());`  
  Inizializza Passport, aggiungendo a ogni oggetto `req` le funzioni di autenticazione (`req.login`, `req.logout`, `req.isAuthenticated`) e il supporto all’uso delle strategie.

- `app.use(passport.session());`  
  Collega Passport al meccanismo di sessione:  
  - Legge il cookie di sessione (`connect.sid`).  
  - Recupera l’ID utente serializzato.  
  - Richiama `passport.deserializeUser()` per ricostruire `req.user` con l’oggetto utente completo.

---

## 5. Database Simulato

```javascript
const users = new Map();
```

**Spiegazione:**
- Utilizza una `Map` JavaScript per simulare un database in memoria
- In produzione andrebbe sostituito con un database reale (MongoDB, PostgreSQL, etc.)
- Permette operazioni CRUD veloci durante lo sviluppo

---

## 6. Serializzazione Utente

```javascript
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user);
});
```

**Spiegazione:**
- **`passport.serializeUser((user, done) => { ... });`**  
  - Viene chiamato al termine dell’autenticazione (in `req.login`).  
  - Riceve l’oggetto `user` e una funzione `done(err, key)`.  
  - **Scopo**: scegliere quale informazione dell’utente salvare nella sessione.  
  - In questo caso, salva solo `user.id` (leggero e non sensibile) nel cookie di sessione.

- **`passport.deserializeUser((id, done) => { ... });`**  
  - Viene eseguito ad ogni richiesta successiva se esiste una sessione valida.  
  - Riceve l’`id` precedentemente serializzato e una funzione `done(err, user)`.  
  - **Scopo**: recuperare l’oggetto utente completo dallo store (qui `users.get(id)`) e assegnarlo a `req.user`.  
  - Garantisce che in ogni handler tu possa accedere a `req.user` con tutti i dati utente.
---

## 7. Strategia Google OAuth2

```javascript
passport.use(new GoogleStrategy({
  clientID: config.google.clientID,
  clientSecret: config.google.clientSecret,
  callbackURL: config.google.callbackURL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = Array.from(users.values()).find(
      user => user.googleId === profile.id
    );

    if (existingUser) {
      existingUser.lastLogin = new Date();
      existingUser.accessToken = accessToken;
      return done(null, existingUser);
    }

    const newUser = {
      id: crypto.randomUUID(),
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos[0].value,
      provider: 'google',
      accessToken: accessToken,
      refreshToken: refreshToken,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    users.set(newUser.id, newUser);
    return done(null, newUser);
  } catch (error) {
    return done(error, null);
  }
}));
```

**Spiegazione:**
- **Configurazione**  
  - `clientID` e `clientSecret`: credenziali ottenute da Google Cloud Console.  
  - `callbackURL`: endpoint interno `/auth/google/callback` dove Google restituisce il codice.  
  - `scope`: autorizzazioni richieste (`profile` per dati base, `email` per l’indirizzo).

- **Verify Callback** (funzione `async`)  
  1. **Ricerca utente esistente**  
     ```js
     const existingUser = Array.from(users.values()).find(
       user => user.googleId === profile.id
     );
     ```  
     Se l’utente con lo stesso `googleId` è già registrato, aggiorna `lastLogin` e `accessToken`.

  2. **Creazione nuovo utente**  
     ```js
     const newUser = {
       id: crypto.randomUUID(),
       googleId: profile.id,
       email: profile.emails[0].value,
       name: profile.displayName,
       avatar: profile.photos[0].value,
       provider: 'google',
       accessToken,
       refreshToken,
       createdAt: new Date(),
       lastLogin: new Date()
     };
     users.set(newUser.id, newUser);
     ```  
     - `crypto.randomUUID()`: genera un ID univoco.  
     - `profile`: oggetto restituito da Google con campi come `id`, `emails`, `displayName`, `photos`.

- **Chiamata `done(null, user)`**  
  - Se non ci sono errori, Passport registra l’utente serializzato nella sessione.  
  - In caso d’errore, `done(error, null)` invia l’errore al middleware di Passport.

- **Error Handling**  
  Il blocco `try/catch` intercetta eccezioni nella ricerca/creazione utente e le passa a Passport per gestirle nel flusso di autenticazione.  
---

## 8. Strategia GitHub OAuth2

```javascript
passport.use(new GitHubStrategy({
  clientID: config.github.clientID,
  clientSecret: config.github.clientSecret,
  callbackURL: config.github.callbackURL,
  scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = Array.from(users.values()).find(
      user => user.githubId === profile.id
    );

    if (existingUser) {
      existingUser.lastLogin = new Date();
      existingUser.accessToken = accessToken;
      return done(null, existingUser);
    }

    const newUser = {
      id: crypto.randomUUID(),
      githubId: profile.id,
      email: profile.emails ? profile.emails[0].value : null,
      name: profile.displayName || profile.username,
      avatar: profile.photos[0].value,
      provider: 'github',
      accessToken: accessToken,
      refreshToken: refreshToken,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    users.set(newUser.id, newUser);
    return done(null, newUser);
  } catch (error) {
    return done(error, null);
  }
}));
```

**Spiegazione:**
- **Configurazione**  
  - `clientID` e `clientSecret`: credenziali ottenute da GitHub Developer Settings.  
  - `callbackURL`: endpoint interno `/auth/github/callback` dove GitHub restituisce il codice di autorizzazione.  
  - `scope`: autorizzazioni (`user:email` per accedere all’indirizzo email dell’utente).

- **Verify Callback** (funzione `async`)  
  1. **Ricerca utente esistente**  
     ```js
     const existingUser = Array.from(users.values()).find(
       user => user.githubId === profile.id
     );
     ```  
     Se un utente con lo stesso `githubId` esiste già, aggiorna `lastLogin` e `accessToken`, poi chiama `done(null, existingUser)`.

  2. **Creazione nuovo utente**  
     ```js
     const newUser = {
       id: crypto.randomUUID(),
       githubId: profile.id,
       email: profile.emails ? profile.emails[0].value : null,
       name: profile.displayName || profile.username,
       avatar: profile.photos[0].value,
       provider: 'github',
       accessToken,
       refreshToken,
       createdAt: new Date(),
       lastLogin: new Date()
     };
     users.set(newUser.id, newUser);
     ```  
     - `crypto.randomUUID()`: genera un ID univoco per l’utente.  
     - `profile`: oggetto restituito da GitHub con `id`, `emails`, `displayName`, `username`, `photos`.

- **Chiamata `done(null, user)`**  
  - Conclude il flusso di autenticazione comunicando a Passport l’oggetto utente da serializzare nella sessione.  
  - In caso di errore, `done(error, null)` passa l’errore al middleware di Passport.

- **Gestione degli errori**  
  Il blocco `try/catch` cattura eccezioni nella ricerca o creazione dell’utente e le passa a Passport perché le gestisca correttamente nel flusso di autenticazione.

---

## 9. Middleware di Autenticazione JWT

```javascript
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, config.jwt.secret, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token non valido' });
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Token di accesso richiesto' });
  }
};
```

**Spiegazione:**
- **`authHeader`**: legge l’header `Authorization` dalla richiesta, che dovrebbe avere formato `Bearer <token>`.

- **Estrazione del token**:  
  ```js
  const token = authHeader.split(' ')[1];
  ```  
  Divide la stringa su spazio e prende la parte dopo `Bearer`.

- **Verifica del token**:  
  ```js
  jwt.verify(token, config.jwt.secret, (err, user) => { ... });
  ```  
  - Controlla la firma e la scadenza del JWT usando la chiave segreta `config.jwt.secret`.  
  - In caso di errore (`err`), risponde con **403 Forbidden** e messaggio “Token non valido”.

- **Popolamento di `req.user`**:  
  Se la verifica ha successo, `user` contiene il payload decodificato (claim). Viene assegnato a `req.user`, rendendo disponibili le informazioni dell’utente nei handler successivi.

- **Gestione delle risposte**:  
  - **401 Unauthorized**: quando manca completamente l’header `Authorization`.  
  - **403 Forbidden**: quando il token è presente ma non valido (firma scaduta, manomessa).

- **Scopo**: proteggere percorsi API restituendo solo a richieste con JWT valido l’accesso alle risorse protette.
---

## 10. Middleware di Autenticazione Sessione

```javascript
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Accesso non autorizzato' });
};
```

**Spiegazione:**
 **`req.isAuthenticated()`**: metodo fornito da Passport che restituisce `true` se l’utente ha effettuato correttamente il login e la sua sessione è ancora valida.

- **Flusso di controllo**:  
  - Se l’utente è autenticato (`true`), chiama `next()` per passare al middleware o route handler successivo.  
  - Se non autenticato (`false`), risponde immediatamente con **401 Unauthorized** e un messaggio JSON.

- **Utilizzo**:  
  Protegge rotte basate su sessione (login tradizionale con cookie), garantendo che solo utenti loggati possano accedere a risorse server-rendered o endpoint protetti.

- **Differenza da JWT**:  
  - `ensureAuthenticated` verifica la sessione lato server.  
  - `authenticateJWT` verifica un token stateless inviato nell’header `Authorization`.  

- **Scopo**:  
  Offrire un controllo semplice dello stato di autenticazione per tutte le route che richiedono che l’utente abbia già eseguito `passport.authenticate()` in precedenza.

---

## 11. Funzione CSS per l'Interfaccia

```javascript
const getStyles = () => `
  <style>
    // ... CSS completo per l'interfaccia
  </style>
`;
```

**Spiegazione:**
- Funzione che restituisce CSS completo per l'interfaccia web
- **Caratteristiche del design**:
  - Responsive design per mobile e desktop
  - Gradients e animazioni moderne
  - Effetti hover e transizioni
  - Colori specifici per provider (Google/GitHub)
  - Card-based layout con ombre e bordi arrotondati
- **Componenti stilizzati**:
  - Pulsanti di login
  - Informazioni utente
  - Messaggi di errore/successo
  - Badge per provider
  - Avatar utente

---

## 12. Route Principale (Homepage)

```javascript
app.get('/', (req, res) => {
  if (req.user) {
    // Dashboard utente autenticato
    res.send(`
      <!DOCTYPE html>
      // ... HTML per dashboard
    `);
  } else {
    // Schermata di login
    res.send(`
      <!DOCTYPE html>
      // ... HTML per login
    `);
  }
});
```

**Spiegazione:**
- **Percorso**: `GET '/'` definisce l’endpoint principale dell’app, accessibile all’URL base (es. `http://localhost:3000/`).

- **Controllo di autenticazione**:  
  - `if (req.user)`: verifica se Passport ha popolato `req.user` durante la deserializzazione della sessione, indicando che l’utente ha effettuato correttamente il login.  
  - Se `req.user` esiste, il server assume che l’utente sia autenticato.

- **Response in base allo stato**:  
  - **Utente autenticato**: invia una pagina HTML che funge da dashboard, mostrando contenuti riservati (dati personali, link protetti, pulsante di logout).  
  - **Utente non autenticato**: invia una schermata di login con i pulsanti per avviare il flusso OAuth (Google/GitHub).

- **Utilizzo di `res.send()`**:  
  Inietta direttamente stringhe HTML nell’output HTTP. È un approccio rapido per template inline, ideale in demo o progetti di piccole dimensioni.

- **Scopo**:  
  Centralizzare la logica di routing per la home page, servendo dinamicamente contenuti diversi in base allo stato di autenticazione dell’utente.

---

## 13. Route OAuth2 per Google

```javascript
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    const token = jwt.sign(
      { 
        id: req.user.id, 
        email: req.user.email, 
        name: req.user.name,
        provider: req.user.provider
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    req.session.jwtToken = token;
    console.log('✅ Login Google riuscito per:', req.user.email);
    res.redirect('/');
  }
);
```

**Spiegazione:**
- **`GET /auth/google`**  
  - **Scopo**: avvia il flusso di autenticazione OAuth2 con Google.  
  - **`passport.authenticate('google', { scope: ['profile', 'email'] })`**:  
    - `google`: nome della strategia Passport.  
    - `scope`: insieme di permessi richiesti (dati anagrafici base e indirizzo email).  
  - **Effetto**: reindirizza il browser a un URL di Google dai quale l’utente concede i permessi.

- **`GET /auth/google/callback`**  
  - **Primo middleware (`passport.authenticate`)**:  
    - Verifica la risposta di Google contenente il `code`.  
    - In caso di fallimento reindirizza a `/login?error=google`.  
  - **Secondo middleware (callback)**:  
    1. **Generazione JWT**:  
       ```js
       jwt.sign(
         { id, email, name, provider },
         config.jwt.secret,
         { expiresIn: config.jwt.expiresIn }
       );
       ```  
       Crea un token firmato con le informazioni essenziali dell’utente, valido per il tempo configurato.  
    2. **Memorizzazione in sessione**:  
       ```js
       req.session.jwtToken = token;
       ```  
       Salva il JWT nella sessione per un rapido recupero da parte del front-end.  
    3. **Log e redirect**: stampa un messaggio di successo in console e reindirizza l’utente alla home (`/`), dove potrà trovare la dashboard.

- **Flusso completo**:  
  1. L’utente clicca “Login con Google” → `/auth/google`.  
  2. Google chiede credenziali e consensi → callback con `code`.  
  3. Il middleware Passport scambia `code` per `accessToken` e `profile`, esegue la _verify callback_.  
  4. Passport chiama `req.login()` → sessione utente.  
  5. Il callback finale genera un JWT, lo salva in sessione e porta l’utente alla pagina protetta.
---

## 14. Route OAuth2 per GitHub

```javascript
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (req, res) => {
    const token = jwt.sign(
      { 
        id: req.user.id, 
        email: req.user.email, 
        name: req.user.name,
        provider: req.user.provider
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    req.session.jwtToken = token;
    console.log('✅ Login GitHub riuscito per:', req.user.name);
    res.redirect('/');
  }
);
```

**Spiegazione:**
- **`GET /auth/github`**  
  - **Scopo**: avvia il flusso di autenticazione OAuth2 con GitHub.  
  - **`passport.authenticate('github', { scope: ['user:email'] })`**:  
    - `github`: nome della strategia Passport per GitHub.  
    - `scope`: permessi richiesti (accesso all’indirizzo email dell’utente, pubblica o privata).  
  - **Effetto**: reindirizza il browser a GitHub per ottenere il consenso dell’utente.

- **`GET /auth/github/callback`**  
  - **Primo middleware (`passport.authenticate`)**:  
    - Gestisce il ritorno da GitHub con il `code`.  
    - In caso di fallimento guida al redirect `/login?error=github`.  
  - **Secondo middleware (callback)**:  
    1. **Generazione JWT**:  
       ```js
       jwt.sign(
         { id, email, name, provider },
         config.jwt.secret,
         { expiresIn: config.jwt.expiresIn }
       );
       ```  
       Crea un token firmato con dati utente essenziali, valido per il tempo configurato.  
    2. **Memorizzazione in sessione**:  
       ```js
       req.session.jwtToken = token;
       ```  
       Salva il JWT nella sessione per essere recuperato dal front-end.  
    3. **Log e redirect**: stampa un messaggio di successo e reindirizza alla home (`/`) per visualizzare la dashboard.

- **Flusso completo**:  
  1. L’utente clicca “Login con GitHub” → `/auth/github`.  
  2. GitHub chiede le credenziali e autorizza l’accesso → callback con `code`.  
  3. Passport scambia `code` per `accessToken` e `profile`, esegue la verify callback.  
  4. Passport chiama `req.login()` → sessione utente.  
  5. Il callback genera un JWT, lo salva in sessione e porta l’utente alla pagina protetta.
---

## 15. Pagina di Errore Login

```javascript
app.get('/login', (req, res) => {
  const error = req.query.error;
  let errorMessage = '';
  
  if (error === 'google') {
    errorMessage = 'Errore durante il login con Google...';
  } else if (error === 'github') {
    errorMessage = 'Errore durante il login con GitHub...';
  }
  
  res.send(`
    <!DOCTYPE html>
    // ... HTML per errore login
  `);
});
```

**Spiegazione:**
- Gestisce gli errori di autenticazione OAuth2
- **Parameter parsing**: Legge il tipo di errore dalla query string
- **Messaggi personalizzati**: Errori specifici per Google/GitHub
- **Interfaccia di errore**:
  - Messaggio di errore chiaro
  - Suggerimenti per la risoluzione
  - Pulsanti per riprovare il login
  - Link per tornare alla homepage

---

## 16. API Routes

### API Profile
```javascript
app.get('/api/profile', ensureAuthenticated, (req, res) => {
  const userProfile = {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    avatar: req.user.avatar,
    provider: req.user.provider,
    createdAt: req.user.createdAt,
    lastLogin: req.user.lastLogin
  };
  res.json(userProfile);
});
```

**Spiegazione:**
- **Percorso**: `GET /api/profile` è un endpoint API REST che restituisce i dati dell’utente autenticato.

- **Middleware `ensureAuthenticated`**:  
  Garantisce che la richiesta venga elaborata solo se c’è una sessione valida (utente loggato). In caso contrario, risponde con **401 Unauthorized**.

- **Creazione dell’oggetto `userProfile`**:  
  - Estrae le informazioni principali da `req.user` (impostato da Passport in `deserializeUser`).  
  - Campi inclusi:  
    - `id`: identificatore univoco.  
    - `name`, `email`, `avatar`: dati anagrafici e immagine profilo.  
    - `provider`: origine del login (`google`, `github`).  
    - `createdAt`, `lastLogin`: timestamp di creazione e ultimo accesso.

- **Risposta JSON**:  
  Utilizza `res.json(userProfile)` per inviare un payload JSON con i dati utente. Questo metodo imposta automaticamente l’header `Content-Type: application/json`.

- **Scopo**:  
  Fornire un endpoint protetto che client-side (browser, SPA, app mobile) possono chiamare per ottenere i dettagli del profilo dell’utente loggato.
### API Token
```javascript
app.get('/api/token', ensureAuthenticated, (req, res) => {
  res.json({ 
    token: req.session.jwtToken,
    expiresIn: config.jwt.expiresIn
  });
});
```

**Spiegazione:**
-- **Percorso**: `GET /api/token` è un endpoint API REST che restituisce il JSON Web Token (JWT) generato in fase di login.

- **Middleware `ensureAuthenticated`**:  
  Verifica che l’utente abbia una sessione valida (login eseguito). Se non autenticato, risponde con **401 Unauthorized**.

- **Risposta JSON**:  
  - `token`: recupera il JWT firmato salvato precedentemente in `req.session.jwtToken`.  
  - `expiresIn`: indica la durata di validità del token, presa dalla configurazione (`config.jwt.expiresIn`, es. `"24h"`).

- **Utilizzo tipico**:  
  Client-side (SPA o app mobile) può richiamare `/api/token` dopo aver stabilito una sessione di login per ottenere il JWT da utilizzare in successive chiamate API protette.

- **Scopo**:  
  Separare la generazione del token dalla logica di autenticazione iniziale, fornendo un endpoint dedicato per il recupero del JWT e il relativo TTL.

### API Protetta
```javascript
app.get('/api/protected', authenticateJWT, (req, res) => {
  res.json({ 
    message: 'Accesso autorizzato alla risorsa protetta',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});
```

**Spiegazione:**
- **Percorso**: `GET /api/protected` è un endpoint API REST dedicato a testare risorse protette tramite JWT.

- **Middleware `authenticateJWT`**:  
  - Verifica la presenza dell'header `Authorization: Bearer <token>`.  
  - Controlla la validità e la firma del JWT con `jwt.verify()`.  
  - In caso di successo, popola `req.user` con il payload decodificato; altrimenti risponde con:
    - **401 Unauthorized** se manca il token.
    - **403 Forbidden** se il token è invalido o scaduto.

- **Risposta JSON**:  
  - `message`: conferma che l'accesso è stato autorizzato.  
  - `user`: restituisce i dati estratti dal payload del JWT (`req.user`), tipicamente `id`, `email`, `name`, `provider`.  
  - `timestamp`: indica l'orario della risposta, utile per debugging o log lato client.

- **Scopo**:  
  Fornire un esempio concreto di endpoint protetto da autenticazione stateless con JWT, verificando la validità del token e autorizzando l'accesso solo a chi presenta un token corretto.
---

## 17. Logout

```javascript
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Errore durante il logout' });
    }
    req.session.destroy();
    res.redirect('/');
  });
});
```

**Spiegazione:**
- Route per il logout dell'utente
- **Passport logout**: Rimuove l'utente dalla sessione
- **Distruzione sessione**: Elimina completamente la sessione
- **Gestione errori**: Cattura eventuali errori durante il logout
- **Redirect**: Riporta alla homepage (schermata di login)

---

## 18. Error Handler

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});
```

**Spiegazione:**
- Middleware globale per la gestione degli errori
- **Logging**: Registra lo stack trace dell'errore
- **Risposta**: JSON con messaggio di errore generico
- **Sicurezza**: Non espone dettagli tecnici al client

---

## 19. Avvio del Server

```javascript
app.listen(PORT, () => {
  console.log(`🚀 Server in esecuzione su http://localhost:${PORT}`);
  console.log('📊 Configurazione OAuth2:');
  console.log(`   - Google: ${config.google.clientID && config.google.clientID !== 'your-google-client-id' ? '✅ Configurato' : '❌ Non configurato'}`);
  console.log(`   - GitHub: ${config.github.clientID && config.github.clientID !== 'your-github-client-id' ? '✅ Configurato' : '❌ Non configurato'}`);
  console.log('🔒 Endpoints disponibili:');
  console.log('   - GET  /              → Homepage con login');
  console.log('   - GET  /auth/google   → Login Google');
  console.log('   - GET  /auth/github   → Login GitHub');
  console.log('   - GET  /api/profile   → Profilo utente (autenticato)');
  console.log('   - GET  /api/token     → JWT token (autenticato)');
  console.log('   - GET  /api/protected → Risorsa protetta (JWT)');
  console.log('   - GET  /logout        → Logout');
});
```

**Spiegazione:**
- Avvia il server sulla porta specificata
- **Feedback visivo**: Mostra informazioni complete del sistema
- **Stato configurazione**: Verifica se OAuth2 è configurato correttamente
- **Mappa endpoints**: Lista tutti gli endpoint disponibili
- **Documentazione automatica**: Aiuta nello sviluppo e debug

---

## 20. Export del Modulo

```javascript
module.exports = app;
```

**Spiegazione:**
- Esporta l'istanza Express per uso in altri moduli
- **Testing**: Permette di importare l'app per i test
- **Modularità**: Facilita l'integrazione con altri sistemi
- **Deployment**: Compatibile con servizi di hosting

---

## Flusso di Autenticazione

### 1. **Login Iniziale**
1. Utente visita `/`
2. Sistema mostra schermata di login
3. Utente clicca su "Login con Google/GitHub"

### 2. **Processo OAuth2**
1. Redirect al provider OAuth2
2. Utente autorizza l'applicazione
3. Provider reindirizza al callback
4. Sistema crea/aggiorna utente nel database

### 3. **Generazione Token**
1. Sistema genera JWT token
2. Token salvato nella sessione
3. Utente reindirizzato alla dashboard

### 4. **Accesso API**
1. **Sessione**: API `/api/profile` e `/api/token`
2. **JWT**: API `/api/protected`

### 5. **Logout**
1. Utente clicca logout
2. Sistema distrugge sessione
3. Redirect alla homepage

---

## Sicurezza

### **Protezioni Implementate**
- **HTTPS**: Cookie sicuri in produzione
- **Session Secret**: Segreto per firmare le sessioni
- **JWT Secret**: Segreto per firmare i token
- **Scope limitati**: Solo dati necessari dai provider
- **Token scadenza**: JWT con scadenza 24h
- **Validazione**: Controllo presenza e validità dei token

### **Considerazioni per la Produzione**
- Database persistente invece di memoria
- Variabili d'ambiente sicure
- HTTPS obbligatorio
- Rate limiting
- Logging strutturato
- Monitoring e alerting
- Refresh token per JWT
- Revoca token compromessi

---

## Tecnologie Utilizzate

### **Backend**
- **Node.js**: Runtime JavaScript
- **Express.js**: Framework web
- **Passport.js**: Middleware autenticazione
- **JSON Web Tokens**: Autorizzazione API

### **OAuth2 Providers**
- **Google OAuth2**: Autenticazione Google
- **GitHub OAuth2**: Autenticazione GitHub

### **Sicurezza**
- **Express Session**: Gestione sessioni
- **Crypto**: Generazione UUID sicuri
- **Environment Variables**: Configurazione sicura

### **Frontend**
- **HTML5**: Markup semantico
- **CSS3**: Styling moderno e responsive
- **JavaScript**: Interazioni client-side

---
