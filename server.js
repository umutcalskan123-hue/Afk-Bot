const express = require('express');
const mineflayer = require('mineflayer');
const https = require('https');
const http = require('http');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let bot = null;
let antiAfkInterval = null;
let antiAfkState = false;
let autoReconnect = false;
let aimAssistState = false;
let aimAssistInterval = null;
let lastConnectionConfig = null;
let botLogs = [];

function log(msg) {
  const time = new Date().toLocaleTimeString();
  botLogs.unshift(`[${time}] ${msg}`);
  if (botLogs.length > 40) botLogs.pop();
}

// Anti-AFK Fonksiyonu
function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  antiAfkState = true;
  log("Anti-AFK aktif edildi.");
  
  let step = 0;
  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    
    bot.setControlState('jump', true);
    setTimeout(() => bot && bot.setControlState('jump', false), 300);

    const yaw = (step % 4) * (Math.PI / 2);
    bot.look(yaw, 0, true);

    bot.setControlState('forward', true);
    setTimeout(() => bot && bot.setControlState('forward', false), 600);

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

// Aim Assist (En Yakın Oyuncuya Kilitlenme)
function startAimAssist() {
  if (aimAssistInterval) clearInterval(aimAssistInterval);
  aimAssistState = true;
  log("🎯 Aim Assist başlatıldı.");

  aimAssistInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    const filter = (e) => e.type === 'player' && e.username !== bot.username;
    const target = bot.nearestEntity(filter);

    if (target) {
      const targetPos = target.position.offset(0, target.height, 0);
      bot.lookAt(targetPos);
    }
  }, 100);
}

function stopAimAssist() {
  if (aimAssistInterval) {
    clearInterval(aimAssistInterval);
    aimAssistInterval = null;
  }
  aimAssistState = false;
  log("🎯 Aim Assist durduruldu.");
}

function createMinecraftBot(config) {
  lastConnectionConfig = config;
  
  const options = {
    host: config.host,
    port: parseInt(config.port) || 25565,
    username: config.username
  };

  if (config.version && config.version.trim() !== "") {
    options.version = config.version.trim();
  }

  log(`${config.host}:${options.port} adresine (${config.username}) bağlanılıyor...`);

  try {
    bot = mineflayer.createBot(options);

    bot.on('spawn', () => {
      log("✅ Bot oyuna giriş yaptı!");
      if (antiAfkState) startAntiAfk();
      if (aimAssistState) startAimAssist();
    });

    bot.on('chat', (username, message) => {
      log(`💬 <${username}>: ${message}`);
    });

    bot.on('kicked', (reason) => {
      log(`⚠️ Sunucudan atıldı: ${reason}`);
    });

    bot.on('error', (err) => {
      log(`❌ Bağlantı hatası: ${err.message}`);
    });

    bot.on('end', () => {
      log("🔴 Bağlantı koptu.");
      stopAntiAfk();
      stopAimAssist();
      bot = null;

      if (autoReconnect && lastConnectionConfig) {
        log("🔄 5 saniye içinde otomatik tekrar bağlanılıyor...");
        setTimeout(() => {
          if (autoReconnect) createMinecraftBot(lastConnectionConfig);
        }, 5000);
      }
    });

  } catch (err) {
    log(`❌ Başlatma hatası: ${err.message}`);
  }
}

