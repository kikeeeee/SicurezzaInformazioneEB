// server.js - OAuth2/OpenID Connect Login System
// IMPORTANTE: Carica le variabili d'ambiente per primo
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Debug: verifica che le variabili d'ambiente siano caricate
console.log('🔍 Verifica configurazione:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✅ PRESENTE' : '❌ MANCANTE');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione ambiente
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

// Middleware
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

// Database simulato (in produzione usa un vero database)
const users = new Map();

// Serializzazione utente per la sessione
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.get(id);
  done(null, user);
});

// Debug: verifica configurazione Google
console.log('🔍 Debug Google OAuth2:');
console.log('Client ID:', config.google.clientID);
console.log('Client Secret:', config.google.clientSecret ? 'PRESENTE (lunghezza: ' + config.google.clientSecret.length + ')' : 'MANCANTE');
console.log('Callback URL:', config.google.callbackURL);
console.log('Client ID è valido?', config.google.clientID && config.google.clientID.includes('.apps.googleusercontent.com'));

// Debug: verifica configurazione GitHub
console.log('🔍 Debug GitHub OAuth2:');
console.log('Client ID:', config.github.clientID);
console.log('Client Secret:', config.github.clientSecret ? 'PRESENTE (lunghezza: ' + config.github.clientSecret.length + ')' : 'MANCANTE');
console.log('Callback URL:', config.github.callbackURL);

// Strategia Google OAuth2
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
      // Aggiorna informazioni utente
      existingUser.lastLogin = new Date();
      existingUser.accessToken = accessToken;
      return done(null, existingUser);
    }

    // Crea nuovo utente
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

// Strategia GitHub OAuth2
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

// Middleware per autenticazione JWT
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

// Middleware per verificare se l'utente è autenticato
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Accesso non autorizzato' });
};

// Routes principali
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>OAuth2/OpenID Login</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .login-btn { display: inline-block; padding: 10px 20px; margin: 10px; text-decoration: none; color: white; border-radius: 5px; }
          .google { background-color: #4285f4; }
          .github { background-color: #333; }
          .user-info { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>Sistema di Login Federato OAuth2/OpenID</h1>
        ${req.user ? `
          <div class="user-info">
            <h2>Benvenuto, ${req.user.name}!</h2>
            <img src="${req.user.avatar}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%;">
            <p>Email: ${req.user.email}</p>
            <p>Provider: ${req.user.provider}</p>
            <p>Ultimo accesso: ${req.user.lastLogin}</p>
            <a href="/logout">Logout</a>
          </div>
        ` : `
          <p>Effettua il login usando uno dei provider OAuth2:</p>
          <a href="/auth/google" class="login-btn google">Login con Google</a>
          <a href="/auth/github" class="login-btn github">Login con GitHub</a>
        `}
      </body>
    </html>
  `);
});

// Routes OAuth2
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    // Genera JWT token
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
    
    // Salva token nella sessione per uso futuro
    req.session.jwtToken = token;
    console.log('✅ Login Google riuscito per:', req.user.email);
    res.redirect('/');
  }
);

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

// Pagina di errore login
app.get('/login', (req, res) => {
  const error = req.query.error;
  let errorMessage = '';
  
  if (error === 'google') {
    errorMessage = 'Errore durante il login con Google. Verifica la configurazione OAuth2.';
  } else if (error === 'github') {
    errorMessage = 'Errore durante il login con GitHub. Verifica la configurazione OAuth2.';
  }
  
  res.send(`
    <html>
      <head>
        <title>Errore Login</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .login-btn { display: inline-block; padding: 10px 20px; margin: 10px; text-decoration: none; color: white; border-radius: 5px; }
          .google { background-color: #4285f4; }
          .github { background-color: #333; }
        </style>
      </head>
      <body>
        <h1>Errore di Login</h1>
        ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
        <p>Riprova con uno dei provider OAuth2:</p>
        <a href="/auth/google" class="login-btn google">Login con Google</a>
        <a href="/auth/github" class="login-btn github">Login con GitHub</a>
        <br><br>
        <a href="/">← Torna alla Home</a>
      </body>
    </html>
  `);
});

// API Routes
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

app.get('/api/token', ensureAuthenticated, (req, res) => {
  res.json({ 
    token: req.session.jwtToken,
    expiresIn: config.jwt.expiresIn
  });
});

// Route protetta con JWT
app.get('/api/protected', authenticateJWT, (req, res) => {
  res.json({ 
    message: 'Accesso autorizzato alla risorsa protetta',
    user: req.user
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Errore durante il logout' });
    }
    req.session.destroy();
    res.redirect('/');
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Avvio server
app.listen(PORT, () => {
  console.log(`Server in esecuzione su http://localhost:${PORT}`);
  console.log('Configurazione OAuth2:');
  console.log(`- Google: ${config.google.clientID ? 'Configurato' : 'Non configurato'}`);
  console.log(`- GitHub: ${config.github.clientID ? 'Configurato' : 'Non configurato'}`);
});

module.exports = app;
