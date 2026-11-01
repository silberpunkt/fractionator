/* fractionator.js -- the Infinial-Fractionator in JavaScript: heave in a run of serial signal, and it reports
   the repeats it noticed. One file, no libraries, no network. The same machine as fractionator.py, and it gives
   the same report, word for word, for the same signal.

   It runs wherever JavaScript does:
     in a page      <script src="fractionator.js"></script>   then   Fractionator.ring('22/7 as you like')
     QuickJS        qjs --std fractionator.js --fraction 22/7 --digits 300 --png frac.png
     Node           node fractionator.js --sqrt 2 --digits 20000 --png sqrt2.png
   The command line takes the same words as fractionator.py: a signal, or --file, --words, --sqrt, --fraction,
   --digits, --min, --top, --png, --window.

   Two bells. The big bell rings if the whole signal is one piece repeated (a period: 22/7 goes 142857 142857 ...).
   The small bell rings for every stretch that comes round again. An irrational number never rings the big bell,
   and never stops ringing the small one.

   MIT licence. Named by User1, after the White Knight, who would have built it upside down. */

(function (root) {
  'use strict';

  /* ---- signals ---- */

  function isqrt(n) {                                   /* integer square root of a BigInt, Newton from above */
    if (n < 2n) return n;
    let x = 10n ** BigInt(Math.ceil(n.toString().length / 2));
    for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
  }

  function sqrtDigits(k, digits) {                      /* the first `digits` digits after the point of sqrt(k) */
    const s = isqrt(BigInt(k) * 10n ** BigInt(2 * digits)).toString();
    const whole = isqrt(BigInt(k)).toString().length;
    return s.slice(whole, whole + digits);
  }

  function parseFraction(text) {                        /* '22/7', '-1/3', '0.125'  ->  [numerator, denominator] */
    const t = String(text).trim();
    let num, den;
    if (t.includes('/')) { const [a, b] = t.split('/'); num = BigInt(a.trim()); den = BigInt(b.trim()); }
    else if (t.includes('.')) { const [a, b] = t.split('.'); den = 10n ** BigInt(b.length); num = BigInt((a || '0') + b) * (t.startsWith('-') && !a.startsWith('-') ? -1n : 1n); }
    else { num = BigInt(t); den = 1n; }
    if (den === 0n) throw new Error('a fraction cannot have 0 below the line');
    if (den < 0n) { num = -num; den = -den; }
    return [num, den];
  }

  function fractionDigits(fraction, digits) {           /* long division, as at school: the first `digits` digits */
    const [num, den] = Array.isArray(fraction) ? fraction.map(BigInt) : parseFraction(fraction);
    let r = ((num % den) + den) % den;
    const out = [];
    for (let i = 0; i < digits; i++) { r *= 10n; out.push((r / den).toString()); r %= den; }
    return out.join('');
  }

  function tokens(text, words) {                        /* marks are characters; words are runs between spaces */
    return words ? String(text).split(/\s+/).filter(Boolean) : Array.from(String(text));
  }

  /* ---- the bells ---- */

  function byCodePoint(a, b) {                          /* the order Python sorts strings in */
    const x = Array.from(a), y = Array.from(b);
    for (let i = 0; i < x.length && i < y.length; i++) { const d = x[i].codePointAt(0) - y[i].codePointAt(0); if (d) return d; }
    return x.length - y.length;
  }

  function encode(toks) {                               /* each distinct token becomes a number, in sorted order */
    const alphabet = [...new Set(toks)].sort(byCodePoint), id = new Map(alphabet.map((t, i) => [t, i]));
    return { seq: Int32Array.from(toks, t => id.get(t)), alphabet };
  }

  function period(seq) {                                /* the big bell: shortest p with the whole signal its first p, repeated; else 0 */
    const n = seq.length;
    for (let p = 1; p <= n >> 1; p++) {
      let ok = true;
      for (let i = p; i < n; i++) if (seq[i] !== seq[i - p]) { ok = false; break; }
      if (ok) return p;
    }
    return 0;
  }

  function same(seq, a, b, k) { for (let i = 0; i < k; i++) if (seq[a + i] !== seq[b + i]) return false; return true; }

  function occurrences(seq, a, k) {                     /* every place the stretch at a comes round, overlaps allowed */
    const out = [];
    for (let i = 0; i + k <= seq.length; i++) if (seq[i] === seq[a] && same(seq, i, a, k)) out.push(i);
    return out;
  }

  function inside(seq, a, k, b, m) { for (let i = b; i + k <= b + m; i++) if (same(seq, a, i, k)) return true; return false; }

  function repeats(seq, minlen, top) {                  /* the small bells, longest first: [{length, at: [positions]}] */
    const n = seq.length, sa = Array.from({ length: n }, (_, i) => i);
    sa.sort((a, b) => {                                 /* a suffix array: neighbours share their longest beginnings */
      for (let k = 0; k < 256; k++) {
        if (a + k >= n) return b + k >= n ? 0 : -1;
        if (b + k >= n) return 1;
        const d = seq[a + k] - seq[b + k];
        if (d) return d;
      }
      return 0;
    });
    const found = [];
    for (let i = 1; i < n; i++) {
      const a = sa[i - 1], b = sa[i];
      let k = 0;
      while (a + k < n && b + k < n && seq[a + k] === seq[b + k]) k++;
      if (k >= minlen) found.push([k, Math.min(a, b)]);
    }
    found.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    const out = [];
    for (const [k, a] of found) {
      if (out.some(r => inside(seq, a, k, r.at[0], r.length))) continue;   /* only an echo of one already rung */
      out.push({ length: k, at: occurrences(seq, a, k) });
      if (out.length >= top) break;
    }
    return out;
  }

  function minLength(n, words) { return words ? 3 : Math.max(2, Math.round(2 * Math.log10(n)) - 2); }

  /* ---- the report: the same lines fractionator.py prints ---- */

  function ring(input, opts) {
    opts = opts || {};
    const words = !!opts.words, unit = words ? 'words' : 'marks';
    const toks = Array.isArray(input) ? input : tokens(input, words);
    const name = opts.name || 'the signal given', top = opts.top || 12, n = toks.length;
    const result = { name, unit, n, lines: [] };
    if (n < 2) { result.lines.push('Too short to repeat anything.'); result.text = result.lines[0]; return result; }
    const { seq, alphabet } = encode(toks);
    const show = (a, k) => toks.slice(a, a + k).join(words ? ' ' : '');
    const minlen = opts.min || minLength(n, words);
    const L = result.lines;
    Object.assign(result, { seq, distinct: alphabet.length, minlen });
    L.push('The Infinial-Fractionator, reading ' + name + ': ' + n + ' ' + unit + ', ' + alphabet.length + ' different.');
    result.period = period(seq);
    L.push(result.period ? 'BIG BELL: the whole signal is its first ' + result.period + ' ' + unit + ', over and over: ' + show(0, result.period)
                         : 'No big bell: the signal never settles into a period.');
    result.bells = repeats(seq, minlen, top);
    if (!result.bells.length) L.push('No small bells: nothing of ' + minlen + ' ' + unit + ' or more comes round again.');
    else {
      L.push('Small bells (' + minlen + ' ' + unit + ' or more that come round again), longest first:');
      for (const b of result.bells) {
        const at = b.at, k = b.length;
        b.gaps = [...new Set(at.slice(1).map((x, i) => x - at[i]))].sort((x, y) => x - y);
        b.text = show(at[0], k);
        const where = at.slice(0, 6).map(i => i + 1).join(', ') + (at.length > 6 ? ', ...' : '');
        L.push('  ' + String(k).padStart(4) + ' ' + unit + ', ' + at.length + ' times, at ' + where +
               ' (' + b.gaps.slice(0, 4).join(', ') + (b.gaps.length > 4 ? ' ...' : '') + ' apart):');
        L.push('        ' + show(at[0], Math.min(k, 60)) + (k > 60 ? ' ...' : ''));
      }
    }
    result.text = L.join('\n');
    return result;
  }

  /* ---- the picture: a recurrence plot, the same pixels fractionator.py draws ---- */

  function recurrence(seq, opts) {                      /* -> {side, step, cells}: cells[y*side+x] is 0 dark, 1 diagonal, 2 a mark */
    opts = opts || {};
    const n = seq.length, size = opts.size || 900, window = opts.window || 3, crowd = opts.crowd || 60;
    const step = Math.max(1, Math.ceil(n / size)), side = Math.ceil(n / step);
    const cells = new Uint8Array(side * side);
    for (let i = 0; i < side; i++) cells[i * side + i] = 1;          /* every moment agrees with itself */
    const where = new Map();
    for (let i = 0; i + window <= n; i++) {
      const key = Array.prototype.join.call(seq.subarray ? seq.subarray(i, i + window) : seq.slice(i, i + window), ',');
      let a = where.get(key); if (!a) where.set(key, a = []); a.push(i);
    }
    for (const at of where.values()) {                  /* the commonest little stretches are left out: what shows is notable */
      if (at.length < 2 || at.length > crowd) continue;
      for (const a of at) for (const b of at) if (a !== b) cells[Math.floor(b / step) * side + Math.floor(a / step)] = 2;
    }
    return { side, step, window, scale: Math.max(1, Math.floor(size / side)), cells };
  }

  const COLOURS = [[11, 13, 16], [58, 63, 71], [232, 179, 75]];

  let crcTable = null;
  function crc32(bytes, from, to) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    let c = 0xffffffff;
    for (let i = from; i < to; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function png(pic) {                                   /* a PNG file as bytes: three-colour palette, stored deflate. Opens anywhere. */
    const W = pic.side * pic.scale, row = W + 1, raw = new Uint8Array(row * W);
    for (let y = 0; y < W; y++) {
      const src = Math.floor(y / pic.scale) * pic.side;
      for (let x = 0; x < W; x++) raw[y * row + 1 + x] = pic.cells[src + Math.floor(x / pic.scale)];
    }
    const blocks = Math.max(1, Math.ceil(raw.length / 65535));
    const zlen = 2 + raw.length + blocks * 5 + 4, z = new Uint8Array(zlen);
    let p = 0; z[p++] = 0x78; z[p++] = 0x01;
    for (let i = 0; i < blocks; i++) {
      const start = i * 65535, len = Math.min(65535, raw.length - start);
      z[p++] = i === blocks - 1 ? 1 : 0; z[p++] = len & 255; z[p++] = len >> 8; z[p++] = ~len & 255; z[p++] = (~len >> 8) & 255;
      z.set(raw.subarray(start, start + len), p); p += len;
    }
    let s1 = 1, s2 = 0;
    for (let i = 0; i < raw.length; i++) { s1 = (s1 + raw[i]) % 65521; s2 = (s2 + s1) % 65521; }
    z[p++] = s2 >> 8; z[p++] = s2 & 255; z[p++] = s1 >> 8; z[p++] = s1 & 255;
    const chunks = [['IHDR', [W >>> 24, (W >>> 16) & 255, (W >>> 8) & 255, W & 255, W >>> 24, (W >>> 16) & 255, (W >>> 8) & 255, W & 255, 8, 3, 0, 0, 0]],
                    ['PLTE', [].concat(...COLOURS)], ['IDAT', z], ['IEND', []]];
    const total = 8 + chunks.reduce((t, [, d]) => t + 12 + d.length, 0), out = new Uint8Array(total);
    out.set([137, 80, 78, 71, 13, 10, 26, 10]); p = 8;
    for (const [type, data] of chunks) {
      const len = data.length;
      out.set([len >>> 24, (len >>> 16) & 255, (len >>> 8) & 255, len & 255], p); p += 4;
      const t0 = p;
      for (let i = 0; i < 4; i++) out[p++] = type.charCodeAt(i);
      out.set(data, p); p += len;
      const c = crc32(out, t0, p);
      out.set([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255], p); p += 4;
    }
    return out;
  }

  /* ---- the command line: QuickJS or Node, the same words as fractionator.py ---- */

  function cli(argv, io) {
    const o = { digits: 10000, min: 0, top: 12, window: 0 };
    const usage = 'usage: fractionator.js [signal] [--file F] [--words] [--sqrt N | --fraction A/B] [--digits D] [--min M] [--top T] [--png P] [--window W]';
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--words') o.words = true;
      else if (a === '-h' || a === '--help') { io.say(usage); return 0; }
      else if (a.startsWith('--')) { const eq = a.indexOf('='), key = eq > 0 ? a.slice(2, eq) : a.slice(2), v = eq > 0 ? a.slice(eq + 1) : argv[++i]; if (v === undefined) { io.say(usage); return 2; } o[key] = /^(digits|min|top|window|sqrt)$/.test(key) ? parseInt(v, 10) : v; }
      else o.signal = a;
    }
    let toks, name;
    if (o.sqrt !== undefined) { toks = Array.from(sqrtDigits(o.sqrt, o.digits)); name = 'the first ' + o.digits + ' digits of the square root of ' + o.sqrt; }
    else if (o.fraction) { toks = Array.from(fractionDigits(o.fraction, o.digits)); name = 'the first ' + o.digits + ' digits of ' + o.fraction; }
    else if (o.file) { toks = tokens(io.read(o.file), o.words); name = o.file; }
    else if (o.signal !== undefined) { toks = tokens(o.signal, o.words); name = 'the signal given'; }
    else { io.say(usage + '\nfractionator.js: give a signal, --file, --sqrt or --fraction'); return 2; }
    const r = ring(toks, { words: o.words && !o.sqrt && !o.fraction, name, min: o.min, top: o.top });
    io.say(r.text || r.lines.join('\n'));
    if (o.png && r.seq) {
      const w = o.window || (r.unit === 'words' ? 3 : Math.max(3, r.minlen - 1));
      const pic = recurrence(r.seq, { window: w });
      io.write(o.png, png(pic));
      io.say('Drawn: ' + o.png + ' (each pixel ' + pic.step + ' ' + r.unit + '; a mark where ' + w + ' in a row agree).');
    }
    return 0;
  }

  const Fractionator = { isqrt, sqrtDigits, parseFraction, fractionDigits, tokens, encode, period, repeats, occurrences,
                         minLength, ring, recurrence, png, COLOURS, cli };
  root.Fractionator = Fractionator;
  if (typeof module === 'object' && module && module.exports) module.exports = Fractionator;

  /* run as a program? QuickJS gives scriptArgs and std; Node gives process and require.main. A page gives neither. */
  if (typeof scriptArgs !== 'undefined' && /fractionator\.js$/.test(scriptArgs[0] || '')) {
    if (typeof std === 'undefined') { print('fractionator.js: run QuickJS with --std, as in: qjs --std fractionator.js --fraction 22/7'); return; }
    const code = cli(scriptArgs.slice(1), {
      say: s => std.out.puts(s + '\n'),
      read: f => { const s = std.loadFile(f); if (s === null) throw new Error('cannot read ' + f); return s.replace(/\r\n?/g, '\n'); },
      write: (f, bytes) => { const h = std.open(f, 'wb'); h.write(bytes.buffer, bytes.byteOffset, bytes.length); h.close(); }
    });
    if (code) std.exit(code);
  } else if (typeof process === 'object' && typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const fs = require('fs');
    process.exitCode = cli(process.argv.slice(2), {
      say: s => console.log(s),
      read: f => fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n'),
      write: (f, bytes) => fs.writeFileSync(f, bytes)
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
