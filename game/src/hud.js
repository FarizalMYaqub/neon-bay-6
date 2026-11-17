// HUD: health, cash, wanted stars, clock, objective, speed, minimap, messages.
import { CITY } from './city.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cashval'),
      healthBar: document.getElementById('healthbar'),
      healthNum: document.getElementById('healthnum'),
      stars: document.getElementById('stars'),
      ammo: document.getElementById('ammo'),
      clock: document.getElementById('clocktime'),
      objLabel: document.getElementById('objlabel'),
      objText: document.getElementById('objtext'),
      speed: document.getElementById('speedval'),
      speedMode: document.getElementById('speedmode'),
      msg: document.getElementById('msg'),
      dialogue: document.getElementById('dialogue'),
      cross: document.getElementById('crosshair'),
      flash: document.getElementById('wantedflash'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.msgTimer = null;
    this.dialogueTimer = null;
  }
  show() { this.el.hud.classList.add('on'); }
  hide() { this.el.hud.classList.remove('on'); }

  update(state) {
    this.el.cash.textContent = state.cash;
    this.el.healthBar.style.width = Math.max(0, state.health) + '%';
    this.el.healthNum.textContent = 'HEALTH ' + Math.max(0, Math.round(state.health));
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < state.wanted ? '' : 'off'}">★</span>`;
    this.el.stars.innerHTML = stars;
    this.el.ammo.textContent = `PISTOL — AMMO ${state.ammo}  ·  F = PUNCH`;
    const mins = Math.floor(state.clockMinutes);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm}`;
    this.el.objLabel.textContent = state.missionLabel;
    this.el.objText.textContent = state.missionObjective;
    this.el.speed.textContent = Math.round(Math.abs(state.speedMph));
    this.el.speedMode.textContent = state.inCar ? 'DRIVING — ' + state.carName : 'ON FOOT';
    this.el.cross.style.display = state.inCar ? 'none' : 'block';
    this.el.flash.style.borderColor = state.wanted > 0
      ? `rgba(255,40,60,${0.25 + 0.2 * Math.sin(state.time * 6)})` : 'rgba(255,40,60,0)';
  }

  showMessage(text, ms) {
    this.el.msg.textContent = text;
    this.el.msg.style.display = 'block';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.el.msg.style.display = 'none'; }, ms || 2600);
  }
  showDialogue(html, ms) {
    this.el.dialogue.innerHTML = html;
    this.el.dialogue.style.display = 'block';
    clearTimeout(this.dialogueTimer);
    this.dialogueTimer = setTimeout(() => { this.el.dialogue.style.display = 'none'; }, ms || 7000);
  }

  // 2D top-down minimap: roads, sea, player, cars, police, mission marker.
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = 190, H = 190;
    const scale = W / (CITY.half * 2 + 60);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    ctx.fillStyle = '#0a1226';
    ctx.fillRect(0, 0, W, H);
    // Sea.
    ctx.fillStyle = '#0e4d6e';
    ctx.fillRect(0, toY(CITY.beachZ - 8), W, H - toY(CITY.beachZ - 8));
    // Roads.
    ctx.strokeStyle = '#3a4157';
    ctx.lineWidth = 4;
    for (let i = -4; i <= 4; i++) {
      const p = i * CITY.block;
      ctx.beginPath(); ctx.moveTo(toX(-CITY.half), toY(p)); ctx.lineTo(toX(CITY.half), toY(p)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(p), toY(-CITY.half)); ctx.lineTo(toX(p), toY(CITY.half)); ctx.stroke();
    }
    // Mission marker.
    if (state.missionTarget) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toX(state.missionTarget.x), toY(state.missionTarget.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toX(state.missionTarget.x), toY(state.missionTarget.z), 10 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Traffic.
    ctx.fillStyle = '#9fb4d8';
    for (const c of state.trafficCars) {
      ctx.fillRect(toX(c.x) - 2, toY(c.z) - 2, 4, 4);
    }
    // Police (red/blue).
    for (const c of state.policeCars) {
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(toX(c.x) - 3, toY(c.z) - 3, 6, 6);
    }
    // Player: white arrow.
    ctx.save();
    ctx.translate(toX(state.px), toY(state.pz));
    ctx.rotate(-state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#8fb8d8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', 4, 12);
  }
}
