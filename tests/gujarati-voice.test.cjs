#!/usr/bin/env node
/* THE GUJARATI VOICE, in the browser, start to end (?lan=gu; src/lesson/recordings-gu.js, Frozen
   Rush's CFG.vo.langs.gu, the ElevenLabs takes): the Hindi voice's test (hindi-voice.test.cjs), run
   in Gujarati. Every screen in its Gujarati take with its words keeping to it, the recap, the opening
   (the game's tutorial in Bhavesh Bhai's take, Swiftee's lines over the game in Hetalben's), the end
   and the return; Telugu and English keep the English.
   node tests/gujarati-voice.test.cjs        PART=lesson|recap|opening|end|others */
process.env.VOICE_LANG = 'gu';
require('./hindi-voice.test.cjs');
