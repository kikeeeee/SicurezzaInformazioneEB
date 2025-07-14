// server.js - OAuth2/OpenID Connect Login System con UI migliorata
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

// Funzione per generare CSS e HTML migliorato
const getStyles = () => `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }
    
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 500px;
      width: 90%;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    
    .logo {
      font-size: 3em;
      margin-bottom: 20px;
      color: #667eea;
    }
    
    h1 {
      font-size: 2.2em;
      margin-bottom: 10px;
      color: #2c3e50;
      font-weight: 600;
    }
    
    .subtitle {
      color: #7f8c8d;
      font-size: 1.1em;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    
    .login-section {
      margin: 30px 0;
    }
    
    .login-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 15px 30px;
      margin: 10px;
      text-decoration: none;
      color: white;
      border-radius: 50px;
      font-weight: 600;
      font-size: 1.1em;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      min-width: 200px;
    }
    
    .login-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
    
    .google {
      background: linear-gradient(45deg, #4285f4, #34a853);
    }
    
    .github {
      background: linear-gradient(45deg, #333, #24292e);
    }
    
    .icon {
      margin-right: 10px;
      font-size: 1.2em;
    }
    
    .user-info {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 30px;
      border-radius: 15px;
      margin: 20px 0;
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .user-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: block;
      border: 4px solid white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    
    .user-details {
      margin: 15px 0;
    }
    
    .user-details strong {
      color: #2c3e50;
      display: block;
      margin-bottom: 5px;
    }
    
    .logout-btn {
      background: linear-gradient(45deg, #e74c3c, #c0392b);
      color: white;
      padding: 12px 25px;
      border: none;
      border-radius: 25px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
    }
    
    .logout-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(231,76,60,0.4);
    }
    
    .error-container {
      background: #fff5f5;
      border: 2px solid #fed7d7;
      color: #c53030;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    
    .success-container {
      background: #f0fff4;
      border: 2px solid #9ae6b4;
      color: #276749;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    
    .exam-info {
      background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
      padding: 20px;
      border-radius: 15px;
      margin: 20px 0;
      color: #2d3436;
    }
    
    .exam-info h3 {
      margin-bottom: 10px;
      font-size: 1.3em;
    }
    
    .requirements {
      text-align: left;
      margin: 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    }
    
    .requirements ul {
      list-style: none;
      padding: 0;
    }
    
    .requirements li {
      padding: 5px 0;
      position: relative;
      padding-left: 25px;
    }
    
    .requirements li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #27ae60;
      font-weight: bold;
    }
    
    .provider-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 10px;
    }
    
    .provider-google {
      background: #4285f4;
      color: white;
    }
    
    .provider-github {
      background: #333;
      color: white;
    }
    
    @media (max-width: 600px) {
      .container {
        padding: 20px;
        margin: 20px;
      }
      
      h1 {
        font-size: 1.8em;
      }
      
      .login-btn {
        width: 100%;
        margin: 10px 0;
      }
    }
  </style>
`;

