/* THE GUJARATI VOICE (?lan=gu): src/lesson/recordings-gu.js, Frozen Rush's CFG.vo.langs.gu, and the
   lesson playing them, without a browser. The Hindi voice's check (check-hindi-voice.cjs), run on
   the Gujarati takes (the ElevenLabs voice, built by npm run build:gujarati-voice): every line said
   has its take, its file, length and words; each plays, its words shown as they are said; the cues
   fire on the Gujarati words (ખુલ્લી, બંધ, સીધી, વક્ર, બહુકોણ, બાજુઓ, મળે, ખૂણો); the game's take. */
process.env.VOICE_LANG = 'gu';
require('./check-hindi-voice.cjs');
