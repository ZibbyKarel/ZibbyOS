/* Zibby orb — drátěná (síťovaná) koule na canvas 2D.
   Mřížka rovnoběžek a poledníků, organicky deformovaná šumem; gradient přes celou kouli, záře na okraji,
   tečky v uzlech a oblak částic kolem. Každý <canvas class="zorb" data-st="…" data-size="…"> se kreslí
   jedním sdíleným rAF cyklem; stav se čte z data-st, parametry i barvy se mezi stavy plynule interpolují. */
(function () {
  if (window.ZOrb) return;
  var C = {
    sleep: [
      [71, 85, 105],
      [100, 116, 139],
      [148, 163, 184],
    ],
    ready: [
      [37, 99, 235],
      [139, 92, 246],
      [217, 70, 239],
    ],
    wake: [
      [245, 165, 36],
      [244, 114, 182],
      [167, 139, 250],
    ],
    listen: [
      [56, 189, 248],
      [99, 102, 241],
      [125, 211, 252],
    ],
    think: [
      [139, 92, 246],
      [217, 70, 239],
      [99, 102, 241],
    ],
    search: [
      [14, 165, 233],
      [56, 189, 248],
      [165, 243, 252],
    ],
    work: [
      [99, 102, 241],
      [167, 139, 250],
      [56, 189, 248],
    ],
    speak: [
      [245, 158, 11],
      [244, 114, 182],
      [167, 139, 250],
    ],
    needs: [
      [245, 165, 36],
      [251, 146, 60],
      [253, 224, 71],
    ],
    done: [
      [16, 185, 129],
      [52, 211, 153],
      [167, 243, 208],
    ],
    error: [
      [225, 29, 72],
      [251, 113, 133],
      [190, 18, 60],
    ],
    paused: [
      [75, 85, 99],
      [107, 114, 128],
      [156, 163, 175],
    ],
  };
  var BASE = {
    spin: 0.25,
    scale: 1,
    amp: 0.07,
    freq: 1,
    speed: 1,
    twist: 0,
    wave: 0,
    pulse: 0,
    lineA: 0.75,
    glow: 0.6,
    halo: 0.6,
    burst: 0,
    band: 0,
    sats: 0,
    ring: 0,
    bob: 0,
    jitter: 0,
    sweep: 0,
    sparse: 0,
  };
  var S = {
    sleep: { spin: 0.08, scale: 0.8, amp: 0.03, speed: 0.35, lineA: 0.35, glow: 0.2, halo: 0.15 },
    ready: { spin: 0.22, amp: 0.07, speed: 0.8, lineA: 0.75, glow: 0.6, halo: 0.6 },
    wake: {
      spin: 1.6,
      scale: 1.06,
      amp: 0.16,
      freq: 1.4,
      speed: 3,
      twist: 0.6,
      lineA: 0.9,
      glow: 1,
      halo: 1,
      burst: 1,
    },
    listen: { spin: 0.3, amp: 0.05, speed: 1, wave: 0.045, lineA: 0.8, glow: 0.7, halo: 0.75 },
    think: {
      spin: 0.9,
      amp: 0.1,
      freq: 1.15,
      speed: 2.2,
      twist: 1.1,
      lineA: 0.85,
      glow: 0.8,
      halo: 0.8,
    },
    search: {
      spin: 0.4,
      scale: 0.96,
      amp: 0.04,
      speed: 0.7,
      band: 1,
      lineA: 0.55,
      glow: 0.55,
      halo: 0.5,
    },
    work: {
      spin: 0.55,
      scale: 0.84,
      amp: 0.06,
      speed: 1.2,
      sats: 1,
      lineA: 0.7,
      glow: 0.6,
      halo: 0.45,
    },
    speak: { spin: 0.35, amp: 0.06, speed: 1.4, pulse: 0.1, lineA: 0.85, glow: 0.8, halo: 0.8 },
    needs: { spin: 0.25, amp: 0.07, speed: 1, ring: 1, bob: 1, lineA: 0.85, glow: 0.85, halo: 0.7 },
    done: {
      spin: 0.16,
      scale: 0.96,
      amp: 0.005,
      speed: 0.4,
      sweep: 1,
      lineA: 0.75,
      glow: 0.6,
      halo: 0.4,
    },
    error: {
      spin: 0.6,
      amp: 0.1,
      freq: 1.6,
      speed: 2,
      jitter: 1,
      lineA: 0.75,
      glow: 0.7,
      halo: 0.5,
    },
    paused: {
      spin: 0,
      scale: 0.88,
      amp: 0.04,
      speed: 0,
      lineA: 0.35,
      glow: 0.15,
      halo: 0.1,
      sparse: 1,
    },
  };
  var KEYS = Object.keys(BASE);
  function target(st) {
    var o = {},
      s = S[st] || S.ready;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      o[k] = s[k] != null ? s[k] : BASE[k];
    }
    return o;
  }
  function mix(a, b, f) {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function rgba(c, a) {
    return (
      "rgba(" +
      (c[0] | 0) +
      "," +
      (c[1] | 0) +
      "," +
      (c[2] | 0) +
      "," +
      (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) +
      ")"
    );
  }
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  var HALO = {};
  function halo(m) {
    if (HALO[m]) return HALO[m];
    var a = [];
    for (var i = 0; i < m; i++) {
      var u = hash(i * 3.1) * 2 - 1,
        ph = hash(i * 7.7) * 6.2832,
        r = Math.sqrt(1 - u * u);
      a.push([
        Math.cos(ph) * r,
        u,
        Math.sin(ph) * r,
        1.04 + Math.pow(hash(i * 1.3), 2.2) * 0.42,
        hash(i * 9.9) * 6.2832,
      ]);
    }
    return (HALO[m] = a);
  }
  var STATE = new WeakMap();
  var reduce = !!(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  var last = performance.now();

  function draw(cv, dt, T) {
    var rect = cv.getBoundingClientRect();
    if (
      !rect.width ||
      rect.bottom < -80 ||
      rect.top > innerHeight + 80 ||
      rect.right < -80 ||
      rect.left > innerWidth + 80
    )
      return;
    var size = +cv.dataset.size || 64,
      st = cv.dataset.st || "ready",
      dpr = Math.min(2, window.devicePixelRatio || 1);
    var pw = Math.round(size * 1.8 * dpr);
    if (cv.width !== pw) {
      cv.width = pw;
      cv.height = pw;
    }
    var tg = target(st),
      col = C[st] || C.ready,
      s = STATE.get(cv);
    if (!s) {
      s = {
        p: target(st),
        c: col.map(function (x) {
          return x.slice();
        }),
        rot: hash(size) * 6,
        t: hash(size + 3) * 40,
        nt: 0,
        st: st,
        since: T,
        trail: [[], [], []],
      };
      STATE.set(cv, s);
    }
    if (s.st !== st) {
      s.st = st;
      s.since = T;
    }
    var k = 1 - Math.exp(-dt * (reduce ? 60 : 3.2)),
      i,
      j;
    for (i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      s.p[key] += (tg[key] - s.p[key]) * k;
    }
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) s.c[i][j] += (col[i][j] - s.c[i][j]) * k;
    var P = s.p,
      mv = reduce ? 0 : 1;
    s.t += dt * mv;
    s.nt += dt * P.speed * mv;
    s.rot += dt * P.spin * mv;
    var t = s.t,
      nt = s.nt,
      age = T - s.since;
    var light = !!(cv.closest && cv.closest('[data-theme="light"]'));
    var cc = light
      ? s.c.map(function (x) {
          return mix(x, [20, 22, 40], 0.22);
        })
      : s.c;
    var lc = light
      ? cc
      : cc.map(function (x) {
          return mix(x, [255, 255, 255], 0.22);
        });
    var ctx = cv.getContext("2d"),
      W = cv.width,
      cx = W / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    var env = Math.max(0, Math.sin(t * 9.3)) * 0.6 + Math.max(0, Math.sin(t * 5.1 + 1.3)) * 0.4;
    var R = size * dpr * 0.48 * P.scale * (1 + P.pulse * env);
    var cy = cx - P.bob * Math.abs(Math.sin(t * 2.6)) * size * dpr * 0.04;
    var lw = Math.max(0.45, Math.min(0.9, size / 240)) * dpr;
    var add = light ? "source-over" : "lighter";

    // --- záře: modrá vlevo nahoře, druhá barva vpravo dole (kruhové gradienty, bez hran) ---
    var gr = Math.min((W / 2) * 0.99, R * 1.8);
    function glow(x, y, c, a, r) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = add;
    var ga = P.glow * (light ? 0.22 : 0.55);
    glow(cx, cy, cc[1], ga * 0.8, gr);
    glow(
      cx - R * 0.35,
      cy - R * 0.25,
      cc[0],
      ga,
      Math.min(gr, (W / 2) * 0.99 - R * 0.4 + R * 0.35) * 0.95,
    );
    glow(
      cx + R * 0.4,
      cy + R * 0.45,
      cc[2],
      ga * 1.05,
      Math.min(gr * 0.8, (W / 2) * 0.99 - R * 0.6),
    );
    // tělo — tmavší vnitřek, aby síť vynikla
    ctx.globalCompositeOperation = "source-over";
    var bg = ctx.createRadialGradient(cx + R * 0.1, cy + R * 0.1, 0, cx, cy, R * 1.05);
    if (light) {
      bg.addColorStop(0, rgba(cc[1], 0.07));
      bg.addColorStop(1, rgba(cc[1], 0));
    } else {
      bg.addColorStop(0, rgba(mix(cc[1], [8, 6, 30], 0.7), 0.55));
      bg.addColorStop(0.8, rgba(mix(cc[1], [8, 6, 30], 0.55), 0.25));
      bg.addColorStop(1, rgba(cc[1], 0));
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.05, 0, 6.2832);
    ctx.fill();

    // --- mřížka ---
    var nLat = Math.round(Math.max(10, Math.min(58, size / 5.2))),
      nLon = Math.round(nLat * 1.3);
    var NV = (nLat + 1) * nLon,
      X = new Float32Array(NV),
      Y = new Float32Array(NV),
      Z = new Float32Array(NV),
      YB = new Float32Array(NV),
      LON = new Float32Array(NV);
    var tilt = 0.32 + 0.06 * Math.sin(t * 0.4),
      ct = Math.cos(tilt),
      stl = Math.sin(tilt),
      cr = Math.cos(s.rot),
      sr = Math.sin(s.rot);
    var fq = P.freq,
      A = P.amp,
      slice = Math.sin(Math.floor(t * 2.5) * 12.9) * 0.7,
      sliceOn = P.jitter > 0.05 && hash(Math.floor(t * 2.5)) > 0.35;
    for (var la = 0; la <= nLat; la++) {
      var th = (la / nLat) * Math.PI,
        sy = Math.cos(th),
        sxz = Math.sin(th);
      for (var lo = 0; lo < nLon; lo++) {
        var ph = (lo / nLon) * 6.2832,
          x = sxz * Math.cos(ph),
          y = sy,
          z = sxz * Math.sin(ph),
          id = la * nLon + lo;
        var d =
          1 +
          A *
            (Math.sin(5.3 * fq * x + nt * 1.1 + 1.3) * Math.sin(4.7 * fq * y - nt * 0.8) * 0.7 +
              Math.sin(6.1 * fq * (y + z) + nt * 1.4) * Math.cos(5.2 * fq * x - nt) * 0.55 +
              Math.sin(7.3 * fq * (x - z) + 4 * y - nt * 1.6) * 0.25) +
          A *
            0.55 *
            (Math.sin(1.7 * x + nt * 0.5) * Math.cos(1.9 * y - nt * 0.4) +
              Math.sin(2.1 * z + nt * 0.6) * 0.6) +
          P.wave * Math.sin(y * 12 - t * 10) * (0.55 + 0.45 * Math.sin(t * 3.3 + x * 2)) +
          P.burst * 0.1 * Math.sin(5 * x + 4 * y + t * 11);
        if (P.jitter > 0.05 && hash(id * 0.37 + Math.floor(t * 10) * 13) < 0.07)
          d += (hash(id + Math.floor(t * 10)) - 0.5) * 0.4 * P.jitter;
        var tw = P.twist * y,
          cw = Math.cos(tw),
          sw = Math.sin(tw);
        var x1 = (x * cw - z * sw) * d,
          z1 = (x * sw + z * cw) * d,
          y1 = y * d;
        var x2 = x1 * cr - z1 * sr,
          z2 = x1 * sr + z1 * cr;
        var y3 = y1 * ct - z2 * stl,
          z3 = y1 * stl + z2 * ct;
        var f = 1 / (1 - z3 * 0.16);
        var jx = sliceOn && Math.abs(y3 - slice) < 0.12 ? 0.14 * P.jitter : 0;
        X[id] = cx + (x2 + jx) * R * f;
        Y[id] = cy + y3 * R * f;
        Z[id] = z3;
        YB[id] = y3;
        LON[id] = Math.atan2(x2, z3);
      }
    }
    var gl = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    gl.addColorStop(0, rgba(lc[0], 1));
    gl.addColorStop(0.55, rgba(lc[1], 1));
    gl.addColorStop(1, rgba(lc[2], 1));
    var back = [],
      front = [],
      rim = [];
    function seg(a, b, skipRow) {
      var zm = (Z[a] + Z[b]) * 0.5;
      if (zm < -0.08) back.push(a, b);
      else front.push(a, b);
      if (zm > -0.3 && zm < 0.32) rim.push(a, b);
    }
    var step = P.sparse > 0.5 ? 2 : 1,
      rowCut = P.jitter > 0.05 ? Math.floor(t * 8) : -1;
    for (la = 1; la < nLat; la += step) {
      if (rowCut >= 0 && hash(la * 5.3 + rowCut) < 0.18 * P.jitter) continue;
      for (lo = 0; lo < nLon; lo++) seg(la * nLon + lo, la * nLon + ((lo + 1) % nLon));
    }
    for (lo = 0; lo < nLon; lo += step) {
      if (rowCut >= 0 && hash(lo * 9.1 + rowCut * 3) < 0.14 * P.jitter) continue;
      for (la = 0; la < nLat; la++) seg(la * nLon + lo, (la + 1) * nLon + lo);
    }
    function stroke(list, a, w) {
      if (!list.length || a <= 0.01) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.lineWidth = w;
      ctx.strokeStyle = gl;
      ctx.beginPath();
      for (var q = 0; q < list.length; q += 2) {
        ctx.moveTo(X[list[q]], Y[list[q]]);
        ctx.lineTo(X[list[q + 1]], Y[list[q + 1]]);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = add;
    stroke(back, P.lineA * (light ? 0.22 : 0.2), lw * 0.8);
    stroke(rim, P.lineA * (light ? 0.15 : 0.22), lw * 3.2);
    stroke(front, P.lineA * (light ? 0.8 : 0.7), lw);
    // skenovací pás (hledá) a poledník (hotovo)
    if (P.band > 0.03) {
      var bandY = Math.sin(t * 1.6) * 0.85,
        hb = [];
      for (la = 1; la < nLat; la++)
        for (lo = 0; lo < nLon; lo++) {
          var a1 = la * nLon + lo,
            b1 = la * nLon + ((lo + 1) % nLon);
          if (Math.abs(YB[a1] - bandY) < 0.09 && Z[a1] > -0.2) hb.push(a1, b1);
        }
      stroke(hb, P.band * 0.9, lw * 2.2);
      stroke(hb, P.band * 0.35, lw * 6);
    }
    if (P.sweep > 0.03 && age < 1.8) {
      var sa = age * 2.4 - 3.1416,
        hm = [];
      for (lo = 0; lo < nLon; lo++)
        for (la = 0; la < nLat; la++) {
          var a2 = la * nLon + lo;
          var dl = Math.abs(((LON[a2] - sa + 9.42) % 6.2832) - 3.1416);
          if (dl > 2.9 && Z[a2] > -0.1) hm.push(a2, (la + 1) * nLon + lo);
        }
      var fa = P.sweep * Math.max(0, 1 - age / 1.8);
      stroke(hm, fa, lw * 2.4);
      stroke(hm, fa * 0.4, lw * 7);
    }
    // tečky v uzlech
    ctx.globalAlpha = 1;
    ctx.fillStyle = gl;
    ctx.beginPath();
    var dotR = Math.max(0.6 * dpr, lw * 1.25);
    for (i = 0; i < NV; i++) {
      if (Z[i] < -0.15 || (i * 7 + ((i / nLon) | 0) * 3) % 5) continue;
      var tw2 = 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.7),
        rr = dotR * (0.6 + 0.6 * Z[i] * Z[i]) * tw2;
      ctx.moveTo(X[i] + rr, Y[i]);
      ctx.arc(X[i], Y[i], rr, 0, 6.2832);
    }
    ctx.globalAlpha = P.lineA * (light ? 0.9 : 1);
    ctx.fill();
    // oblak částic kolem
    var M = Math.round(Math.max(20, Math.min(520, size * 1.8))),
      H = halo(M),
      hr = s.rot * 0.35;
    var hc = Math.cos(hr),
      hs = Math.sin(hr);
    ctx.beginPath();
    for (i = 0; i < M; i++) {
      var h0 = H[i],
        br =
          h0[3] *
          (1 +
            P.burst * 0.25 * (0.5 + 0.5 * Math.sin(t * 4 + h0[4])) +
            P.wave * 0.5 * Math.sin(t * 6 + h0[4]) +
            P.pulse * env * 0.6);
      var hx = (h0[0] * hc - h0[2] * hs) * br,
        hz = (h0[0] * hs + h0[2] * hc) * br,
        hy = h0[1] * br;
      var py = hy * ct - hz * stl,
        pz = hy * stl + hz * ct;
      var px = cx + hx * R,
        pyy = cy + py * R;
      if (Math.abs(px - cx) > W / 2 - 3 || Math.abs(pyy - cy) > W / 2 - 3) continue;
      var pr =
        dpr *
        Math.max(0.5, size / 150) *
        (0.55 + 0.45 * Math.sin(t * 2 + h0[4])) *
        (1.25 - (h0[3] - 1.04) * 1.2);
      ctx.moveTo(px + pr, pyy);
      ctx.arc(px, pyy, pr, 0, 6.2832);
    }
    ctx.fillStyle = gl;
    ctx.globalAlpha = P.halo * (light ? 0.6 : 0.9);
    ctx.fill();
    ctx.globalAlpha = 1;
    // satelity = agenti
    if (P.sats > 0.03) {
      for (var q = 0; q < 3; q++) {
        var an = t * (1.05 + q * 0.42) + q * 2.1,
          inc = 0.5 + q * 0.65,
          ro = 1.42 + q * 0.07;
        var sx = Math.cos(an) * ro,
          sy0 = Math.sin(an) * Math.sin(inc) * ro,
          sz0 = Math.sin(an) * Math.cos(inc) * ro;
        var syy = sy0 * ct - sz0 * stl,
          szz = sy0 * stl + sz0 * ct;
        var spx = cx + sx * R,
          spy = cy + syy * R,
          sd = (szz / ro + 1) / 2;
        var tr = s.trail[q];
        tr.push([spx, spy]);
        if (tr.length > 16) tr.shift();
        ctx.strokeStyle = gl;
        for (var m = 1; m < tr.length; m++) {
          ctx.globalAlpha = P.sats * 0.5 * (m / tr.length);
          ctx.lineWidth = lw * 1.8 * (m / tr.length);
          ctx.beginPath();
          ctx.moveTo(tr[m - 1][0], tr[m - 1][1]);
          ctx.lineTo(tr[m][0], tr[m][1]);
          ctx.stroke();
        }
        var best = 0,
          bd = 1e12;
        for (i = 0; i < NV; i += 5) {
          var dx = X[i] - spx,
            dy = Y[i] - spy,
            dd = dx * dx + dy * dy;
          if (dd < bd && Z[i] > 0) {
            bd = dd;
            best = i;
          }
        }
        ctx.globalAlpha = P.sats * 0.6 * sd;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(spx, spy);
        ctx.lineTo(X[best], Y[best]);
        ctx.stroke();
        ctx.globalAlpha = P.sats * (0.55 + 0.45 * sd);
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(spx, spy, lw * (3.4 + 2.2 * sd), 0, 6.2832);
        ctx.fill();
        glow(spx, spy, cc[1], P.sats * 0.5 * sd, lw * 16);
      }
    }
    // prstence majáku (čeká na tebe)
    if (P.ring > 0.03) {
      ctx.fillStyle = rgba(light ? cc[0] : lc[0], 1);
      for (var w = 0; w < 2; w++) {
        var phs = ((t + w * 0.9) % 1.8) / 1.8,
          rad = R * (1.08 + 0.7 * phs);
        ctx.globalAlpha = P.ring * (1 - phs) * 0.9;
        ctx.beginPath();
        for (var j2 = 0; j2 < 48; j2++) {
          var aa = (j2 / 48) * 6.2832 + t * 0.25,
            ex = cx + Math.cos(aa) * rad,
            ey = cy + Math.sin(aa) * rad * 0.3 * ct + R * 0.04,
            er = lw * 1.2;
          ctx.moveTo(ex + er, ey);
          ctx.arc(ex, ey, er, 0, 6.2832);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var list = document.querySelectorAll("canvas.zorb");
    for (var i = 0; i < list.length; i++) {
      try {
        draw(list[i], dt, now / 1000);
      } catch (e) {}
    }
    requestAnimationFrame(frame);
  }
  window.ZOrb = { colors: C, states: Object.keys(S) };
  requestAnimationFrame(frame);
})();
