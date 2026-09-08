const express = require('express');
const mineflayer = require('mineflayer');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let bot = null;
let antiAfkInterval = null;
let antiAfkState = false;
let botLogs = [];

function log(msg) {
  const time = new Date().toLocaleTimeString();
  botLogs.unshift(`[${time}] ${msg}`);
  if (botLogs.length > 30) botLogs.pop();
}

// Anti-AFK Fonksiyonu (Dairesel hareket ve zıplama)
function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  antiAfkState = true;
  log("Anti-AFK başlatıldı.");
  
  let step = 0;
  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    
    // Zıplama & Etrafa Bakma & İleri/Geri Adım
    bot.setControlState('jump', true);
    setTimeout(() => bot && bot.setControlState('jump', false), 400);

    const yaw = (step % 4) * (Math.PI / 2);
    bot.look(yaw, 0, true);

    bot.setControlState('forward', true);
    setTimeout(() => bot && bot.setControlState('forward', false), 800);

    step++;
  }, 4000);
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
  antiAfkState = false;
  if (bot) bot.clearControlStates();
  log("Anti-AFK durduruldu.");
}

// Web Arayüzü (HTML + CSS + JS)
app.get('/', (req, res) => {
  const isConnected = bot ? true : false;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Minecraft Bot Control Panel</title>
      <style>
        body { background: #121212; color: #fff; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { color: #00ff88; text-align: center; }
        .card { background: #1e1e1e; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #333; }
        input, select { width: 100%; padding: 10px; margin: 8px 0; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 5px; box-sizing: border-box; }
        .btn-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
        button { padding: 12px; font-weight: bold; border: none; border-radius: 5px; cursor: pointer; transition: 0.2s; }
        .btn-green { background: #00c853; color: white; }
        .btn-red { background: #d50000; color: white; }
        .btn-blue { background: #29b6f6; color: white; }
        .btn-orange { background: #ff9100; color: white; }
        button:hover { opacity: 0.8; }
        .status { font-weight: bold; color: ${isConnected ? '#00ff88' : '#ff4444'}; }
        .logs { background: #000; color: #00ff00; padding: 15px; height: 180px; overflow-y: auto; font-family: monospace; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🎮 Mineflayer Bot Kontrol Paneli</h1>
      
      <div class="card">
        <h3>Sunucu Bağlantısı (<span class="status">${isConnected ? 'BAĞLI' : 'BAĞLI DEĞİL'}</span>)</h3>
        <form action="/connect" method="POST">
          <input type="text" name="host" placeholder="Sunucu IP (Örn: play.hypixel.net veya localhost)" required />
          <input type="number" name="port" placeholder="Port (Varsayılan: 25565)" value="25565" required />
          <input type="text" name="username" placeholder="Bot Nick (Örn: AFK_Bot_724)" required />
          <input type="text" name="version" placeholder="Sürüm (Örn: 1.16.5, 1.20.1 veya boş bırakın)" />
          <button type="submit" class="btn-green" style="width:100%">Sunucuya Bağlan</button>
        </form>
        ${isConnected ? `
          <form action="/disconnect" method="POST" style="margin-top:10px;">
            <button type="submit" class="btn-red" style="width:100%">Bağlantıyı Kes</button>
          </form>
        ` : ''}
      </div>

      ${isConnected ? `
      <div class="card">
        <h3>🕹️ Bot Hareket & Anti-AFK Kontrolleri</h3>
        <p>Anti-AFK Durumu: <b>${antiAfkState ? '🟢 AÇIK' : '🔴 KAPALI'}</b></p>
        
        <div style="display:flex; gap:10px; margin-bottom:15px;">
          <form action="/anti-afk/start" method="POST" style="flex:1"><button class="btn-orange" style="width:100%">Anti-AFK Başlat</button></form>
          <form action="/anti-afk/stop" method="POST" style="flex:1"><button class="btn-red" style="width:100%">Anti-AFK Durdur</button></form>
        </div>

        <h4>Manuel Yön Kontrolü:</h4>
        <div class="btn-grid">
          <div></div>
          <form action="/move" method="POST"><input type="hidden" name="dir" value="forward"><button class="btn-blue" style="width:100%">⬆️ İleri</button></form>
          <div></div>
          
          <form action="/move" method="POST"><input type="hidden" name="dir" value="left"><button class="btn-blue" style="width:100%">⬅️ Sol</button></form>
          <form action="/move" method="POST"><input type="hidden" name="dir" value="jump"><button class="btn-orange" style="width:100%">🦘 Zıpla</button></form>
          <form action="/move" method="POST"><input type="hidden" name="dir" value="right"><button class="btn-blue" style="width:100%">➡️ Sağ</button></form>
          
          <div></div>
          <form action="/move" method="POST"><input type="hidden" name="dir" value="back"><button class="btn-blue" style="width:100%">⬇️ Geri</button></form>
          <div></div>
        </div>

        <h4 style="margin-top:15px;">💬 Oyuna Chat Mesajı Gönder:</h4>
        <form action="/chat" method="POST">
          <input type="text" name="message" placeholder="Mesajınız..." required />
          <button type="submit" class="btn-green" style="width:100%">Gönder</button>
        </form>
      </div>
      ` : ''}

      <div class="card">
        <h3>📜 Canlı Konsol Logları</h3>
        <div class="logs">
          ${botLogs.map(l => `<div>${l}</div>`).join('')}
        </div>
      </div>
    </body>
    </html>
  `);
});

// Bağlantı İsteği
app.post('/connect', (req, res) => {
  const { host, port, username, version } = req.body;
  
  if (bot) {
    bot.end();
    stopAntiAfk();
  }

  log(`${host}:${port} adresine ${username} nickiyle bağlanılıyor...`);

  const options = {
    host: host,
    port: parseInt(port) || 25565,
    username: username
  };

  if (version && version.trim() !== "") {
    options.version = version.trim();
  }

  try {
    bot = mineflayer.createBot(options);

    bot.on('spawn', () => {
      log("✅ Bot sunucuya başarıyla doğdu (spawn oldu)!");
    });

    bot.on('chat', (username, message) => {
      log(`💬 [CHAT] <${username}>: ${message}`);
    });

    bot.on('kicked', (reason) => {
      log(`⚠️ Sunucudan atıldı: ${reason}`);
      stopAntiAfk();
      bot = null;
    });

    bot.on('error', (err) => {
      log(`❌ Hata oluştu: ${err.message}`);
    });

    bot.on('end', () => {
      log("🔴 Sunucu bağlantısı kesildi.");
      stopAntiAfk();
      bot = null;
    });

  } catch (err) {
    log(`❌ Bağlantı hatası: ${err.message}`);
  }

  res.redirect('/');
});

// Bağlantıyı Kes
app.post('/disconnect', (req, res) => {
  if (bot) {
    bot.quit();
    bot = null;
    stopAntiAfk();
    log("Bot elle bağlantıyı kesti.");
  }
  res.redirect('/');
});

// Hareket Yönlendirme
app.post('/move', (req, res) => {
  const { dir } = req.body;
  if (bot) {
    if (dir === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => bot && bot.setControlState('jump', false), 500);
    } else {
      bot.setControlState(dir, true);
      setTimeout(() => bot && bot.setControlState(dir, false), 1000);
    }
  }
  res.redirect('/');
});

// Anti-AFK
app.post('/anti-afk/start', (req, res) => {
  startAntiAfk();
  res.redirect('/');
});

app.post('/anti-afk/stop', (req, res) => {
  stopAntiAfk();
  res.redirect('/');
});

// Chat Mesajı
app.post('/chat', (req, res) => {
  const { message } = req.body;
  if (bot && message) {
    bot.chat(message);
    log(`💬 [BİZ]: ${message}`);
  }
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Panel çalışıyor: http://localhost:${PORT}`));