// Web Arayüzü
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Mineflayer Panel</title>
      <style>
        body { background: #121212; color: #fff; font-family: monospace; padding: 15px; max-width: 600px; margin: 0 auto; }
        .card { background: #1e1e1e; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #333; }
        input { width: 100%; padding: 10px; margin: 5px 0; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 4px; box-sizing: border-box; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
        button { padding: 10px; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; background: #333; color: #fff; }
        .btn-green { background: #00c853; }
        .btn-red { background: #d50000; }
        .btn-orange { background: #ff9100; }
        .btn-blue { background: #29b6f6; color: #000; }
        .btn-purple { background: #aa00ff; color: #fff; }
        .logs { background: #000; color: #00ff00; padding: 10px; height: 180px; overflow-y: auto; border-radius: 4px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h2>🎮 MC Bot Control Panel</h2>

      <div class="card">
        <h3>Sunucu Bağlantısı</h3>
        <input type="text" id="host" placeholder="IP Adresi" value="${lastConnectionConfig?.host || ''}">
        <input type="number" id="port" placeholder="Port" value="${lastConnectionConfig?.port || '25565'}">
        <input type="text" id="username" placeholder="Nick" value="${lastConnectionConfig?.username || ''}">
        <input type="text" id="version" placeholder="Sürüm (Örn: 1.16.5)" value="${lastConnectionConfig?.version || ''}">
        
        <div style="margin: 10px 0;">
          <label><input type="checkbox" id="autoConnectCheck" ${autoReconnect ? 'checked' : ''} onchange="toggleAutoReconnect(this.checked)"> Otomatik Düşünce Tekrar Bağlan</label>
        </div>

        <button class="btn-green" style="width:100%" onclick="connectBot()">Bağlan</button>
        <button class="btn-red" style="width:100%; margin-top:5px;" onclick="disconnectBot()">Bağlantıyı Kes</button>
      </div>

      <div class="card">
        <h3>Aksiyonlar & Modlar</h3>
        <div style="display:flex; gap:5px; margin-bottom:10px;">
          <button class="btn-orange" style="flex:1" onclick="apiCall('/anti-afk/start')">Anti-AFK Aç</button>
          <button class="btn-red" style="flex:1" onclick="apiCall('/anti-afk/stop')">Anti-AFK Kapat</button>
        </div>

        <div style="display:flex; gap:5px;">
          <button class="btn-purple" style="flex:1" onclick="apiCall('/aim/start')">🎯 Aim Assist Aç</button>
          <button class="btn-red" style="flex:1" onclick="apiCall('/aim/stop')">🎯 Aim Assist Kapat</button>
        </div>

        <h4>Manuel Kontrol</h4>
        <div class="grid">
          <div></div><button class="btn-blue" onclick="move('forward')">⬆️ İleri</button><div></div>
          <button class="btn-blue" onclick="move('left')">⬅️ Sol</button>
          <button class="btn-orange" onclick="move('jump')">🦘 Zıpla</button>
          <button class="btn-blue" onclick="move('right')">➡️ Sağ</button>
          <div></div><button class="btn-blue" onclick="move('back')">⬇️ Geri</button><div></div>
        </div>

        <input type="text" id="chatMsg" placeholder="Chat mesajı veya komut (/login vs.)">
        <button class="btn-green" style="width:100%" onclick="sendChat()">Gönder</button>
      </div>

      <div class="card">
        <h3>Konsol</h3>
        <div class="logs" id="logBox">Yükleniyor...</div>
      </div>

      <script>
        async function apiCall(url, data = {}) {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        function connectBot() {
          const host = document.getElementById('host').value;
          const port = document.getElementById('port').value;
          const username = document.getElementById('username').value;
          const version = document.getElementById('version').value;
          apiCall('/connect', { host, port, username, version });
        }

        function disconnectBot() { apiCall('/disconnect'); }
        function move(dir) { apiCall('/move', { dir }); }

        function sendChat() {
          const msg = document.getElementById('chatMsg').value;
          if(!msg) return;
          apiCall('/chat', { message: msg });
          document.getElementById('chatMsg').value = '';
        }

        function toggleAutoReconnect(status) {
          apiCall('/auto-reconnect', { status });
        }

        setInterval(async () => {
          const res = await fetch('/logs');
          const logs = await res.json();
          document.getElementById('logBox').innerHTML = logs.map(l => '<div>' + l + '</div>').join('');
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

// API Endpointleri
app.get('/logs', (req, res) => res.json(botLogs));

app.post('/connect', (req, res) => {
  if (bot) { bot.end(); stopAntiAfk(); stopAimAssist(); }
  createMinecraftBot(req.body);
  res.json({ status: 'ok' });
});

app.post('/disconnect', (req, res) => {
  autoReconnect = false;
  if (bot) { bot.quit(); bot = null; }
  stopAntiAfk();
  stopAimAssist();
  log("Bağlantı kullanıcı tarafından kesildi.");
  res.json({ status: 'ok' });
});

app.post('/auto-reconnect', (req, res) => {
  autoReconnect = req.body.status;
  log(`Otomatik tekrar bağlanma: ${autoReconnect ? 'AÇIK' : 'KAPALI'}`);
  res.json({ status: 'ok' });
});

app.post('/move', (req, res) => {
  const { dir } = req.body;
  if (bot) {
    if (dir === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => bot && bot.setControlState('jump', false), 400);
    } else {
      bot.setControlState(dir, true);
      setTimeout(() => bot && bot.setControlState(dir, false), 800);
    }
  }
  res.json({ status: 'ok' });
});

app.post('/anti-afk/start', (req, res) => { startAntiAfk(); res.json({ status: 'ok' }); });
app.post('/anti-afk/stop', (req, res) => { stopAntiAfk(); res.json({ status: 'ok' }); });

app.post('/aim/start', (req, res) => { startAimAssist(); res.json({ status: 'ok' }); });
app.post('/aim/stop', (req, res) => { stopAimAssist(); res.json({ status: 'ok' }); });

app.post('/chat', (req, res) => {
  if (bot && req.body.message) {
    bot.chat(req.body.message);
    log(`💬 [BİZ]: ${req.body.message}`);
  }
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Panel aktif: ${PORT}`);
  
  // Self-Ping
  setInterval(() => {
    const url = 'https://afk-bot-u09x.onrender.com';
    const requester = url.startsWith('https') ? https : http;
    
    requester.get(url, (res) => {
      console.log('Self-ping başarılı.');
    }).on('error', (err) => {
      console.log('Self-ping hatası:', err.message);
    });
  }, 4 * 60 * 1000);
});