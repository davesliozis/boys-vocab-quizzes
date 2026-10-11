(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.VOCAB_DATA, core = window.QuizCore;
  const names = {meaning:'Match the meaning',word:'Pick the word',synonym:'Follow the clues',typing:'Spell it out',sentence:'Fill the gap'};
  const prompts = {meaning:'What does this word mean?',word:'Which word fits this definition?',synonym:'Which word do these clues describe?',typing:'Can you spell the word?',sentence:'Which word completes the sentence?'};
  let grade = '3', selected = new Set([1]), questions = [], current = 0, responses = [], answered = false, roundPool = [], roundConfig = {}, activeUnits = [];
  const selectedByGrade = {'3':new Set([1]),'5':new Set([1])};
  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem('wordquest-settings') || 'null');
      if (!saved) return;
      for (const g of ['3','5']) if (Array.isArray(saved.units?.[g])) selectedByGrade[g] = new Set(saved.units[g].filter(n => Number.isInteger(n) && n >= 1 && n <= 18));
      if (['10','20','30','all'].includes(saved.length)) $('quiz-length').value = saved.length;
      if (Array.isArray(saved.types) && saved.types.some(t => core.TYPES.includes(t))) document.querySelectorAll('[name="mode"]').forEach(input => { input.checked = saved.types.includes(input.value); });
    } catch { /* Storage can be unavailable; the quiz still works. */ }
    selected = selectedByGrade[grade];
    document.querySelector(`[name="grade"][value="${grade}"]`).checked = true;
  }
  function save() {
    try { localStorage.setItem('wordquest-settings', JSON.stringify({grade,units:{'3':[...selectedByGrade['3']],'5':[...selectedByGrade['5']]},length:$('quiz-length').value,types:getTypes()})); } catch { /* Local storage is optional. */ }
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
  function showSection(id) { ['setup','quiz','results'].forEach(section=>{$(section).hidden=section!==id;}); window.scrollTo({top:0,behavior:'instant'}); }
  function start(pool,config) {
    questions=core.generate(pool,config);roundPool=pool;roundConfig=config;current=0;responses=[];activeUnits=[...new Set(pool.map(w=>w.unit))].sort((a,b)=>a-b);showSection('quiz');renderQuestion();
  }
  function renderQuestion() {
    const question=questions[current];answered=false;
    $('question-number').textContent=`Question ${current+1} of ${questions.length}`;
    $('progress-percent').textContent=`${Math.round(current/questions.length*100)}% complete`;
    $('progress-fill').style.width=`${current/questions.length*100}%`;$('progress').setAttribute('aria-valuenow',Math.round(current/questions.length*100));
    $('live-score').textContent=`${responses.filter(r=>r.correct).length} correct`;
    $('quiz-context').textContent=`${grade==='3'?'3rd':'5th'} grade · ${activeUnits.length===1?'Unit '+activeUnits[0]:activeUnits.length+' units'}`;
    $('type-tag').textContent=names[question.type];$('question-unit').textContent=`Unit ${question.word.unit}`;$('quiz-title').textContent=prompts[question.type];
    const clue=$('question-clue');clue.replaceChildren();clue.classList.toggle('word-clue',question.type==='meaning');
    if(question.type==='sentence') {
      const parts=question.sense.sentence.split(/\{[^}]+\}/);clue.append(document.createTextNode(parts[0]),element('span','_____','gap'),document.createTextNode(parts[1]||''));
    } else clue.textContent=question.type==='meaning'?question.word.word:question.type==='synonym'?core.cleanSynonyms(question.word.synonyms):question.sense.definition;
    $('part-of-speech').textContent=question.type==='synonym'?'Synonym clues':({'n.':'Noun','v.':'Verb','adj.':'Adjective','adv.':'Adverb'}[question.sense.pos]||question.sense.pos);
    $('choices').replaceChildren();$('choices').hidden=!question.options;$('typed-wrap').hidden=Boolean(question.options);$('typed-answer').value='';$('typed-answer').disabled=false;$('typed-answer').removeAttribute('aria-invalid');$('check-answer').disabled=false;
    if(question.options)question.options.forEach((option,i)=> {
      const button=element('button',undefined,'choice'+(question.type==='meaning'?' definition-choice':''));button.type='button';button.dataset.answer=option;button.append(element('span',String.fromCharCode(65+i),'letter'),element('span',option,'choice-text'));
      button.addEventListener('click',()=>submit(option));$('choices').append(button);
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
    if(question.word.synonyms)learning.append(element('p',`Synonyms: ${question.word.synonyms}`));feedback.append(learning);$('next').hidden=false;$('next').focus();
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
      if(word.synonyms)article.append(element('p',`Synonyms: ${word.synonyms}`));$('review-list').append(article);
    });$('results-title').focus();
  }
  document.querySelectorAll('[name="grade"]').forEach(input=>input.addEventListener('change',()=>{grade=input.value;selected=selectedByGrade[grade];renderUnits();save();}));
  document.querySelectorAll('[name="mode"]').forEach(input=>input.addEventListener('change',()=>{save();$('setup-error').textContent='';}));
  $('quiz-length').addEventListener('change',save);
  $('select-all').addEventListener('click',()=>{for(let i=1;i<=18;i++)selected.add(i);renderUnits();save();});
  $('clear-units').addEventListener('click',()=>{selected.clear();renderUnits();save();});
  $('start').addEventListener('click',()=>{
    if(!selected.size){$('setup-error').textContent='Choose at least one unit to start.';return;}
    if(!getTypes().length){$('setup-error').textContent='Choose at least one question style.';return;}
    save();start(data[grade].filter(word=>selected.has(word.unit)),{types:getTypes(),count:$('quiz-length').value});
  });
  $('answer-form').addEventListener('submit',event=>{event.preventDefault();submit($('typed-answer').value);});
  $('next').addEventListener('click',()=>{if(!answered)return;if(current===questions.length-1)renderResults();else{current++;renderQuestion();}});
  $('back-setup').addEventListener('click',()=>{showSection('setup');$('unit-title').setAttribute('tabindex','-1');$('unit-title').focus();});
  $('new-quest').addEventListener('click',()=>{showSection('setup');$('start').focus();});
  $('play-again').addEventListener('click',()=>start(roundPool,roundConfig));
  $('practice-missed').addEventListener('click',()=>{const missed=responses.filter(r=>!r.correct).map(r=>r.question.word);start(missed,{types:roundConfig.types,count:'all',distractorPool:roundConfig.distractorPool || roundPool});});
  readSaved();renderUnits();
})();
