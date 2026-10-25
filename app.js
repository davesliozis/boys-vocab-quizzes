(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.VOCAB_DATA, core = window.QuizCore;
  const names = {meaning:'Match the meaning',word:'Pick the word',synonym:'Synonym clues',antonym:'Antonym clues',typing:'Spell it out',sentence:'Fill the gap'};
  const prompts = {meaning:'What does this word mean?',word:'Which word fits this definition?',synonym:'Which word has these synonyms?',antonym:'Which word has these antonyms?',typing:'Can you spell the word?',sentence:'Which word completes the sentence?'};
  let grade = '3', selected = new Set(), questions = [], current = 0, responses = [], answered = false, selectedAnswer = null, roundPool = [], roundConfig = {}, activeUnits = [];
  const selectedByGrade = {'3':new Set(),'5':new Set()};
  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem('wordquest-settings') || 'null');
      if (!saved) return;
      if (['10','20','30','all'].includes(saved.length)) $('quiz-length').value = saved.length;
      if (Array.isArray(saved.types) && saved.types.some(t => core.TYPES.includes(t))) document.querySelectorAll('[name="mode"]').forEach(input => { input.checked = saved.types.includes(input.value) || (input.value === 'antonym' && !saved.clueQuestionsV2); });
    } catch { /* Storage can be unavailable; the quiz still works. */ }
    selected = selectedByGrade[grade];
    document.querySelector(`[name="grade"][value="${grade}"]`).checked = true;
  }
  function save() {
    try { localStorage.setItem('wordquest-settings', JSON.stringify({clueQuestionsV2:true,grade,units:{'3':[...selectedByGrade['3']],'5':[...selectedByGrade['5']]},length:$('quiz-length').value,types:getTypes()})); } catch { /* Local storage is optional. */ }
  }
  function getTypes() { return [...document.querySelectorAll('[name="mode"]:checked')].map(input => input.value); }
  function element(tag, text, className) { const el=document.createElement(tag); if(text!==undefined)el.textContent=text; if(className)el.className=className; return el; }
  function renderUnits() {
    $('unit-grid').replaceChildren(element('legend','Select units to practice','sr-only'));
    for(let n=1;n<=18;n++) {
      const label=element('label',undefined,'unit'), input=element('input');input.type='checkbox';input.value=n;input.checked=selected.has(n);input.setAttribute('aria-label',`Unit ${n}`);
      const span=element('span');span.append(element('small','Unit'),element('strong',n));label.append(input,span);
      input.addEventListener('change',()=>{if(input.checked)selected.add(n);else selected.delete(n);updateSelection();save();});$('unit-grid').append(label);
    }
    updateSelection();
  }
  function updateSelection() {
    const words=data[grade].filter(word=>selected.has(word.unit));
    $('selection-note').textContent=`${selected.size} ${selected.size===1?'unit':'units'} selected · ${words.length} words`;
    $('word-preview').replaceChildren();
    if(words.length) {
      $('word-preview').append(element('strong','A peek at your words: '),document.createTextNode(words.slice(0,6).map(word=>word.word).join(', ')+(words.length>6?'…':'')));
    } else $('word-preview').textContent='Choose at least one unit to start your adventure.';
    $('setup-error').textContent='';
  }
  function showSection(id) { if(confettiCleanup)confettiCleanup(); ['setup','quiz','results'].forEach(section=>{$(section).hidden=section!==id;}); window.scrollTo({top:0,behavior:'instant'}); }
  function start(pool,config) {
    questions=core.generate(pool,config);roundPool=pool;roundConfig=config;current=0;responses=[];activeUnits=[...new Set(pool.map(w=>w.unit))].sort((a,b)=>a-b);showSection('quiz');renderQuestion();
  }
  function renderQuestion() {
    const question=questions[current];answered=false;selectedAnswer=null;
    $('question-number').textContent=`Question ${current+1} of ${questions.length}`;
    $('progress-percent').textContent=`${Math.round(current/questions.length*100)}% complete`;
    $('progress-fill').style.width=`${current/questions.length*100}%`;$('progress').setAttribute('aria-valuenow',Math.round(current/questions.length*100));
    $('live-score').textContent=`${responses.filter(r=>r.correct).length} correct`;
    $('quiz-context').textContent=`${grade==='3'?'3rd':'5th'} grade · ${activeUnits.length===1?'Unit '+activeUnits[0]:activeUnits.length+' units'}`;
    $('type-tag').textContent=names[question.type];$('question-unit').textContent=`Unit ${question.word.unit}`;$('quiz-title').textContent=prompts[question.type];
    const clue=$('question-clue');clue.replaceChildren();clue.classList.toggle('word-clue',question.type==='meaning');
    if(question.type==='sentence') {
      const parts=question.sense.sentence.split(/\{[^}]+\}/);clue.append(document.createTextNode(parts[0]),element('span','_____','gap'),document.createTextNode(parts[1]||''));
    } else clue.textContent=question.type==='meaning'?question.word.word:question.type==='synonym'?core.cleanSynonyms(question.word.synonyms):question.type==='antonym'?core.cleanSynonyms(question.word.antonyms):question.sense.definition;
    $('part-of-speech').textContent=question.type==='synonym'?'Synonyms — words with similar meanings':question.type==='antonym'?'Antonyms — words with opposite meanings':({'n.':'Noun','v.':'Verb','adj.':'Adjective','adv.':'Adverb'}[question.sense.pos]||question.sense.pos);
    $('choices').replaceChildren();$('choices').hidden=!question.options;$('typed-wrap').hidden=Boolean(question.options);$('typed-answer').value='';$('typed-answer').disabled=false;$('typed-answer').removeAttribute('aria-invalid');$('check-answer').disabled=Boolean(question.options);
    if(question.options)question.options.forEach((option,i)=> {
      const button=element('button',undefined,'choice'+(question.type==='meaning'?' definition-choice':''));button.type='button';button.dataset.answer=option;button.append(element('span',String.fromCharCode(65+i),'letter'),element('span',option,'choice-text'));
      button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(answered)return;selectedAnswer=option;for(const choice of $('choices').children){const chosen=choice===button;choice.classList.toggle('selected',chosen);choice.setAttribute('aria-pressed',String(chosen));}$('check-answer').disabled=false;});$('choices').append(button);
    });
    $('feedback').hidden=true;$('feedback').replaceChildren();$('next').hidden=true;$('next').textContent=current===questions.length-1?'See my results →':'Next question →';
    $('quiz-title').focus();
  }
  function submit(answer) {
    if(answered)return;
    if(!answer.trim()){ $('typed-answer').focus();return; }
    const question=questions[current], correct=core.isCorrect(question,answer);answered=true;responses.push({question,answer,correct});
    $('typed-answer').disabled=true;$('check-answer').disabled=true;
    for(const button of $('choices').children) {
      button.disabled=true;
      if(core.isCorrect(question,button.dataset.answer)) {button.classList.add('correct');button.querySelector('.choice-text').append(element('span','✓ Correct answer','answer-state'));}
      else if(button.dataset.answer===answer){button.classList.add('wrong');button.querySelector('.choice-text').append(element('span','Your choice','answer-state'));}
      else button.classList.add('dimmed');
    }
    $('live-score').textContent=`${responses.filter(r=>r.correct).length} correct`;
    const feedback=$('feedback');feedback.hidden=false;feedback.classList.toggle('wrong',!correct);feedback.append(element('strong',correct?'You got it! ✦':`Good try. The answer is “${question.answer}.”`));
    const learning=element('div',undefined,'learning');learning.append(element('p',`${question.word.word} (${question.sense.pos}) — ${question.sense.definition}`));
    if(question.word.synonyms)learning.append(element('p',`Synonyms: ${question.word.synonyms}`));if(question.word.antonyms)learning.append(element('p',`Antonyms: ${question.word.antonyms}`));feedback.append(learning);$('next').hidden=false;$('next').focus();
  }
  let confettiCleanup;
  function celebratePerfectScore() {
    if (confettiCleanup) confettiCleanup();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const shower=element('div',undefined,'confetti-shower');shower.setAttribute('aria-hidden','true');
    const colors=['#ffcd56','#ff6b8b','#57c9bb','#728cff','#b58aff'];
    for(let i=0;i<100;i++) {
      const piece=element('i',undefined,'confetti-piece');
      piece.style.left=`${Math.random()*100}%`;piece.style.background=colors[i%colors.length];
      piece.style.setProperty('--delay',`${Math.random()*1.8}s`);piece.style.setProperty('--duration',`${2.5+Math.random()*1.5}s`);
      piece.style.setProperty('--drift',`${Math.random()*180-90}px`);piece.style.setProperty('--spin',`${Math.random()*1080-540}deg`);
      shower.append(piece);
    }
    document.body.append(shower);
    const timer=setTimeout(()=>shower.remove(),6000);
    confettiCleanup=()=>{clearTimeout(timer);shower.remove();confettiCleanup=null;};
  }
  function renderResults() {
    showSection('results');const correct=responses.filter(r=>r.correct).length, missed=responses.filter(r=>!r.correct);const percent=Math.round(correct/questions.length*100);
    $('final-score').textContent=`${correct} / ${questions.length}`;$('final-percent').textContent=`${percent}%`;
    $('result-message').textContent=percent===100?'Every word, nailed it! Ready for a new adventure?':percent>=70?'Nice exploring! A few more discoveries are waiting for you.':'Every word you practice is progress. Let’s revisit a few together.';
    $('practice-missed').hidden=!missed.length;$('review-title').textContent=missed.length?'Words to revisit':'You know these words!';$('review-note').textContent=missed.length?'A missed answer is a chance to make a word stick.': 'A little review keeps them fresh in your memory.';$('review-list').replaceChildren();
    (missed.length?missed:responses).forEach(response=>{
      const word=response.question.word, article=element('article',undefined,'review-entry'), header=element('div',undefined,'review-heading');header.append(element('h3',word.word),element('span',`Unit ${word.unit}`));article.append(header);
      if(!response.correct)article.append(element('p',`You answered: ${response.answer} · Answer: ${response.question.answer}`,'your-answer'));
      word.senses.forEach(sense=>article.append(element('p',`(${sense.pos}) ${sense.definition}`)));
      if(word.synonyms)article.append(element('p',`Synonyms: ${word.synonyms}`));if(word.antonyms)article.append(element('p',`Antonyms: ${word.antonyms}`));$('review-list').append(article);
    });$('results-title').focus();if(correct===questions.length)celebratePerfectScore();
  }
  document.querySelectorAll('[name="grade"]').forEach(input=>input.addEventListener('change',()=>{grade=input.value;selected=selectedByGrade[grade];renderUnits();save();}));
  document.querySelectorAll('[name="mode"]').forEach(input=>input.addEventListener('change',()=>{save();$('setup-error').textContent='';}));
  $('quiz-length').addEventListener('change',save);
  $('select-all').addEventListener('click',()=>{for(let i=1;i<=18;i++)selected.add(i);renderUnits();save();});
  $('clear-units').addEventListener('click',()=>{selected.clear();renderUnits();save();});
  $('start').addEventListener('click',()=>{
    if(!selected.size){$('setup-error').textContent='Choose at least one unit to start.';return;}
    if(!getTypes().length){$('setup-error').textContent='Choose at least one question style.';return;}
    save();start(data[grade].filter(word=>selected.has(word.unit)),{types:getTypes(),count:$('quiz-length').value,distractorPool:data[grade].filter(w=>selected.has(w.unit))});
  });
  $('answer-form').addEventListener('submit',event=>{event.preventDefault();submit(questions[current].options ? (selectedAnswer || '') : $('typed-answer').value);});
  $('next').addEventListener('click',()=>{if(!answered)return;if(current===questions.length-1)renderResults();else{current++;renderQuestion();}});
  $('back-setup').addEventListener('click',()=>{showSection('setup');$('unit-title').setAttribute('tabindex','-1');$('unit-title').focus();});
  $('new-quest').addEventListener('click',()=>{showSection('setup');$('start').focus();});
  $('play-again').addEventListener('click',()=>start(roundPool,roundConfig));
  $('practice-missed').addEventListener('click',()=>{const missed=responses.filter(r=>!r.correct).map(r=>r.question.word);start(missed,{types:roundConfig.types,count:'all',distractorPool:data[grade].filter(w=>activeUnits.includes(w.unit))});});
  readSaved();renderUnits();
})();

