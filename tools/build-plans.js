#!/usr/bin/env node
/*
 * build-plans.js  —  plans/src/*.json (authored from a brochure page)  ->  plans/<id>.json + plans/index.json
 *
 * A spec describes ONE unit in brochure-image pixel coordinates:
 *   { id, brochure, page, name, type, facing, area_sft, northDeg, scale (mm per px), crop (source image info),
 *     rooms:[{id,name,mat,rect:[x0,y0,x1,y1] | poly:[[x,y],...], at?:[x,y]}],
 *     doors:[{x,y,axis:'h'|'v',w, hinge:'a'|'b', swing:1|-1, entry?}],   // axis = direction the wall runs
 *     wins:[{x,y,axis,w}], slides:[{x,y,axis,w}],
 *     furn:[[type,name,cx,cy,w_mm,d_mm,rot,color?]] }
 * Rooms are INTERIOR floor areas. Walls are generated in the gaps between rooms (and a ring around the outside),
 * so the author never has to trace wall outlines. Output is in mm, in the same shapes the viewer uses
 * (WALLS / WINS / DOORS / SLIDES / ROOMS / furniture).
 */
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'plans', 'src'), OUT = path.join(__dirname, '..', 'plans');
let R_INT = 5, R_EXT = 10;             // px: half-gap that still counts as an interior wall / outer wall thickness (set per spec from wall mm)

function inPoly(x, y, p){ let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++){ if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1]) + p[i][0]) c = !c; } return c; }
const rectPoly = ([x0,y0,x1,y1]) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];

