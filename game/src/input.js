// Keyboard + mouse input.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.forward = false; this.back = false;
    this.left = false; this.right = false;
    this.run = false;
    this.mouseDX = 0; this.mouseDY = 0;
    this.clicked = false;
    this.pressed = new Set(); // edge-triggered keys, consumed by the game
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys[e.key.toLowerCase()] = true;
      this.refresh();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.refresh();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.clicked = true;
    });
    document.addEventListener('mousemove', (e) => {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
  }
  refresh() {
    const k = this.keys;
    this.forward = !!(k.w || k.arrowup);
    this.back = !!(k.s || k.arrowdown);
    this.left = !!(k.a || k.arrowleft);
    this.right = !!(k.d || k.arrowright);
    this.run = !!k.shift;
  }
  take(key) {
    if (this.pressed.has(key)) { this.pressed.delete(key); return true; }
    return false;
  }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  consumeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }
}