// Palettes sampled from https://colorhunt.co/palettes/popular on October 14, 2026.
(() => {
 const palettes = ["081139f09248ddddddeeeeee","0107360d1c4222396ffcf1d0", "d8a2a2ffdcdcfff9d68ea66b", "fffad3ffdbb0ffccb8ffb1b1", "790d16e5d3aff5efe1aec4d4", "425b9a76c0ecfff6dcff95a5", "6e351191ac67597928fcecd8", "f5efe34f5b2ab8892dd8c9a8", "db9558fcf9ea97a87aa8bba3", "f9e6a8f2a900cc6f004d2a00", "8e1ea2c654c3ed96d7ffc0de", "2373f4578ef565d0f4f2f7a0", "f6e2e9fefaf3b8cfb384a282", "5c705789a482acc5a6d1edd3", "fcf0daaeac78f2c46a4c4541", "e11a45e3afc9efecd7edc92c", "7d9c65b93636ff9c4cfff2a0", "fef3e2f4ae52d4621a2a1a0e", "287a7455a9a0aeeed3fff8b0", "8ad6d1359fa0fff0c5ff8c52", "de7272ffca88fff6a9b4e4d6", "0862884d8dba97d7ffffefc4", "522d6080426ef2a67bffd38b", "4c23657f5d999e7eb5c4a4da", "ffced8ffddddfff4deffe8c4"];
 const rgb = hex => hex.match(/\w\w/g).map(n=>parseInt(n,16));
 const hex = values => '#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
 const luminance = color => rgb(color.slice(1)).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
 const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 const readable = (color,bg) => {let c=color;while(ratio(c,bg)<4.5)c=hex(rgb(c.slice(1)).map(n=>n*.9));return c;};
 let active=-1;
 function change() {
  let next=Math.floor(Math.random()*(palettes.length-1)); if(next>=active && active>=0)next++; if(active<0)next=Math.floor(Math.random()*palettes.length);active=next;
  const colors=palettes[next].match(/.{6}/g).map(c=>'#'+c).sort((a,b)=>luminance(a)-luminance(b));
  const bg=colors[3], ink=readable(colors[0],bg), accent=readable(colors[1],'#ffffff');
  const soft=hex(rgb(colors[2].slice(1)).map(n=>n*.25+255*.75));
  const vars={'cream':bg,'ink':ink,'muted':readable(colors[0],bg),'purple':accent,'purple-dark':readable(accent,bg),'lavender':soft,'white':'#ffffff','teal':ink,'line':hex(rgb(colors[2].slice(1)).map(n=>n*.5+255*.5)),'card-one':colors[2],'card-one-ink':readable(colors[0],colors[2]),'card-two':colors[1],'card-two-ink':ratio('#ffffff',colors[1])>=4.5?'#ffffff':readable(colors[0],colors[1]),'heading':readable(colors[1],bg)};
  Object.entries(vars).forEach(([key,value])=>document.documentElement.style.setProperty('--'+key,value));
  document.querySelector('meta[name="theme-color"]').content=bg;
  document.getElementById('theme-status').textContent='New color theme selected.';
 }
 document.getElementById('change-colors').addEventListener('click',change);change();
})();
