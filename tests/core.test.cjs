const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../core.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),context);
const data=JSON.parse(JSON.stringify(context.window.VOCAB_DATA));
function seeded(seed) { return () => { seed=(seed*1664525+1013904223)>>>0;return seed/4294967296; }; }
test('both workbooks contain all units, senses, sentence answers and unique entry IDs',()=>{
  for(const [grade,expected] of [['3',180],['5',216]]) {
    assert.equal(data[grade].length,expected);assert.equal(new Set(data[grade].map(w=>w.id)).size,expected);
    for(let unit=1;unit<=18;unit++)assert.equal(data[grade].filter(w=>w.unit===unit).length,grade==='3'?10:12);
    for(const word of data[grade])for(const sense of word.senses){assert.ok(sense.definition);assert.match(sense.sentence,/\{[^}]+\}/);}
  }
});
test('all units and modes generate answerable quizzes with unique words and unique choices',()=>{
  for(const grade of ['3','5'])for(let unit=1;unit<=18;unit++)for(const type of core.TYPES)for(let seed=1;seed<=8;seed++) {
    const pool=data[grade].filter(w=>w.unit===unit),questions=core.generate(pool,{types:[type],count:'all'},seeded(seed));
    assert.equal(questions.length,pool.length);assert.equal(new Set(questions.map(q=>q.word.id)).size,pool.length);
    for(const q of questions){assert.ok(core.isCorrect(q,q.answer));assert.ok(!core.isCorrect(q,'wrong'));if(q.options){assert.equal(new Set(q.options.map(core.normalize)).size,q.options.length);assert.equal(q.options.filter(o=>core.isCorrect(q,o)).length,1);assert.ok(q.options.length>=2);}}
  }
});
test('short mixed rounds sample different selected units and vary styles',()=>{
 const pool=data['5'].filter(w=>[1,5,18].includes(w.unit));const q=core.generate(pool,{count:10},seeded(14));assert.equal(q.length,10);assert.equal(new Set(q.map(q=>q.word.unit)).size,3);assert.equal(new Set(q.map(q=>q.type)).size,5);
});
test('single missed-word retries remain valid, including multiple-choice styles',()=>{
 for(const type of core.TYPES){const q=core.generate([data['5'][0]],{count:'all',types:[type]})[0];assert.ok(core.isCorrect(q,q.answer));}
});
test('typing ignores case and extra whitespace but does not accept misspellings',()=>{
 const q=core.generate([data['5'][0]],{types:['typing']})[0];assert.ok(core.isCorrect(q,'  '+q.answer.toUpperCase()+'  '));assert.ok(!core.isCorrect(q,q.answer+'z'));
});
test('empty unit or mode selections fail clearly',()=>{
 assert.throws(()=>core.generate([]),/unit/);assert.throws(()=>core.generate(data['3'],{types:[]}),/style/);
});
