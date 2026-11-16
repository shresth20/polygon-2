#!/usr/bin/env node
/* THE MARATHI VOICE, in the browser, start to end (?lan=mr; src/lesson/recordings-mr.js, Frozen
   Rush's CFG.vo.langs.mr, the ElevenLabs takes): the Hindi voice's test (hindi-voice.test.cjs), run
   in Marathi. Every screen in its Marathi take with its words keeping to it, the recap, the opening
   (the game's tutorial in Vardaan's take, Swiftee's lines over the game in Sayali's), the end and
   the return; Telugu and English keep the English.
   node tests/marathi-voice.test.cjs        PART=lesson|recap|opening|end|others */
process.env.VOICE_LANG = 'mr';
require('./hindi-voice.test.cjs');
