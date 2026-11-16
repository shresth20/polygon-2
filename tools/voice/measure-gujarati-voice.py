#!/usr/bin/env python3
"""Measure the Gujarati voice: where each line's speech is and when each of its words starts.

The Gujarati takes were generated with ElevenLabs (tools/voice/generate-gujarati-voice.py), one
file per line, assets/VO-GU/<n>_<key>.mp3, numbered as the Hindi script is. ElevenLabs aligned
each take to the text it was sent (docs/voice/gu/takes.json: each word's start and end), so no
speech recogniser places the words: those starts are fitted to the waveform exactly as the Hindi
tool fits Whisper's (tools/voice/measure-hindi-voice.py, settle()): the first word starts where
the voice does, and a pause in the voice comes between words. This writes
docs/voice/gu/cue-map.json, in the Hindi map's form, for npm run build:gujarati-voice.

With --model, a multilingual Whisper also transcribes each take blind, and the map carries a
check (`heard`, and `match`, how close that is to the script), to catch a take that leaves out
or garbles a word. Without it, the check of the map already there is kept.

    python3 tools/voice/measure-gujarati-voice.py
    <venv>/bin/python tools/voice/measure-gujarati-voice.py --model <faster-whisper model folder>

    --only 50,127      just these line numbers (the rest of the map is kept)
"""
import argparse
import difflib
import importlib.util
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANG = 'gu'
SOURCE = 'assets/VO-GU'
TAKES = os.path.join(ROOT, 'docs', 'voice', LANG, 'takes.json')
MAP = os.path.join(ROOT, 'docs', 'voice', LANG, 'cue-map.json')
SAID = {'0': 'શૂન્ય', '1': 'એક', '2': 'બે', '3': 'ત્રણ', '4': 'ચાર', '5': 'પાંચ', '6': 'છ', '7': 'સાત',
        '8': 'આઠ', '9': 'નવ'}
GUJARATI_DIGITS = str.maketrans('૦૧૨૩૪૫૬૭૮૯', '0123456789')

_spec = importlib.util.spec_from_file_location('measure_hindi', os.path.join(HERE, 'measure-hindi-voice.py'))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)
M.LANG = LANG          # the script's lines in Gujarati, and Whisper's language


def said(token):
    """The words a shown word is said as: numerals as Gujarati words (a suffix kept on: 7થી is
    સાતથી), no punctuation."""
    t = re.sub(r'\d', lambda m: SAID[m.group()], token.translate(GUJARATI_DIGITS))
    t = re.sub(r'[।॥]', ' ', t)
    return re.sub(r'[^\u0A80-\u0AFFA-Za-z]+', ' ', t).split()


def letters(s):
    return ' '.join(w for t in s.split() for w in said(t))


def measure(line, take, aligner):
    path = os.path.join(ROOT, SOURCE, take['file'])
    if not os.path.exists(path):
        return dict(line, missing=True)
    tokens = line[LANG].split(' ')
    if len(tokens) != len(take['words']) or take[LANG] != line[LANG]:
        raise SystemExit('%d %s: the take is not of the line shown (generate it again)' % (line['n'], line['key']))
    # every shown word that says something is placed; a dash says nothing and comes with the word after it
    idx, words, starts, stops = [], [], [], []
    for i, t in enumerate(tokens):
        pieces = said(t)
        if not pieces:
            continue
        idx.append(i)
        words.append(''.join(pieces))
        starts.append(take['words'][i][0])
        stops.append(bool(re.search(r'[,;:।.!?…—]$', t) or (i + 1 < len(tokens) and not said(tokens[i + 1]))))
    samples = M.decode(path, 16000)
    runs = M.speech(samples, 16000)
    fitted, runs = M.settle(starts, runs, stops, words)
    at = [None] * len(tokens)
    for i, t in zip(idx, fitted):
        at[i] = t
    for i in range(len(at) - 1, -1, -1):
        if at[i] is None:
            at[i] = at[i + 1] if i + 1 < len(at) else fitted[-1]
    out = dict(line, speech=[round(runs[0][0], 3), round(runs[-1][1], 3)], words=at,
               runs=[[round(a, 3), round(b, 3)] for a, b in runs], voice=take['voiceName'])
    if aligner:
        heard = aligner.heard(path)
        match = difflib.SequenceMatcher(None, letters(line[LANG]), letters(heard)).ratio()
        out['check'] = {'heard': heard, 'match': round(match, 3)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', help='a multilingual faster-whisper model folder, for the blind check')
    ap.add_argument('--only', help='comma-separated line numbers')
    a = ap.parse_args()
    L, number = M.script()
    lines = M.spoken_lines(L, number)
    takes = {t['n']: t for t in json.load(open(TAKES, encoding='utf-8'))['takes']}
    only = set(int(x) for x in a.only.split(',')) if a.only else None
    old = {}
    if os.path.exists(MAP):
        for l in json.load(open(MAP, encoding='utf-8'))['lines']:
            old[(l['use'], l['n'], l.get('file') or l.get('id'))] = l
    aligner = None
    if a.model:
        aligner = M.Aligner(a.model)
    out = []
    for line in lines:
        k = (line['use'], line['n'], line.get('file') or line.get('id'))
        prev = old.get(k)
        if (only is not None and line['n'] not in only and prev) or line['n'] not in takes:
            out.append(prev or dict(line, missing=True))
            continue
        m = measure(line, takes[line['n']], aligner)
        if prev and prev.get('en') == m['en'] and prev.get(LANG) == m[LANG]:
            if 'cues' in prev:
                m['cues'] = prev['cues']
            if 'check' in prev and 'check' not in m:
                m['check'] = prev['check']
        out.append(m)
        if m.get('missing'):
            print('%3d %-24s MISSING %s' % (m['n'], m['key'], takes[line['n']]['file']))
        else:
            print('%3d %-24s %s %s' % (m['n'], m['key'], ('match %.2f ' % m['check']['match']) if 'check' in m else '',
                  ' '.join('%s@%.2f' % (w, t) for w, t in zip(m[LANG].split(' '), m['words']))))
    doc = {
        'about': 'The Gujarati voice, measured by tools/voice/measure-gujarati-voice.py from the ElevenLabs takes '
                 '(assets/VO-GU/<n>_<key>.mp3, numbered as the Hindi script; docs/voice/gu/takes.json). For each line '
                 'the experience speaks: its number, its key in src/i18n/locales.json, where it is used (lesson: a '
                 'line of src/lesson/recordings.js, built as assets/audio/lesson/gu/<file>; game: a window of Frozen '
                 "Rush's take, CFG.vo.lines <id>), its English and its Gujarati as shown, the voice, where its speech "
                 'starts and ends in the take (seconds), its runs of speech between pauses (`runs`), and where each '
                 'shown word starts (ElevenLabs\' alignment fitted to those runs). `check` is a blind transcription '
                 '(Whisper) and how close it is to the script (`match`, 0-1). A line may carry `cues`: for each '
                 'English word, the index of the Gujarati word on which its cue fires; without it the build works '
                 'them out (tools/voice/build-hindi-voice.py: CONCEPTS_GU). Build with npm run build:gujarati-voice.',
        'language': LANG,
        'source': SOURCE,
        'lines': sorted(out, key=lambda l: (l['use'] != 'lesson', l['n'])),
    }
    with open(MAP, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('%s: %d lines, %d missing' % (os.path.relpath(MAP, ROOT), len(out), sum(1 for l in out if l.get('missing'))))


if __name__ == '__main__':
    main()
