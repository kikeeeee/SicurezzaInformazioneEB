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
- `dotenv`: Carica le variabili d'ambiente dal file `.env`
- `express`: Framework web per Node.js
- `express-session`: Gestione delle sessioni HTTP
- `passport`: Middleware per l'autenticazione
- `passport-google-oauth20`: Strategia OAuth2 per Google
- `passport-github2`: Strategia OAuth2 per GitHub
- `jsonwebtoken`: Libreria per generare e verificare JWT
- `crypto`: Modulo nativo per operazioni crittografiche

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
- Crea l'istanza Express
- Definisce la porta del server (default: 3000)
- Centralizza la configurazione OAuth2 per Google e GitHub
- Imposta i parametri JWT (secret e scadenza)
- Configura il segreto per le sessioni
- Utilizza valori di fallback per lo sviluppo

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
- `express.json()`: Parsing del body JSON delle richieste
- `express.urlencoded()`: Parsing dei dati form-encoded
- `session()`: Configurazione delle sessioni HTTP
  - `resave: false`: Non salva sessioni non modificate
  - `saveUninitialized: false`: Non salva sessioni vuote
  - `secure`: Cookie sicuri solo in produzione (HTTPS)
- `passport.initialize()`: Inizializza Passport.js
- `passport.session()`: Abilita il supporto per le sessioni persistenti

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
- `serializeUser`: Determina quale dato dell'utente salvare nella sessione (solo l'ID)
- `deserializeUser`: Recupera l'utente completo dall'ID salvato in sessione
- Ottimizza le prestazioni salvando solo l'ID nella sessione
- Permette la persistenza dell'autenticazione tra le richieste

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
- Configura la strategia OAuth2 per Google
- `scope`: Richiede accesso a profilo e email
- **Callback function**: Gestisce la risposta di Google dopo l'autenticazione
- **Utente esistente**: Aggiorna `lastLogin` e `accessToken`
- **Nuovo utente**: Crea un nuovo record con:
  - ID univoco generato con `crypto.randomUUID()`
  - Informazioni dal profilo Google
  - Token di accesso e refresh
  - Timestamp di creazione e ultimo accesso
- **Gestione errori**: Cattura e restituisce eventuali errori

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
- Simile alla strategia Google ma per GitHub
- `scope: ['user:email']`: Richiede accesso all'email
- **Differenze specifiche GitHub**:
  - `githubId` invece di `googleId`
  - Email potrebbe non essere disponibile (`null`)
  - Nome usa `displayName` o `username` come fallback
- **Gestione dei dati**: Struttura simile ma adattata alle specifiche GitHub

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
- Middleware per proteggere le API con JWT
- **Header Authorization**: Cerca il token nel formato `Bearer <token>`
- **Verifica JWT**: Valida il token usando il secret configurato
- **Successo**: Aggiunge l'utente decodificato a `req.user`
- **Errori**:
  - 401: Token mancante
  - 403: Token non valido o scaduto

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
- Middleware per proteggere le route con autenticazione di sessione
- `req.isAuthenticated()`: Metodo Passport.js per verificare l'autenticazione
- **Successo**: Procede alla route successiva
- **Fallimento**: Restituisce errore 401

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
- Route principale che gestisce sia login che dashboard
- **Utente autenticato**: Mostra dashboard con:
  - Informazioni profilo completo
  - Avatar e dati del provider
  - Timestamp di accesso
  - Pulsante logout
- **Utente non autenticato**: Mostra:
  - Descrizione del sistema
  - Pulsanti di login per Google/GitHub
  - Informazioni tecniche
  - Requisiti del sistema

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
- **Route iniziale**: Avvia il flusso OAuth2 con Google
- **Callback route**: Gestisce la risposta di Google
- **Successo**:
  - Genera JWT token con dati utente
  - Salva token nella sessione
  - Log del login riuscito
  - Redirect alla homepage
- **Fallimento**: Redirect alla pagina di errore

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
- Struttura identica alle route Google ma per GitHub
- **Differenze**:
  - Scope diverso (`user:email`)
  - Log mostra il nome invece dell'email
  - Redirect di errore specifico per GitHub

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
- API per ottenere il profilo dell'utente autenticato
- **Middleware**: `ensureAuthenticated` (autenticazione di sessione)
- **Risposta**: JSON con dati essenziali del profilo
- **Filtraggio**: Esclude dati sensibili (token, password, etc.)

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
- API per ottenere il JWT token dell'utente
- **Requisito**: Sessione attiva
- **Risposta**: Token JWT e tempo di scadenza
- **Uso**: Permette alle applicazioni client di ottenere il token per API calls

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
- Esempio di API protetta con JWT
- **Middleware**: `authenticateJWT` (autenticazione tramite token)
- **Risposta**: Messaggio di successo, dati utente e timestamp
- **Dimostrazione**: Mostra come proteggere le API con JWT

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
