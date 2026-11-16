#!/usr/bin/env python3
"""Generate the Gujarati voice with ElevenLabs: one take per line the experience speaks.

!! This calls the ElevenLabs API, which costs credits. Run it only with the project owner's
!! explicit go-ahead for that run (CLAUDE.md). The key is read from ELEVENLABS_API_KEY and is
!! never written anywhere.

Every line the experience SPEAKS (the lesson's recorded lines and Frozen Rush's tutorial and
signs, as tools/voice/measure-hindi-voice.py finds them) is said from its Gujarati in
src/i18n/locales.json, as shown (<strong> taken off), numerals said as Gujarati words (5 is પાંચ).
The takes are numbered as the Hindi script is (the keys of locales.json in order, the twelve
nobody hears left out), as the Marathi takes are:

  assets/VO-GU/<n>_<key>.mp3     the take as ElevenLabs delivered it (44.1 kHz, 128 kbps)
  assets/VO-GU/script.csv        which number is which line, its voice, characters and credits
  docs/voice/gu/takes.json       per take: the voice, model and settings, the text sent, the
                                 credits charged, and where each of its words starts and ends
                                 in the file (ElevenLabs' own alignment of the text it was sent)

tools/voice/measure-gujarati-voice.py then fits those word times to the waveform and writes the
cue map; npm run build:gujarati-voice builds what the page plays.

The voices (ElevenLabs Voice Library, Gujarati): Swiftee, who says the lesson and its narration,
is Hetalben ("Young Gujarati Customer Care": a young female voice, bright, warm, approachable);
Frozen Rush's game voice is Bhavesh Bhai ("Expressive Gujarati Friend": made for cartoon and
animation characters). Model eleven_v4, speed 0.95: a steady, clear pace for learners of 11-13
(grades 6 and 7).

Usage (from the project folder):
    ELEVENLABS_API_KEY=... python3 tools/voice/generate-gujarati-voice.py            # the missing takes
    ELEVENLABS_API_KEY=... python3 tools/voice/generate-gujarati-voice.py --only 50,90 --force
"""
import argparse
import base64
import csv
import importlib.util
import json
import os
import re
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANG = 'gu'
OUT = os.path.join(ROOT, 'assets', 'VO-GU')
TAKES = os.path.join(ROOT, 'docs', 'voice', LANG, 'takes.json')
MODEL = 'eleven_v4'
VOICES = {
    'swiftee': ('1wX3DrX9Q7x2fkeiljyg', 'Hetalben - Young Gujarati Customer Care'),
    'game': ('UHwU6ReRgTsCs68KHc6C', 'Bhavesh Bhai - Expressive Gujarati Friend'),
}
SETTINGS = {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True, 'speed': 0.95}
FORMAT = 'mp3_44100_128'
SAID = {'0': 'શૂન્ય', '1': 'એક', '2': 'બે', '3': 'ત્રણ', '4': 'ચાર', '5': 'પાંચ', '6': 'છ', '7': 'સાત',
        '8': 'આઠ', '9': 'નવ'}


