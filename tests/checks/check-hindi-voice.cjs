/* THE HINDI VOICE (?lan=hi): src/lesson/recordings-hi.js, Frozen Rush's CFG.vo.langs.hi, and the
   lesson playing them, without a browser: the page's own i18n.js (in Hindi), the catalogues and
   the lesson's script, with a media element whose clock the check moves.
     - every line the lesson says has its Hindi take (bar the ones the cue map lists as not yet
       delivered), its Ogg file is there and as long as the row says, its words are
       the words shown, in order, inside the take, and its English cue times are inside it too
     - each line plays its Hindi file, and its words come in exactly as the take says them
     - the cues fire on the Hindi word that says them: the Open / Closed buttons, the boundary
       pulse on straight / curved, the polygon on screen 8; screen 27 stops where its sentence does
     - English keeps the English takes: find(text, { english: true }), and a page in English
     - the game's Hindi take: a window for every line the English take has, its word starts as
       many as the words shown, inside the take, and the take's hashes in the asset versions
   The same for Marathi (src/lesson/recordings-mr.js, CFG.vo.langs.mr; the ElevenLabs takes):
     VOICE_LANG=mr node tests/checks/check-hindi-voice.cjs   (tests/checks/check-marathi-voice.cjs)
   And for Gujarati (src/lesson/recordings-gu.js, CFG.vo.langs.gu; the ElevenLabs takes):
     VOICE_LANG=gu node tests/checks/check-hindi-voice.cjs   (tests/checks/check-gujarati-voice.cjs)
   Telugu, which has no voice of its own, keeps the English takes. */
const fs = require('fs'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const LAN = process.env.VOICE_LANG || 'hi';
// each language's words that the lesson's cues fire on: Open, Closed, the boundaries, the polygon,
// screen 27's next sentence, and the angle's parts (sides, meet, angle, and where the arc starts)
const CUE_WORDS = {
  hi: { name: 'Hindi', open: 'खुली', closed: 'बंद', straight: 'सीधी', curved: 'वक्र', polygon: 'बहुभुज', next27: 'इसे',
        sides: 'भुजाएँ', meet: 'मिलती', angle: 'कोण', form: 'तो' },
  mr: { name: 'Marathi', open: 'खुली', closed: 'बंद', straight: 'सरळ', curved: 'वक्र', polygon: 'बहुभुजाकृती', next27: 'ती',
        sides: 'बाजू', meet: 'मिळतात', angle: 'कोनही', form: 'तेव्हा' },
  gu: { name: 'Gujarati', open: 'ખુલ્લી', closed: 'બંધ', straight: 'સીધી', curved: 'વક્ર', polygon: 'બહુકોણ', next27: 'તેને',
        sides: 'બાજુઓ', meet: 'મળે', angle: 'ખૂણો', form: 'ત્યારે' }
}[LAN];
const NAME = CUE_WORDS.name;
const html = fs.readFileSync('index.html', 'utf8');
const locales = JSON.parse(fs.readFileSync('src/i18n/locales.json', 'utf8'));
const cueMap = JSON.parse(fs.readFileSync('docs/voice/' + LAN + '/cue-map.json', 'utf8'));
const FFMPEG = fs.existsSync('node_modules/ffmpeg-static/ffmpeg') ? 'node_modules/ffmpeg-static/ffmpeg' : 'ffmpeg';

function context(search) {
  let spoken = [], timers = [], media = [];
  const el = () => ({ canPlayType: () => '', setAttribute() {}, appendChild() {}, style: {}, classList: { add() {} } });
  const document = {
    currentScript: { src: 'http://polygon.test/src/i18n/i18n.js', getAttribute: () => null },
    documentElement: { clientWidth: 1920, clientHeight: 1080, classList: { add() {} }, lang: 'en' },
    head: { appendChild() {} }, title: 'Polygon Adventure', createElement: el
  };
  const ctx = {
    window: { speechSynthesis: { cancel() {}, speak(u) { spoken.push(u); } } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    document, location: { search, hash: '', href: 'http://polygon.test/index.html' + search, protocol: 'http:' },
    URL, URLSearchParams, console,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(locales) }),
    React: { createRef: () => ({ current: null }) },
    DCLogic: class { setState(v, cb) { Object.assign(this.state, typeof v === 'function' ? v(this.state) : v); if (this.componentDidUpdate) this.componentDidUpdate(); if (cb) cb(); } },
    setTimeout, clearTimeout,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    Audio: class { constructor(src) { this.src = src; this.duration = NaN; this.currentTime = 0; this.paused = true; media.push(this); }
      play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } removeAttribute() {} load() {}
      addEventListener() {} removeEventListener() {} }   // (the player listens for a failed Ogg, to try its MP3)
  };
  ctx.window.document = document; ctx.window.location = ctx.location;
  vm.createContext(ctx);
  return { ctx, spoken, timers, media };
}
const run = (c, file) => vm.runInContext(fs.readFileSync(file, 'utf8'), c.ctx, { filename: file });
function lesson(c) {
  run(c, 'src/lesson/polygon-data.js');
  vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', c.ctx);
  return k => {
    const g = new c.ctx.Game(); g.P = c.ctx.window.POLY; g.svgRefs = {}; g.state.ready = true; g.state.k = k;
    g.state.phase = g.step().ph || ''; g.later = f => c.timers.push(f); g.sfx = () => {}; g.armNudge = () => {};
    return g;
  };
}
const words = s => String(s).match(/\S+/g) || [];
const duration = file => {
  let out = '';
  try { execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: 'pipe' }); } catch (e) { out = String(e.stderr); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN;
};