// Route principale - Homepage con schermata di login per esame
app.get('/', (req, res) => {
  if (req.user) {
    // Utente autenticato - mostra dashboard
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Sistema OAuth2</title>
        ${getStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">🎓</div>
          <h1>Accesso Confermato</h1>
          <p class="subtitle">Benvenuto nella dashboard del sistema di autenticazione federata</p>
          
          <div class="user-info">
            <img src="${req.user.avatar}" alt="Avatar" class="user-avatar">
            <h2>Ciao, ${req.user.name}!</h2>
            <div class="user-details">
              <strong>Email:</strong> ${req.user.email || 'Non fornita'}
            </div>
            <div class="user-details">
              <strong>Provider:</strong> ${req.user.provider}
              <span class="provider-badge provider-${req.user.provider}">${req.user.provider}</span>
            </div>
            <div class="user-details">
              <strong>Ultimo accesso:</strong> ${new Date(req.user.lastLogin).toLocaleString('it-IT')}
            </div>
            <div class="user-details">
              <strong>Registrato il:</strong> ${new Date(req.user.createdAt).toLocaleString('it-IT')}
            </div>
          </div>
          
          <div class="success-container">
            <h3>✅ Autenticazione Riuscita!</h3>
            <p>Hai effettuato l'accesso con successo tramite ${req.user.provider}. Il tuo JWT token è stato generato e salvato in sessione.</p>
          </div>
          
          <div class="exam-info">
            <h3>📚 Informazioni Sistema</h3>
            <p>Questo è un sistema di autenticazione federata OAuth2 che supporta login tramite Google e GitHub. Il sistema genera JWT token per l'accesso alle API protette.</p>
          </div>
          
          <a href="/logout" class="logout-btn">🚪 Logout</a>
        </div>
      </body>
      </html>
    `);
  } else {
    // Utente non autenticato - mostra schermata di login per esame
    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Richiesto - Sistema OAuth2</title>
        ${getStyles()}
      </head>
      <body>
        <div class="container">
          <div class="logo">🛂</div>
          <h1>Accesso Richiesto</h1>
          <p class="subtitle">Per accedere al sistema di autenticazione federata è necessario effettuare il login</p>
          
          <div class="exam-info">
            <h3>📋 Sistema di Autenticazione OAuth2</h3>
            <p>Questo sistema dimostra l'implementazione di autenticazione federata utilizzando provider OAuth2 esterni (Google e GitHub).</p>
          </div>
          
          <div class="requirements">
            <h3>📋 Funzionalità del Sistema:</h3>
            <ul>
              <li>Autenticazione tramite Google OAuth2</li>
              <li>Autenticazione tramite GitHub OAuth2</li>
              <li>Gestione sessioni sicure con Express Session</li>
              <li>Generazione e validazione JWT token</li>
              <li>API protette con middleware di autenticazione</li>
              <li>Interfaccia web responsive e moderna</li>
            </ul>
          </div>
          
          <div class="login-section">
            <h3>🔐 Scegli il Provider di Autenticazione:</h3>
            <a href="/auth/google" class="login-btn google">
              <span class="icon">🔍</span>
              Login con Google
            </a>
            <a href="/auth/github" class="login-btn github">
              <span class="icon">🐙</span>
              Login con GitHub
            </a>
          </div>
          
          <div class="requirements">
            <h3>ℹ️ Informazioni Tecniche:</h3>
            <ul>
              <li>Node.js + Express.js</li>
              <li>Passport.js per OAuth2</li>
              <li>JSON Web Tokens (JWT)</li>
              <li>Session management sicuro</li>
              <li>Database simulato in memoria</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `);
  }
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

// Pagina di errore login con interfaccia migliorata
app.get('/login', (req, res) => {
  const error = req.query.error;
  let errorMessage = '';
  
  if (error === 'google') {
    errorMessage = 'Errore durante il login con Google. Verifica la configurazione OAuth2 o riprova.';
  } else if (error === 'github') {
    errorMessage = 'Errore durante il login con GitHub. Verifica la configurazione OAuth2 o riprova.';
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Errore Login - Sistema OAuth2</title>
      ${getStyles()}
    </head>
    <body>
      <div class="container">
        <div class="logo">⚠️</div>
        <h1>Errore di Autenticazione</h1>
        <p class="subtitle">Si è verificato un problema durante il processo di login</p>
        
        ${errorMessage ? `
          <div class="error-container">
            <h3>❌ Errore</h3>
            <p>${errorMessage}</p>
          </div>
        ` : ''}
        
        <div class="requirements">
          <h3>🔧 Possibili Soluzioni:</h3>
          <ul>
            <li>Verifica che le credenziali OAuth2 siano configurate correttamente</li>
            <li>Controlla che gli URI di callback siano validi</li>
            <li>Assicurati che l'applicazione OAuth2 sia attiva</li>
            <li>Riprova il login tra qualche minuto</li>
          </ul>
        </div>
        
        <div class="login-section">
          <h3>🔄 Riprova il Login:</h3>
          <a href="/auth/google" class="login-btn google">
            <span class="icon">🔍</span>
            Login con Google
          </a>
          <a href="/auth/github" class="login-btn github">
            <span class="icon">🐙</span>
            Login con GitHub
          </a>
        </div>
        
        <a href="/" class="logout-btn">🏠 Torna alla Home</a>
      </div>
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
    user: req.user,
    timestamp: new Date().toISOString()
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

module.exports = app;