function shift(spec){
  // Specs may be written in crop-relative pixels of a zoomed grid image: page = offset + disp / zoom.
  if (!spec.offset) return spec;
  const [ox, oy] = spec.offset, z = spec.zoom || 1, X = v => v / z + ox, Y = v => v / z + oy, P = p => [X(p[0]), Y(p[1])], sp = JSON.parse(JSON.stringify(spec));
  sp.rooms.forEach(r => { if (r.rect) r.rect = [X(r.rect[0]), Y(r.rect[1]), X(r.rect[2]), Y(r.rect[3])]; if (r.poly) r.poly = r.poly.map(P); if (r.at) r.at = P(r.at); });
  ['doors', 'gaps', 'wins', 'slides'].forEach(k => (sp[k] || []).forEach(o => { o.x = X(o.x); o.y = Y(o.y); o.w = o.w / z; }));
  (sp.furn || []).forEach(f => { f[2] = X(f[2]); f[3] = Y(f[3]); });
  delete sp.offset; delete sp.zoom; return sp;
}
function build(spec){
  spec = shift(spec);
  const s = spec.scale, M = 40;                                   // grid margin
  R_EXT = Math.max(4, Math.round((spec.wallExtMM || 233) / s)); R_INT = Math.max(2, Math.ceil((spec.wallIntMM || 115) / s / 2) + 1);
  const polys = spec.rooms.map(r => r.poly || rectPoly(r.rect));
  const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1]);
  const gx0 = Math.floor(Math.min(...xs)) - M, gy0 = Math.floor(Math.min(...ys)) - M;
  const W = Math.ceil(Math.max(...xs)) + M - gx0, H = Math.ceil(Math.max(...ys)) + M - gy0;
  const idx = (x, y) => y * W + x;
  // 1. room masks
  const masks = polys.map(p => {
    const m = new Uint8Array(W * H), bx = p.map(q => q[0]), by = p.map(q => q[1]);
    for (let y = Math.floor(Math.min(...by)); y < Math.ceil(Math.max(...by)); y++) for (let x = Math.floor(Math.min(...bx)); x < Math.ceil(Math.max(...bx)); x++)
      if (inPoly(x + .5, y + .5, p)) m[idx(x - gx0, y - gy0)] = 1;
    return m;
  });
  const isRoom = new Uint8Array(W * H); masks.forEach(m => { for (let i = 0; i < m.length; i++) if (m[i]) isRoom[i] = 1; });
  // 2. Chebyshev dilation (separable)
  const dilate = (m, r) => {
    const a = new Uint8Array(W * H), b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[idx(x,y)]) for (let k = Math.max(0, x-r); k <= Math.min(W-1, x+r); k++) a[idx(k,y)] = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[idx(x,y)]) for (let k = Math.max(0, y-r); k <= Math.min(H-1, y+r); k++) b[idx(x,k)] = 1;
    return b;
  };
  const near = new Uint8Array(W * H); masks.forEach(m => { const d = dilate(m, R_INT); for (let i = 0; i < d.length; i++) if (d[i]) near[i]++; });
  const walled = new Uint8Array(W * H); masks.forEach((m, i) => { if (!spec.rooms[i].noWall) for (let k = 0; k < m.length; k++) if (m[k]) walled[k] = 1; });
  const ring = dilate(walled, R_EXT);                              // rooms flagged noWall (balconies, sit-outs) get no enclosing wall
  const type = new Uint8Array(W * H);                              // 0 none, 1 interior, 2 exterior
  for (let i = 0; i < type.length; i++) if (ring[i] && !isRoom[i]) type[i] = near[i] >= 2 ? 1 : 2;
  // 2b. railings: a thin parapet along every open edge of a noWall room (balcony / sit-out), except where it meets the building
  const RAIL = 8;                                                    // px (~75 mm)
  const nearBuilding = dilate(walled, R_EXT + 3);
  spec.rooms.forEach((r, i) => {
    if (!r.noWall) return;
    const ringR = dilate(masks[i], RAIL);
    for (let k = 0; k < ringR.length; k++) if (ringR[k] && !isRoom[k] && !type[k] && !nearBuilding[k]) type[k] = 3;
  });
  // 3. openings: carve through the wall, remember the carved rect
  const carve = (o, tag) => {
    const horiz = o.axis === 'h', cx = Math.round(o.x - gx0), cy = Math.round(o.y - gy0), half = Math.round(o.w / 2);
    // find wall extent across the wall at the opening centre
    let n0 = horiz ? cy : cx, n1 = n0; const at = (a, n) => horiz ? type[idx(a, n)] : type[idx(n, a)], a0 = horiz ? cx : cy;
    // snap to nearest wall cell across a short search
    let found = -1; for (let d = 0; d <= 12 && found < 0; d++) for (const sgn of [1, -1]) { const n = (horiz ? cy : cx) + sgn*d; if (at(a0, n)) { found = n; break; } }
    if (found < 0){ console.warn(`  ! ${spec.id}: ${tag} at (${o.x},${o.y}) is not on a wall`); return null; }
    n0 = n1 = found; while (at(a0, n0 - 1)) n0--; while (at(a0, n1 + 1)) n1++;
    const e = type[horiz ? idx(a0, found) : idx(found, a0)];
    for (let a = a0 - half; a < a0 + half; a++) for (let n = n0; n <= n1; n++){ const i = horiz ? idx(a, n) : idx(n, a); type[i] = 0; }
    const rect = horiz ? [a0 - half + gx0, n0 + gy0, a0 + half + gx0, n1 + 1 + gy0] : [n0 + gx0, a0 - half + gy0, n1 + 1 + gx0, a0 + half + gy0];
    return {rect, ext: e === 2};
  };
  const mm = v => Math.round(v * s / 5) * 5;
  const R = r => r.map(mm);
  const doors = [], wins = [], slides = [];
  (spec.doors || []).forEach(d => {
    const c = carve(d, 'door'); if (!c) return;
    const [x0, y0, x1, y1] = c.rect, horiz = d.axis === 'h', sw = d.swing || 1, t = horiz ? y1 - y0 : x1 - x0, hing = (d.hinge || 'a') === 'a';
    let h, cdir, odir;
    if (horiz){ h = [hing ? x0 : x1, sw > 0 ? y1 : y0]; cdir = [hing ? 1 : -1, 0]; odir = [0, sw]; }
    else      { h = [sw > 0 ? x1 : x0, hing ? y0 : y1]; cdir = [0, hing ? 1 : -1]; odir = [sw, 0]; }
    doors.push({name: d.name || '', rect: R(c.rect), h: [mm(h[0]), mm(h[1])], c: cdir, o: odir, len: mm(d.w - 2), ...(d.entry ? {entry: true} : {})});
  });
  (spec.gaps || []).forEach(o => carve(o, 'opening'));            // doorless openings (open kitchen, arches)
  (spec.wins || []).forEach(o => { const c = carve(o, 'window'); if (c) wins.push(R(c.rect)); });
  (spec.slides || []).forEach(o => { const c = carve(o, 'slide'); if (c) slides.push({rect: R(c.rect), v: o.axis === 'v'}); });
  // 4. rectangles from the wall mask (merge identical vertical runs)
  const walls = [];
  let open = new Map();
  for (let y = 0; y <= H; y++){
    const row = []; let x = 0;
    if (y < H) while (x < W){ const t = type[idx(x, y)]; if (!t){ x++; continue; } let e = x; while (e < W && type[idx(e, y)] === t) e++; row.push([x, e, t]); x = e; }
    const next = new Map();
    row.forEach(([a, b, t]) => { const k = a + ':' + b + ':' + t, p = open.get(k); if (p){ p[3] = y + 1; next.set(k, p); open.delete(k); } else next.set(k, [a, y, b, y + 1, t]); });
    open.forEach(p => walls.push(p)); open = next;
  }
  const wallsMM = walls.map(([a, b, c, d, t]) => [...R([a + gx0, b + gy0, c + gx0, d + gy0]), t === 3 ? 'low' : t === 2 ? 'e' : 'n']);
  // 5. rooms / furniture
  const rooms = spec.rooms.map((r, i) => {
    const p = polys[i], bx = p.map(q => q[0]), by = p.map(q => q[1]);
    const at = r.at || [(Math.min(...bx) + Math.max(...bx)) / 2, (Math.min(...by) + Math.max(...by)) / 2];
    return {id: r.id, name: r.name, poly: p.map(q => [mm(q[0]), mm(q[1])]), mat: r.mat || 'tile800', at: [mm(at[0]), mm(at[1])], ...(r.dim ? {dim: r.dim} : {}), ...(r.noWall ? {outdoor: true} : {})};
  });
  const furniture = (spec.furn || []).map(([t, n, cx, cy, w, d, rot = 0, color]) => ({type: t, name: n, cx: mm(cx), cy: mm(cy), w, d, rot, ...(color ? {color} : {})}));
  const all = wallsMM.flatMap(w => [[w[0], w[1]], [w[2], w[3]]]);
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  const pad = 2600;
  return {
    id: spec.id, brochure: spec.brochure, page: spec.page, name: spec.name, type: spec.type, facing: spec.facing, area_sft: spec.area_sft, floor: spec.floor,
    project: spec.project, windowsConfidence: spec.windowsConfidence || 'traced', northDeg: spec.northDeg || 0, px: {scale: s, origin: [gx0, gy0], crop: spec.crop},
    bounds: {x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2*pad, h: y1 - y0 + 2*pad, pad}, center: [Math.round((x0 + x1)/2), Math.round((y0 + y1)/2)],
    walls: wallsMM, wins, doors, slides, rooms, furniture,
  };
}

if (require.main === module){
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json')).sort();
  const index = [];
  files.forEach(f => {
    const spec = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')), plan = build(spec);
    fs.writeFileSync(path.join(OUT, spec.id + '.json'), JSON.stringify(plan));
    index.push({id: plan.id, brochure: plan.brochure, project: plan.project, name: plan.name, type: plan.type, facing: plan.facing, area_sft: plan.area_sft, floor: plan.floor, file: plan.id + '.json', ...(fs.existsSync(path.join(OUT, 'img', plan.id + '.jpg')) ? {img: 'img/' + plan.id + '.jpg'} : {})});
    console.log(`${plan.id}: ${plan.walls.length} walls, ${plan.doors.length} doors, ${plan.wins.length} windows, ${plan.rooms.length} rooms, ${plan.furniture.length} furniture`);
  });
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
}
module.exports = {build};
