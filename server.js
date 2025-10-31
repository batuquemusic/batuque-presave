require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/test', (req, res) => {
  res.send('<h1>Servidor activo</h1>');
});

// 📥 Ruta para capturar email y redirigir a Spotify
app.post('/presave/:slug', (req, res) => {
  const email = req.body.email;
  const slug = req.params.slug;

  // Guarda el email en archivo por campaña
  fs.appendFileSync(`emails-${slug}.txt`, `${email}\n`);

  // Redirige al flujo OAuth de Spotify
  const scope = 'user-library-modify';
  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${process.env.REDIRECT_URI}&state=${slug}`;
  res.redirect(authURL);
});

// 🔁 Callback de Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const slug = req.query.state;

  try {
    const tokenRes = await axios.post('https://accounts.spotify.com/api/token', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;

    // Aquí puedes guardar el track en la biblioteca del usuario si tienes el track ID
    // Ejemplo: await axios.put('https://api.spotify.com/v1/me/tracks', { ids: ['TRACK_ID'] }, { headers: { Authorization: `Bearer ${accessToken}` } });

    res.send(`<h2>✅ Pre-save successful for ${slug}!</h2><p>Thanks for supporting Batuque Music.</p>`);
  } catch (err) {
    console.error(err);
    res.send(`<h2>❌ Error during pre-save</h2><p>Please try again later.</p>`);
  }
});

// 🧩 Ruta para servir la landing por slug
app.get('/pre-save/:slug', (req, res) => {
  const slug = req.params.slug;
  const filePath = path.join(__dirname, 'public', 'templates', `${slug}.html`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Landing not found');
  }
});

// 🚀 Inicio del servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