def measure_module():
    spec = importlib.util.spec_from_file_location('measure_hindi', os.path.join(HERE, 'measure-hindi-voice.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    m.LANG = LANG
    return m


def script():
    """Every line spoken, once per key: {n, key, en, gu, role}, in number order."""
    m = measure_module()
    L, number = m.script()
    by_n = {}
    for l in m.spoken_lines(L, number):
        row = by_n.setdefault(l['n'], {'n': l['n'], 'key': l['key'], 'en': m.shown(L['en'][l['key']]),
                                       LANG: l[LANG], 'role': 'swiftee'})
        if l['use'] == 'game':
            row['role'] = 'game'
    return [by_n[n] for n in sorted(by_n)]


def spoken(text):
    """What is sent: the line as shown, each numeral as its Gujarati word (a token stays a token)."""
    return re.sub(r'\d', lambda m: SAID[m.group()], text)


def words(alignment):
    """[start, end] of each space-separated word of the text, from ElevenLabs' character alignment."""
    out, cur = [], None
    for c, s, e in zip(alignment['characters'], alignment['character_start_times_seconds'],
                       alignment['character_end_times_seconds']):
        if c.isspace():
            if cur:
                out.append(cur)
            cur = None
        elif cur is None:
            cur = [s, e]
        else:
            cur[1] = e
    if cur:
        out.append(cur)
    return [[round(a, 3), round(b, 3)] for a, b in out]


def record(row, voice, text, alignment, credits, request_id):
    sent = text.split(' ')
    w = words(alignment)
    if ''.join(alignment['characters']) != text or len(w) != len(sent):
        raise SystemExit('%d %s: the alignment is not of the text sent' % (row['n'], row['key']))
    return {'n': row['n'], 'key': row['key'], 'role': row['role'], 'voice': voice, 'voiceName': dict(VOICES.values())[voice],
            'model': MODEL, 'settings': SETTINGS, 'file': '%d_%s.mp3' % (row['n'], row['key']),
            'en': row['en'], LANG: row[LANG], 'text': text, 'characters': len(text), 'credits': credits,
            'request': request_id, 'words': w}


def tts(key, voice, text):
    url = 'https://api.elevenlabs.io/v1/text-to-speech/%s/with-timestamps?output_format=%s' % (voice, FORMAT)
    body = json.dumps({'text': text, 'model_id': MODEL, 'language_code': LANG, 'voice_settings': SETTINGS}).encode()
    for attempt in range(4):
        req = urllib.request.Request(url, data=body, method='POST',
                                     headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.load(res), res.headers
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            raise SystemExit('ElevenLabs: HTTP %d: %s' % (e.code, e.read().decode()[:400]))


def load():
    if os.path.exists(TAKES):
        return {t['n']: t for t in json.load(open(TAKES, encoding='utf-8'))['takes']}
    return {}


def save(takes):
    os.makedirs(os.path.dirname(TAKES), exist_ok=True)
    doc = {
        'about': 'The Gujarati takes, generated by tools/voice/generate-gujarati-voice.py with ElevenLabs '
                 '(assets/VO-GU/<file>). Per take: its number (as the Hindi script numbers the keys), key, '
                 'role (swiftee or game), the voice, model and settings, the text sent (the Gujarati as shown, '
                 'numerals as words), the credits ElevenLabs charged, and `words`: where each word of the text '
                 'starts and ends in the file (seconds), as ElevenLabs aligned it. '
                 'tools/voice/measure-gujarati-voice.py fits these to the waveform for docs/voice/gu/cue-map.json.',
        'language': LANG,
        'takes': [takes[n] for n in sorted(takes)],
    }
    with open(TAKES, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    with open(os.path.join(OUT, 'script.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['file', 'key', 'english', 'gujarati', 'voice', 'characters', 'credits'])
        for n in sorted(takes):
            t = takes[n]
            w.writerow([t['file'], t['key'], t['en'], t[LANG], t['voiceName'].split(' - ')[0], t['characters'], t['credits']])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated line numbers')
    ap.add_argument('--force', action='store_true', help='generate again even where a take is there')
    a = ap.parse_args()
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise SystemExit('Set ELEVENLABS_API_KEY (and have the go-ahead to spend credits).')
    only = set(int(x) for x in a.only.split(',')) if a.only else None
    takes = load()
    os.makedirs(OUT, exist_ok=True)
    spent = 0
    for row in script():
        if only is not None and row['n'] not in only:
            continue
        mp3 = os.path.join(OUT, '%d_%s.mp3' % (row['n'], row['key']))
        if row['n'] in takes and os.path.exists(mp3) and not a.force:
            continue
        voice = VOICES[row['role']][0]
        text = spoken(row[LANG])
        d, headers = tts(key, voice, text)
        open(mp3, 'wb').write(base64.b64decode(d['audio_base64']))
        credits = int(headers.get('character-cost') or 0)
        takes[row['n']] = record(row, voice, text, d['alignment'], credits, headers.get('request-id'))
        save(takes)
        spent += credits
        print('%3d %-24s %-7s %3d chars %3d credits  %s' % (row['n'], row['key'], row['role'], len(text), credits, text))
    print('%d takes; %d credits this run' % (len(takes), spent))


if __name__ == '__main__':
    main()