(async () => {
  /* ------------------------------------------------------------------ the language */
  const hi = context('?lan=' + LAN);
  run(hi, 'src/i18n/i18n.js');
  run(hi, 'src/lesson/recordings.js');
  run(hi, 'src/lesson/recordings-' + LAN + '.js');
  run(hi, 'src/lesson/recorded-player.js');
  await hi.ctx.window.PolygonI18n.ready;
  const I = hi.ctx.window.PolygonI18n, V = hi.ctx.window.PolygonRecordedVoice, rows = hi.ctx.window.POLYGON_VOICES[LAN];
  assert(I.on && I.code === LAN, 'the page is in ' + NAME);
  assert(V.voice() === rows, 'its own voice is the one spoken');
  // the file a row is played from: its .ogg, or its .mp3 twin where Ogg does not play (as here)
  const played = src => hi.ctx.window.polygonAudioSrc(src);

  // the catalogue: files, lengths, the words shown, the cues
  for (const row of rows) {
    assert(/\.ogg$/.test(row.src) && fs.existsSync(row.src), 'file: ' + row.src);
    const real = duration(row.src);
    assert(Math.abs(real - row.duration) < 0.06, row.text + ': the row says ' + row.duration + ' s, the file is ' + real);
    // (the take's English says numbers as words, the screen as numerals: the screens below check
    // that each one shows exactly these words)
    assert.deepEqual(row.spoken.map(w => w.word), words(row.shown), row.text + ': its words are its line\'s');
    assert(Object.values(locales[LAN]).some(v => v.replace(/<\/?strong>/g, '').replace(/\s+/g, ' ').trim() === row.shown), row.text + ': its line is a line of the ' + NAME);
    // (a dash says nothing: it comes with the word after it)
    const sayless = w => !/[ऀ-ॿ0-9A-Za-z]/.test(w.word);
    row.spoken.forEach((w, i) => assert(w.start >= 0.1 && w.start < row.duration - 0.1 &&
      (!i || w.start > row.spoken[i - 1].start || (sayless(row.spoken[i - 1]) && w.start === row.spoken[i - 1].start)), row.text + ': word ' + i + ' in order, inside the take'));
    const cues = V.cueStarts(row, row.text);
    assert(cues && cues.every(t => t >= 0 && t < row.duration), row.text + ': its English cues, inside the take');
    assert.equal(V.find(row.text), row, 'found by its English: ' + row.text);
    assert(V.find(row.text, { english: true }) && /assets\/audio\/lesson\/[^/]+$/.test(V.find(row.text, { english: true }).src), 'and the English take still, when asked: ' + row.text);
  }
  // every line the lesson says
  const game = lesson(hi);
  const notYet = cueMap.lines.filter(l => l.missing).map(l => l.en);
  const said = new Set();
  for (const step of game(0).steps()) for (const text of [step.narr, step.done, ...Object.values(step.fb || {})].filter(Boolean)) said.add(text);
  // (the lesson's own match: numerals as words, src/lesson/recorded-player.js)
  const NUM = 'zero one two three four five six seven eight nine'.split(' ');
  const norm = t => t.toLowerCase().replace(/[0-9]/g, n => NUM[+n]).replace(/[’']/g, '').replace(/[^a-z]+/g, ' ').trim();
  const pending = new Set(notYet.map(norm));
  const without = [...said].filter(t => V.find(t, { english: true }) && !V.find(t));
  assert.deepEqual(without.sort(), [...said].filter(t => pending.has(norm(t))).sort(),
    'every line said has its ' + NAME + ' take, bar the ones not yet delivered: ' + without.join(' | '));
  // a line with no Hindi take yet: shown in Hindi at a reading pace, no voice (never the English one), and it ends
  for (const text of without) {
    const k = game(0).steps().findIndex(s => [s.narr, s.done, ...Object.values(s.fb || {})].includes(text));
    const g = game(k), n0 = hi.media.length;
    hi.timers.length = 0;
    let ended = false;
    g.narrate(text, { then: () => { ended = true; } });
    assert.equal(hi.media.length, n0, text + ': no recording played');
    assert.equal(I.t(text), g.state.narrPage, text + ': shown in ' + NAME);
    while (hi.timers.length) hi.timers.shift()();
    assert(ended && g.state.wordReveal === 'complete', text + ': read, and the lesson goes on');
  }
  console.log('PASS: ' + rows.length + ' ' + NAME + ' takes: files, lengths, the words shown, in order, cues inside the take' +
    (notYet.length ? '; not yet delivered: ' + cueMap.lines.filter(l => l.missing).map(l => l.n + ' "' + l[LAN] + '"').join(', ') : ''));

  // each line, played: its Hindi file, and its words as the take says them
  let lines = 0;
  game(0).steps().forEach((step, k) => {
    if (!step.narr || step.show || Number.isFinite(step.speakWords)) return;
    const row = V.find(step.narr);
    if (!row) return;
    const g = game(k);
    g.narrate(step.narr, {});
    const a = hi.media.at(-1);
    assert.equal(a.src, played(row.src), (k + 1) + ': plays its ' + NAME + ' take');
    a.onplaying();
    assert.equal(g.state.revealedWords, 0, (k + 1) + ': nothing before the voice');
    row.spoken.forEach((w, i) => {
      a.currentTime = w.start - 0.02; a.ontimeupdate();
      assert.equal(g.state.revealedWords, i, (k + 1) + ' "' + w.word + '": not before it is said');
      a.currentTime = w.start; a.ontimeupdate();
      assert.equal(g.state.revealedWords, i + 1, (k + 1) + ' "' + w.word + '": as it is said');
    });
    a.currentTime = row.duration; a.onended();
    // screens 7-9 follow a short lead-in with "Is it open or closed?", in its own Hindi take
    const queued = hi.media.at(-1);
    if (queued !== a) assert.equal(queued.src, played(V.find('Is it open or closed?').src), (k + 1) + ': then the question, in ' + NAME);
    else assert.equal(g.state.wordReveal, 'complete', (k + 1) + ': the line completes');
    lines++;
  });
  assert(lines > 30, 'screens checked: ' + lines);
  // ...and every feedback and hint line, on its own screen, the same way
  let feedback = 0;
  game(0).steps().forEach((step, k) => {
    for (const text of [step.done, ...Object.values(step.fb || {})].filter(Boolean)) {
      const row = V.find(text);
      if (!row) continue;
      const g = game(k);
      g.narrate(text, {});
      const a = hi.media.at(-1);
      assert.equal(a.src, played(row.src), (k + 1) + ' "' + text + '": plays its ' + NAME + ' take');
      a.onplaying();
      row.spoken.forEach((w, i) => {
        a.currentTime = w.start - 0.02; a.ontimeupdate();
        assert.equal(g.state.revealedWords, i, (k + 1) + ' "' + w.word + '": not before it is said');
        a.currentTime = w.start; a.ontimeupdate();
        assert(g.state.revealedWords === i + 1 || (i + 1 < row.spoken.length && row.spoken[i + 1].start === w.start), (k + 1) + ' "' + w.word + '": as it is said');
      });
      a.currentTime = row.duration; a.onended();
      feedback++;
    }
  });
  assert(feedback > 20, 'feedback lines checked: ' + feedback);
  // a board showing a shorter line than is said (the classify screens): its words spread over the
  // words said, the first with the first, none ahead of the voice, all of them by its end
  let shorter = 0;
  game(0).steps().forEach((step, k) => {
    if (!step.show || !step.narr || Number.isFinite(step.speakWords) || !V.find(step.narr)) return;
    const row = V.find(step.narr), g = game(k), shown = words(I.t(step.show)).length;
    g.state.narrShow = I.t(step.show);
    g.narrate(step.narr, {});
    const a = hi.media.at(-1); a.onplaying();
    a.currentTime = row.spoken[0].start - 0.02; a.ontimeupdate();
    assert.equal(g.state.revealedWords, 0, (k + 1) + ': nothing shown before the voice');
    a.currentTime = row.spoken[0].start; a.ontimeupdate();
    assert.equal(g.state.revealedWords, 1, (k + 1) + ': the first word with the first word said');
    a.currentTime = row.spoken.at(-1).start; a.ontimeupdate();
    assert.equal(g.state.revealedWords, shown, (k + 1) + ': all of it by the last word said');
    shorter++;
  });
  assert(shorter >= 2, 'the classify screens checked: ' + shorter);
  console.log('PASS: ' + lines + ' screens and ' + feedback + ' feedback and hint lines play their ' + NAME + ' take, every word shown as it is said, none before; ' +
    shorter + ' showing a shorter line spread it over the words said');

  // the cues, on the word of the language that says them
  const at = (row, hiWord) => row.spoken.find(w => w.word.replace(/[?!।,.]/g, '') === hiWord).start;
  {
    const k = game(0).steps().findIndex(s => s.q === 'oc' && s.narr === 'Is it open or closed?');
    const g = game(k), row = V.find('Is it open or closed?');
    g.narrate(g.step().narr, {}); const a = hi.media.at(-1); a.onplaying();
    const W = CUE_WORDS, open = at(row, W.open), closed = at(row, W.closed);
    a.currentTime = open - 0.02; a.ontimeupdate(); assert(!(g.state.ocWords || {}).open, 'Open waits for ' + W.open);
    a.currentTime = open; a.ontimeupdate(); assert((g.state.ocWords || {}).open && !(g.state.ocWords || {}).closed, 'Open comes with ' + W.open + ', Closed waits');
    a.currentTime = closed; a.ontimeupdate(); assert((g.state.ocWords || {}).closed, 'Closed comes with ' + W.closed);
  }
  {
    const k = game(0).steps().findIndex(s => s.narr === 'Some are straight and some are curved.');
    const g = game(k), row = V.find(g.step().narr);
    g.narrate(g.step().narr, {}); const a = hi.media.at(-1); a.onplaying();
    const W = CUE_WORDS;
    a.currentTime = at(row, W.straight) - 0.02; a.ontimeupdate(); assert.notEqual(g.state.boundaryFocus, 'straight', 'straight waits for ' + W.straight);
    a.currentTime = at(row, W.straight); a.ontimeupdate(); assert.equal(g.state.boundaryFocus, 'straight', 'the straight boundaries pulse on ' + W.straight);
    a.currentTime = at(row, W.curved); a.ontimeupdate(); assert.equal(g.state.boundaryFocus, 'curved', 'the curved ones on ' + W.curved);
  }
  {
    const k = game(0).steps().findIndex(s => s.sc === 'S8');
    const g = game(k), row = V.find(g.step().narr);
    g.narrate(g.step().narr, {}); const a = hi.media.at(-1); a.onplaying();
    a.currentTime = at(row, CUE_WORDS.polygon) - 0.02; a.ontimeupdate(); assert(!g.state.reveal, 'the polygon waits for ' + CUE_WORDS.polygon);
    a.currentTime = at(row, CUE_WORDS.polygon); a.ontimeupdate(); assert(g.state.reveal, 'the polygon is named on ' + CUE_WORDS.polygon);
  }
  {
    const k = game(0).steps().findIndex(s => Number.isFinite(s.speakWords));
    const g = game(k), row = V.find(g.step().narr);
    g.narrate(g.step().narr, {}); const a = hi.media.at(-1); a.onplaying();
    const next = at(row, CUE_WORDS.next27);
    a.currentTime = next - 0.35; a.ontimeupdate(); assert.notEqual(g.state.wordReveal, 'complete', '27: still speaking its sentence');
    a.currentTime = next - 0.29; a.ontimeupdate(); assert.equal(g.state.wordReveal, 'complete', '27: stops in the pause after its sentence');
  }
  {
    // the pentagon's parts are drawn on their words in the language (index.html: the S11 cues)
    const row = V.find('When two sides meet, they also form an angle.');
    const cue = w => row.words.find(x => x.word.toLowerCase().replace(/[^a-z]/g, '') === w).start;
    const W = CUE_WORDS;
    assert(cue('sides') === at(row, W.sides) && cue('meet') === at(row, W.meet) && cue('angle') === at(row, W.angle), 'sides, meet, angle on ' + [W.sides, W.meet, W.angle].join(', '));
    assert(cue('form') === at(row, W.form) && cue('form') < cue('angle'), 'the arc is drawn from ' + W.form + ', before ' + W.angle);
  }
  console.log('PASS: the cues fire on the ' + NAME + ' words: Open on ' + CUE_WORDS.open + ', Closed on ' + CUE_WORDS.closed + ', straight / curved, the polygon, screen 27\'s cut, the angle\'s parts');

  /* ---------------------------------------------------------------- English */
  const en = context('');
  run(en, 'src/i18n/i18n.js');
  run(en, 'src/lesson/recordings.js');
  run(en, 'src/lesson/recordings-' + LAN + '.js');
  run(en, 'src/lesson/recorded-player.js');
  await en.ctx.window.PolygonI18n.ready;
  const VE = en.ctx.window.PolygonRecordedVoice;
  assert(!en.ctx.window.PolygonI18n.on && !VE.voice(), 'English speaks English');
  for (const row of rows) assert.equal(VE.find(row.text), en.ctx.window.POLYGON_RECORDINGS.find(r => r.text === VE.find(row.text).text), 'English take: ' + row.text);
  const te = context('?lan=te');
  run(te, 'src/i18n/i18n.js'); run(te, 'src/lesson/recordings.js'); run(te, 'src/lesson/recorded-player.js');
  await te.ctx.window.PolygonI18n.ready;
  assert(te.ctx.window.PolygonI18n.on && !te.ctx.window.PolygonRecordedVoice.voice() && /lesson\/01_/.test(te.ctx.window.PolygonRecordedVoice.find('Look! A point.').src), 'Telugu keeps the English takes');
  console.log('PASS: English, and Telugu, keep the English takes');

  /* ------------------------------------------------------------------ the game */
  const engine = fs.readFileSync('game/js/engine.js', 'utf8');
  const block = (src, re) => { const m = re.exec(src); assert(m, 'found ' + re); return m[1]; };
  const english_ = block(engine, /\n    lines: \{\n((?:      '[^\n]*\n)+)/);
  const hindi = block(engine, new RegExp('\\n      ' + LAN + ": \\{ src: '[^']*', take: [\\d.]+, lines: \\{\\n((?:          '[^\\n]*\\n)*)"));
  const take = +new RegExp(LAN + ": \\{ src: '[^']*', take: ([\\d.]+)").exec(engine)[1];
  const parse = s => Object.fromEntries([...s.matchAll(/'([^']+)':\s*\[([\d.]+), ([\d.]+), \[([^\]]*)\]\],\s*\/\/ "([^"]*)"/g)]
    .map(m => [m[1], { at: +m[2], len: +m[3], words: m[4].split(',').map(Number), text: m[5] }]));
  const E = parse(english_), H = parse(hindi);
  assert.deepEqual(Object.keys(H).sort(), Object.keys(E).sort(), 'the ' + NAME + ' take has every line the English one has');
  for (const [id, w] of Object.entries(H)) {
    assert.equal(w.words.length, words(w.text).length, id + ': a start for every word shown');
    assert(w.at + w.len <= take + 0.01 && w.words.every((t, i) => t >= 0 && t < w.len && (!i || t > w.words[i - 1])), id + ': inside its window, in order');
  }
  const takeLen = duration('game/assets/audio/vo-lines-' + LAN + '.ogg');
  assert(Math.abs(takeLen - take) < 0.1, 'the take is as long as its windows say: ' + takeLen + ' / ' + take);
  for (const ext of ['ogg', 'mp3']) {
    const rel = 'assets/audio/vo-lines-' + LAN + '.' + ext, h = crypto.createHash('md5').update(fs.readFileSync('game/' + rel)).digest('hex').slice(0, 8);
    for (const js of ['game/js/asset-versions.js', 'game/js/game.bundle.js']) assert(fs.readFileSync(js, 'utf8').includes('"' + rel + '": "' + h + '"'), js + ' has ' + rel + ' at ' + h);
  }
  const bundle = fs.readFileSync('game/js/game.bundle.js', 'utf8');
  assert(bundle.includes(hindi) && bundle.includes('voTake()') && bundle.includes('ownVoice()'), 'the bundle carries the same take and code');
  console.log('PASS: the game\'s ' + NAME + ' take: ' + Object.keys(H).length + ' windows in ' + take + ' s, a start for every word shown, its hashes in the asset versions, the bundle in step');
})().catch(e => { console.error(e); process.exit(1); });
