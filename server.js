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
    // 1. Intercambiar el code por un access token
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

    // 2. Buscar el ISRC por slug (ejemplo: easy-as-that → DEAR42506344)
    const isrcMap = {
      'easy-as-that': 'DEAR42506344',
      // Podés agregar más campañas acá
    };

    const isrc = isrcMap[slug];

    if (!isrc) {
      return res.send(`<h2>❌ ISRC not found for slug: ${slug}</h2>`);
    }

    // 3. Buscar el track en Spotify usando el ISRC
    const searchRes = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: `isrc:${isrc}`,
        type: 'track'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const track = searchRes.data.tracks.items[0];

    if (!track) {
      return res.send(`<h2>❌ Track not found for ISRC: ${isrc}</h2>`);
    }

    const trackId = track.id;

    // 4. Guardar el track en la biblioteca del usuario
    await axios.put('https://api.spotify.com/v1/me/tracks', {
      ids: [trackId]
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    // 5. Confirmación visual
    res.send(`
      <h2>✅ Pre-save successful!</h2>
      <p>Thanks for supporting Batuque Music.</p>
      <p>Track: ${track.name} by ${track.artists.map(a => a.name).join(', ')}</p>
    `);

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
