const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Arayüz ve CMD Kontrol Paneli
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Render Terminal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #121212; color: #00ff00; font-family: monospace; padding: 20px; }
        input { width: 80%; padding: 10px; background: #222; color: #fff; border: 1px solid #444; }
        button { padding: 10px 15px; background: #00ff00; color: #000; border: none; font-weight: bold; cursor: pointer; }
        pre { background: #000; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; color: #fff; }
      </style>
    </head>
    <body>
      <h2>> Render Web Terminal</h2>
      <form action="/run" method="POST">
        <input type="text" name="command" placeholder="Komut yaz (örn: ls, pwd, node -v)" required autofocus />
        <button type="submit">Çalıştır</button>
      </form>
      <h3>Çıktı:</h3>
      <pre>${req.query.output || 'Henüz komut çalıştırılmadı.'}</pre>
    </body>
    </html>
  `);
});

// Komutu CMD / Terminal Üzerinde Çalıştırma
app.post('/run', (req, res) => {
  const command = req.body.command;
  exec(command, (error, stdout, stderr) => {
    let result = stdout || stderr || error?.message || 'Komut çalıştırıldı.';
    res.redirect('/?output=' + encodeURIComponent(result));
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Terminal aktif!'));