// WebGL renderer for the print gallery. A real depth buffer decides what is in front, so every browser and phone
// draws the same rooms (CSS 3D leaves that to each browser's layer sorting, which phones get wrong).
// Units are gallery-world.js px with y flipped: three.js y points up. Everything is unlit paper and pen lines.
import * as THREE from './three.module.min.js';
import { puppetPose } from './hero-motion.js';

const INK = '#4c555b', FRAME = '#303a40', PAPER = '#ffffff', MUTED = '#69767d', DASH = '#a8b1b7';
const MONO = (getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || '').trim() || 'monospace';
const rad = d => d * Math.PI / 180;

// A canvas texture drawn in world px at up to `res` texels per px, capped at `cap` texels a side.
function paint(w, h, draw, { res = 1.5, cap = 640, repeat = false } = {}) {
  const k = Math.min(res, cap / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
  const ctx = c.getContext('2d'), t = new THREE.CanvasTexture(c);
  ctx.scale(c.width / w, c.height / h); draw(ctx, w, h);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.redraw = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.scale(c.width / w, c.height / h); draw(ctx, w, h); t.needsUpdate = true; };
  return t;
}
const hatch = (ctx, x, y, w, h, step, color, angle = 135) => {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  const n = w + h, dir = angle === 135 ? 1 : -1;
  for (let o = -n; o < n; o += step) { ctx.moveTo(x + o, y + (dir > 0 ? 0 : h)); ctx.lineTo(x + o + h, y + (dir > 0 ? h : 0)); }
  ctx.stroke(); ctx.restore();
};
const write = (ctx, s, x, y, size, color = MUTED, align = 'center') => { ctx.font = `${size}px ${MONO}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
// Fit an image inside (contain) or over (cover) a box.
function drawImage(ctx, img, x, y, w, h, cover) {
  const k = (cover ? Math.max : Math.min)(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
function reserved(ctx, x, y, w, h, line1, line2) {
  ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = DASH; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
  const s = Math.max(0.6, Math.min(1.6, Math.min(w, h) / 160)), cy = y + h / 2;
  write(ctx, '+', x + w / 2, cy - 22 * s, 30 * s, '#6d8b8e'); write(ctx, line1, x + w / 2, cy + 6 * s, 10 * s); write(ctx, line2, x + w / 2, cy + 22 * s, 8 * s);
}

export function createGallery(host, world, onChange) {
  const { rooms, FLOOR, CEILING, DOOR_WIDTH, DOOR_HEIGHT, HALL, ROOM_W, ROOM_D, START, END, SCALE, PLINTH_H, obstacles, plinthSpots, roomWalls, hang, HALL_TONE } = world;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setClearColor(PAPER);
  renderer.domElement.className = 'gallery-canvas'; renderer.domElement.setAttribute('aria-hidden', 'true');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 5, 24000), aniso = renderer.capabilities.getMaxAnisotropy();
  const lineMat = new THREE.LineBasicMaterial({ color: INK }), solids = [], spinners = [], swingers = [], puppets = [], movies = [], prints = new Map();
  const mats = new Map(), once = (key, make) => mats.get(key) || (mats.set(key, make()), mats.get(key));
  // Surfaces sit a hair behind their own outlines, so pen lines never fight the paper.
  const basic = opt => new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...opt });
  const outline = (mesh, geo) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat); mesh.add(l); };

  const tall = FLOOR - CEILING, face = side => side === -1 ? 90 : -90;
  // A wall: CSS centre (x, y, z), facing rotateY(angle). Full-height walls carry the hatched skirting in their room's tone.
  function wall(w, h, x, y, z, angle, tone = '#7c8b91') {
    let map = null;
    if (h === tall) {
      const base = once('wall' + tone, () => paint(256, tall, (c, W, H) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, H); c.globalAlpha = 0.3; hatch(c, 0, H * 0.92, W, H * 0.08, 9, tone); }, { res: 1, repeat: true }));
      map = base.clone(); map.repeat.set(w / 256, 1); map.needsUpdate = true;
    }
    const geo = new THREE.PlaneGeometry(w, h), mesh = new THREE.Mesh(geo, basic({ color: PAPER, map, side: THREE.DoubleSide }));
    mesh.position.set(x, -y, z); mesh.rotation.y = rad(angle); outline(mesh, geo); scene.add(mesh); solids.push(mesh); return mesh;
  }
  function floor(w, d, x, z, up) {
    const key = up ? 'floor' : 'ceiling';
    const base = once(key, () => up
      ? paint(260, 260, (c, W, H) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, H); c.globalAlpha = 0.25; hatch(c, 0, 0, W, H, 16, '#a2b3b6'); c.globalAlpha = 1; c.fillStyle = '#657078'; c.fillRect(129, 0, 1, H); c.fillRect(259, 0, 1, H); }, { res: 1, repeat: true })
      : paint(60, 60, (c, W, H) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, H); c.globalAlpha = 0.19; hatch(c, 0, 0, W, H, 30, '#849397', 45); }, { res: 2, repeat: true }));
    const map = base.clone(); map.repeat.set(w / (up ? 260 : 60), d / (up ? 260 : 60)); map.anisotropy = aniso; map.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(w, d), mesh = new THREE.Mesh(geo, basic({ color: PAPER, map }));
    mesh.position.set(x, up ? -FLOOR : -CEILING, z); mesh.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; outline(mesh, geo); scene.add(mesh); solids.push(mesh);
  }
  // A flat sign or print: a textured plane, transparent where the canvas is.
  function card(tex, w, h, parent, x = 0, y = 0, z = 0, double = false) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: double ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function place(group, x, y, z, angle) { group.position.set(x, -y, z); group.rotation.y = rad(angle); scene.add(group); return group; }
  function photo(url, tex) { if (!url) return null; const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { tex.redraw(); onChange(); }; img.src = url; return img; }

  // ---- architecture ----
  floor(2 * HALL, START - END, 0, (START + END) / 2, true); floor(2 * HALL, START - END, 0, (START + END) / 2, false);
  wall(2 * HALL, tall, 0, 0, END, 0); wall(2 * HALL, tall, 0, 0, START, 180);
  // The far-wall sign. A world may bring its own (SIGN); `ink` turns it into a solid black block.
  const S = world.SIGN || { w: 320, h: 130, title: 'THE PRINT GALLERY', sub: 'Six rooms / real prints' }, k = S.h / 130;
  const sign = paint(S.w, S.h, (c, W, H) => { c.fillStyle = S.ink ? '#15181c' : PAPER; c.fillRect(0, 0, W, H); c.strokeStyle = S.ink ? '#15181c' : '#48575e'; c.strokeRect(0.5, 0.5, W - 1, H - 1); c.strokeStyle = S.ink ? '#f4f4f0' : '#a8b3b8'; c.strokeRect(6.5 * k, 6.5 * k, W - 13 * k, H - 13 * k);
    write(c, S.title, W / 2, 52 * k, 24 * k, S.ink ? '#ffffff' : '#283239'); write(c, S.sub, W / 2, 86 * k, 14 * k, S.ink ? '#c9ced2' : '#6b858a'); });
  card(sign, S.w, S.h, place(new THREE.Group(), 0, -90 - (S.h - 130) / 2, END + 20, 0));
  const doors = [];
  for (const side of [-1, 1]) {
    let start = START;
    for (const r of rooms.filter(r => r.side === side).sort((a, b) => b.cz - a.cz)) {
      const end = r.cz + DOOR_WIDTH / 2, top = FLOOR - DOOR_HEIGHT;
      wall(start - end, tall, side * HALL, 0, (start + end) / 2, face(side)); start = r.cz - DOOR_WIDTH / 2;
      wall(DOOR_WIDTH, top - CEILING, side * HALL, (top + CEILING) / 2, r.cz, face(side));
      for (const dz of [-DOOR_WIDTH / 2, DOOR_WIDTH / 2]) wall(30, DOOR_HEIGHT, side * (HALL + 15), FLOOR - DOOR_HEIGHT / 2, r.cz + dz, 0);
      const label = paint(260, 46, (c, W, H) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, H); c.strokeStyle = '#48575e'; c.strokeRect(0.5, 0.5, W - 1, H - 1); write(c, r.name, W / 2, H / 2, 16, '#283239'); });
      card(label, 260, 46, place(new THREE.Group(), side * (HALL - 18), top - 60, r.cz, face(side)));
      // The doorway itself: invisible, but it takes a click and leads into the room.
      const door = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      door.position.set(side * (HALL - 20), -(FLOOR - DOOR_HEIGHT / 2), r.cz); door.rotation.y = rad(face(side)); door.userData.room = r.id; scene.add(door); doors.push(door);
      floor(ROOM_W, ROOM_D, r.cx, r.cz, true); floor(ROOM_W, ROOM_D, r.cx, r.cz, false);
      wall(ROOM_D, tall, side * (HALL + ROOM_W), 0, r.cz, face(side), r.tone);
      wall(ROOM_W, tall, r.cx, 0, r.cz - ROOM_D / 2, 0, r.tone); wall(ROOM_W, tall, r.cx, 0, r.cz + ROOM_D / 2, 180, r.tone);
    }
    wall(start - END, tall, side * HALL, 0, (start + END) / 2, face(side), HALL_TONE);
  }

  // ---- work ----
  // A studio render that moves (inktober.json `sheet`: its frames in a grid) is stepped through by the clock, since a canvas
  // only has to draw an animated image's first frame; reduced motion holds the sheet's `still` frame.
  function cell(ctx, img, sh, n, x, y, w, h) {
    const cw = img.width / sh.cols, ch = img.height / sh.rows, k = Math.min(w / cw, h / ch), iw = cw * k, ih = ch * k;
    ctx.drawImage(img, (n % sh.cols) * cw, Math.floor(n / sh.cols) * ch, cw, ch, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  function frame(s, w, h, x, z, angle) {
    let img = null;
    const sh = s.sheet, movie = sh ? { n: sh.still ?? 0 } : null;
    const W = w + 24, H = h + 88, url = sh ? sh.src : s.photo, tex = paint(W, H, (c) => {
      c.globalAlpha = 1; c.strokeStyle = '#a5adb0'; c.strokeRect(3.5, 3.5, w + 9, h + 9);
      hatch(c, 16, 16, w + 4, h + 4, 5, '#89959a');
      c.fillStyle = PAPER; c.fillRect(8, 8, w, h); c.strokeStyle = FRAME; c.lineWidth = 2; c.strokeRect(9, 9, w - 2, h - 2); c.lineWidth = 1;
      if (img?.complete && img.naturalWidth) { if (sh) cell(c, img, sh, movie.n, 24, 24, w - 32, h - 32); else drawImage(c, img, 24, 24, w - 32, h - 32, false); } else reserved(c, 24, 24, w - 32, h - 32, ...(s.reserved || ['PRINT PHOTO', 'SPACE RESERVED']));
      if (s.mark === 'today') { c.strokeStyle = '#c33325'; c.lineWidth = 4; c.strokeRect(2, 2, w + 20, h + 20); c.lineWidth = 1; }
      c.fillStyle = PAPER; c.fillRect(8, h + 24, w, 46); c.fillStyle = '#aeb6bc'; c.fillRect(8, h + 26, w, 1);
      write(c, s.title, 8, h + 40, 11, '#47545c', 'left'); write(c, s.note || (url ? 'Physical print photograph' : 'Awaiting a print photograph'), 8, h + 56, 9, s.mark === 'today' ? '#c33325' : '#47545c', 'left');
    });
    img = photo(url, tex);
    const g = place(new THREE.Group(), x, -40, z, angle); card(tex, W, H, g, 4, -36, 0); g.userData.print = s.id; prints.set(s.id, g);
    if (sh) movies.push(Object.assign(movie, { g, tex, sh, ready: () => img?.complete && img.naturalWidth }));
  }
  function garland(set, wall) {
    const L = wall.len * 0.9, gap = 40, k = Math.min(SCALE, (L - gap * (set.length + 1)) / set.reduce((t, s) => t + s.frame.width, 0));
    // A paper doll rises above its peg (ears); drop the wire by the tallest reach so nothing meets the top of a wide view.
    const lift = Math.max(0, ...set.map(s => (s.reach || 0) * s.frame.width * k));
    const sag = 70, yAt = u => sag * (1 - (2 * u / L - 1) ** 2) + 20, top = CEILING + 150 + lift;
    const g = place(new THREE.Group(), wall.x, 0, wall.z, wall.angle), pts = [];
    for (let u = 0; u <= L; u += 10) pts.push(new THREE.Vector3(u - L / 2, -(top + yAt(u)), 0));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    const ws = set.map(s => s.frame.width * k), free = (L - ws.reduce((a, b) => a + b, 0)) / (set.length + 1);
    let x = free;
    set.forEach((s, i) => {
      const w = ws[i], h = s.frame.height * k, u = x + w / 2; x += w + free; let img = null;
      const tex = paint(w, h, c => { c.fillStyle = PAPER; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9d0d3'; c.strokeRect(0.5, 0.5, w - 1, h - 1); if (img?.complete && img.naturalWidth) drawImage(c, img, 0, 0, w, h, false); else reserved(c, 10, 10, w - 20, h - 20, 'PRINT PHOTO', 'SPACE RESERVED'); });
      if (!s.puppet) img = photo(s.photo, tex);
      const pivot = new THREE.Group(); pivot.position.set(u - L / 2, -(top + yAt(u)), 2); g.add(pivot);
      if (s.puppet) puppet(s, w, pivot, i); else card(tex, w, h, pivot, 0, -h / 2 - 4, 0, true);
      const peg = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 6), basic({ color: '#d9c7a4' })); peg.position.set(0, 0, 3); outline(peg, peg.geometry); pivot.add(peg);
      pivot.userData.print = s.id; pivot.userData.tilt = rad(((i * 37) % 7 - 3) * 0.8); pivot.userData.phase = i * 1.3; pivot.rotation.z = pivot.userData.tilt;
      swingers.push(pivot); prints.set(s.id, pivot);
    });
  }
  // A photographed paper doll cut into layers (print-photos/<set>/work/build_puppet.py): the peg holds it at its rig's
  // `peg` point and each part turns on its brad with the studio's own animal wiggle (hero-motion.js puppetPose);
  // the rig's `moves` limits which parts wiggle and `speed` slows the whole wiggle.
  function puppet(s, w, pivot, i) {
    const base = s.puppet.replace(/[^/]+$/, '');
    fetch(s.puppet).then(r => r.json()).then(rig => {
      const k = w / rig.size[0], W = rig.size[0] * k, H = rig.size[1] * k;
      const at = (x, y) => [(x - rig.peg[0]) * k, -(y - rig.peg[1]) * k];
      const layer = (src, parent, [ox, oy], z) => {
        const tex = new THREE.TextureLoader().load(base + src, onChange); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
        const [cx, cy] = at(rig.size[0] / 2, rig.size[1] / 2), m = card(tex, W, H, parent, cx - ox, cy - oy, z, true);
        m.material.alphaTest = 0.5; return m;
      };
      const joints = [], doll = new THREE.Group(); doll.rotation.z = -rad(rig.turn || 0); pivot.add(doll);   // turn: level a photo shot at a slant
      rig.parts.forEach((p, n) => {
        const o = at(...p.pivot), g = new THREE.Group(); g.position.set(o[0], o[1], 0); doll.add(g);
        layer(p.src, g, o, p.under ? -0.6 : 0.6 + 0.3 * n); if (!rig.moves || rig.moves.includes(p.key)) joints.push({ g, key: p.key });
      });
      layer(rig.body, doll, [0, 0], 0);
      puppets.push({ rig, joints, phase: i * 0.83 }); onChange();
    });
  }
  const FACE = { right: 0, left: 1, top: 2, front: 4, back: 5 };
  function plinth(s, at) {
    const w = s.box.width * SCALE, h = s.box.height * SCALE, d = s.box.depth * SCALE, pw = Math.max(w, d) + 90;
    obstacles.push({ x: at.x, z: at.z, r: pw * 0.75 + 40 });
    const g = place(new THREE.Group(), at.x, 0, at.z, -at.side * 90);
    const side = once('plinth-side', () => paint(64, 64, (c, W, H) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, H); c.globalAlpha = 0.6; hatch(c, 0, 0, W, H, 8, '#9aa7ab'); }, { res: 2, repeat: true }));
    const label = paint(pw, PLINTH_H, (c, W) => { c.fillStyle = PAPER; c.fillRect(0, 0, W, PLINTH_H); write(c, s.title, W / 2, 40, 12, '#47545c'); });
    const sideMap = side.clone(); sideMap.repeat.set(pw / 64, PLINTH_H / 64); sideMap.needsUpdate = true;
    const baseMats = [basic({ map: sideMap }), basic({ map: sideMap }), basic({ color: '#f6f7f7' }), basic({ color: PAPER }), basic({ map: label }), basic({ color: PAPER })];
    const base = new THREE.Mesh(new THREE.BoxGeometry(pw, PLINTH_H, pw), baseMats); base.position.y = -(FLOOR - PLINTH_H / 2); outline(base, base.geometry); g.add(base);
    const faces = [], boxMats = [];
    for (const n of ['right', 'left', 'top', 'bottom', 'front', 'back']) {
      if (n === 'bottom') { boxMats.push(basic({ color: PAPER })); continue; }
      const fw = n === 'left' || n === 'right' ? d : w, fh = n === 'top' ? d : h; let img = null;
      const tex = paint(fw, fh, c => { c.fillStyle = PAPER; c.fillRect(0, 0, fw, fh); if (img?.complete && img.naturalWidth) drawImage(c, img, 0, 0, fw, fh, true); else { if (n === 'top') { c.globalAlpha = 0.5; hatch(c, 0, 0, fw, fh, 10, '#c7d0d3', 45); c.globalAlpha = 1; } reserved(c, 8, 8, fw - 16, fh - 16, n.toUpperCase(), 'FACE PHOTO'); } c.strokeStyle = FRAME; c.lineWidth = 3; c.strokeRect(1.5, 1.5, fw - 3, fh - 3); });
      img = photo(s.faces?.[n], tex); boxMats.push(basic({ map: tex })); faces.push(n);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMats); box.position.y = -(FLOOR - PLINTH_H - h / 2 - 1); g.add(box);
    g.userData.print = s.id; prints.set(s.id, g); spinners.push(box);
  }
  const spots = new Map();
  function hangAll(all) {
    // A world with one hall (inktober-world.js) hangs its 'hall' works in order along the two long walls.
    if (world.hangHall) for (const h of world.hangHall(all.filter(s => s.room === 'hall'))) { frame(h.s, h.w, h.h, h.x, h.z, h.angle); spots.set(h.s.id, h); }
    for (const r of rooms) {
      const works = all.filter(s => s.room === r.id), pegged = works.filter(s => s.hang === 'peg'); let walls = roomWalls(r);
      if (pegged.length) { garland(pegged, walls.find(w => w.id === 'far')); walls = walls.filter(w => w.id !== 'far'); }
      const stands = works.filter(s => s.hang === 'plinth'); plinthSpots(r, stands.length).forEach((at, i) => plinth(stands[i], at));
      for (const h of hang(works.filter(s => !s.hang), walls)) frame(h.s, h.w, h.h, h.x, h.z, h.angle);
    }
  }

  // ---- view ----
  let width = 1, height = 1;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function resize(w, h, lens) {
    width = w; height = h; renderer.setSize(w, h, false);
    camera.fov = 2 * Math.atan(h / 2 / lens) * 180 / Math.PI; camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, 0.12 * h, w, h);   // shift lens: the horizon sits 38% down, so floors stay in view
    camera.updateProjectionMatrix();
  }
  function render(p, time = performance.now()) {
    camera.position.set(p.x, 0, p.z); camera.rotation.set(0, -rad(p.yaw), 0);
    if (!still.matches) {
      for (const b of spinners) b.rotation.y = time / 28000 * 2 * Math.PI;
      for (const s of swingers) s.rotation.z = s.userData.tilt + rad(1.5) * Math.sin(time / 6000 * Math.PI + s.userData.phase);
      for (const m of movies) { const n = Math.floor(time / 1000 * (m.sh.fps || 12)) % m.sh.frames; if (n !== m.n && m.ready()) { m.n = n; m.tex.redraw(); } }
      for (const p of puppets) { const pose = puppetPose(p.rig, (time / 1000 + p.phase) * (p.rig.speed || 1)); for (const j of p.joints) j.g.rotation.z = -rad((pose[j.key] || 0) * (p.rig.amp?.[j.key] ?? 1)); }
    }
    renderer.render(scene, camera);
  }
  // Moving pieces only need frames while one is close enough to see.
  const animating = p => !still.matches && [...spinners, ...swingers, ...movies.map(m => m.g)].some(o => { const v = o.getWorldPosition(new THREE.Vector3()); return o.visible && o.parent.visible && Math.hypot(v.x - p.x, v.z - p.z) < 4500; });
  const ray = new THREE.Raycaster(), pickable = () => [...solids, ...doors, ...[...prints.values()].filter(g => g.visible)];
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    for (const hit of ray.intersectObjects(pickable(), true)) {
      if (hit.object.isLine || hit.object.isLineSegments) continue;
      for (let o = hit.object; o; o = o.parent) { if (o.userData.print) return { print: o.userData.print }; if (o.userData.room) return { room: o.userData.room }; }
      return null;   // a wall or floor is in the way
    }
    return null;
  }
  const show = (id, on) => { const g = prints.get(id); if (g) g.visible = on; };
  return { hangAll, resize, render, animating, pick, show, spot: id => spots.get(id) };
}
