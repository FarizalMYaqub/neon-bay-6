// HUD: health bar, cash, wanted stars, in-game clock, objective tracker,
// speed readout, and a live 2D minimap canvas (roads, player arrow,
// traffic dots, police dots, mission marker).
export class HUD {
  constructor() {
    this.el = {
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      cash: document.getElementById('cash'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      objective: document.getElementById('objective'),
      speed: document.getElementById('speed'),
      speedLabel: document.getElementById('speed-label'),
      dialogue: document.getElementById('dialogue'),
      ammo: document.getElementById('ammo'),
      hint: document.getElementById('hint'),
      flash: document.getElementById('flash'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._flashT = 0;
  }

  update(s) {
    const e = this.el;
    e.healthFill.style.width = Math.max(0, s.health) + '%';
    e.healthFill.style.background = s.health > 50 ? '#2ecc71' : s.health > 25 ? '#f39c12' : '#e74c3c';
    e.healthText.textContent = Math.ceil(s.health) + ' HP';
    e.cash.textContent = '$' + s.cash.toLocaleString('en-US');
    e.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
    e.stars.style.color = s.wanted > 0 ? '#ff4444' : '#888888';
    const hh = String(Math.floor(s.clockMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(s.clockMinutes % 60)).padStart(2, '0');
    e.clock.textContent = hh + ':' + mm;
    e.objective.textContent = s.objective;
    if (s.driving) {
      e.speed.textContent = Math.round(s.speedKmh) + ' km/h';
      e.speedLabel.textContent = 'SPEED';
    } else {
      e.speed.textContent = s.nearCar ? 'Press E to steal car' : '';
      e.speedLabel.textContent = s.nearCar ? 'CAR NEARBY' : '';
    }
    e.ammo.textContent = '🔫 ' + s.ammo + ' / ' + s.reserveAmmo + '  •  F punch  •  R reload';
    e.dialogue.textContent = s.dialogue || '';
    e.dialogue.style.display = s.dialogue ? 'block' : 'none';
    e.hint.textContent = s.hint || '';
    if (s.wantedFlash > this._flashT) {
      e.flash.style.opacity = '0.35';
      setTimeout(() => { e.flash.style.opacity = '0'; }, 120);
    }
    this._flashT = s.wantedFlash;
    this._drawMinimap(s);
  }

  _drawMinimap(s) {
    const c = this.mapCtx;
    const W = 180, H = 180;
    const toMap = (x, z) => [((x + 115) / 260) * W, ((z + 115) / 260) * H];
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(12, 12, 26, 0.85)';
    c.fillRect(0, 0, W, H);
    // Beach + sea.
    c.fillStyle = '#d9b380';
    c.fillRect(0, ((118 + 115) / 260) * H, W, 12);
    c.fillStyle = '#1c4d6e';
    c.fillRect(0, ((150 + 115) / 260) * H, W, H);
    // Roads.
    c.strokeStyle = '#666677';
    c.lineWidth = 3;
    for (const v of [-90, -60, -30, 0, 30, 60, 90]) {
      const [ax] = toMap(v, 0);
      c.beginPath(); c.moveTo(ax, 0); c.lineTo(ax, H); c.stroke();
      const [, ay] = toMap(0, v);
      c.beginPath(); c.moveTo(0, ay); c.lineTo(W, ay); c.stroke();
    }
    // Mission marker.
    if (s.missionTarget) {
      const [mx, my] = toMap(s.missionTarget.x, s.missionTarget.z);
      c.fillStyle = '#ffd23a';
      c.beginPath(); c.arc(mx, my, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke();
    }
    // Traffic dots.
    c.fillStyle = '#dddddd';
    for (const t of s.traffic) {
      const [tx, ty] = toMap(t.x, t.z);
      c.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    // Police dots.
    c.fillStyle = '#3388ff';
    for (const p of s.police) {
      const [px, py] = toMap(p.x, p.z);
      c.beginPath(); c.arc(px, py, 3.5, 0, Math.PI * 2); c.fill();
    }
    // Player arrow.
    const [px, py] = toMap(s.playerX, s.playerZ);
    c.save();
    c.translate(px, py);
    c.rotate(Math.PI - s.playerHeading);
    c.fillStyle = '#ff2d78';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    // North label.
    c.fillStyle = '#aaaaaa';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', 4, 13);
  }
}
