/* THE MARATHI VOICE (?lan=mr): src/lesson/recordings-mr.js, Frozen Rush's CFG.vo.langs.mr, and the
   lesson playing them, without a browser. The Hindi voice's check (check-hindi-voice.cjs), run on
   the Marathi takes (the ElevenLabs voice, built by npm run build:marathi-voice): every line said has
   its take, its file, length and words; each plays, its words shown as they are said; the cues fire
   on the Marathi words (खुली, बंद, सरळ, वक्र, बहुभुजाकृती, बाजू, मिळतात, कोनही); the game's take. */
process.env.VOICE_LANG = 'mr';
require('./check-hindi-voice.cjs');
