(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuizCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = ['meaning', 'word', 'synonym', 'antonym', 'typing', 'sentence'];
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function normalize(value) {
    return String(value).normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  }
  function cleanSynonyms(value) { return value.replace(/\((?:adj|adv|n|v)\.\)/g, '').replace(/\s*;\s*/g, '; ').trim(); }
  function fairPool(pool, random) {
    const groups = new Map();
    shuffle(pool, random).forEach(word => {
      if (!groups.has(word.unit)) groups.set(word.unit, []);
      groups.get(word.unit).push(word);
    });
    const units = shuffle([...groups.keys()], random);
    const result = [];
    while ([...groups.values()].some(words => words.length)) {
      for (const unit of units) { const word = groups.get(unit).pop(); if (word) result.push(word); }
    }
    return result;
  }
  function optionsFor(word, sense, pool, mode, random) {
    const correct = mode === 'meaning' ? sense.definition : word.word;
    const synonyms = normalize(cleanSynonyms(word.synonyms)).split(/[,;]/).map(s => s.trim().replace(/^to |^an? /g, ''));
    const clueWords = normalize(cleanSynonyms(mode === 'antonym' ? word.antonyms : word.synonyms)).split(/[,;]/).map(s => s.trim().replace(/^to |^an? /g, ''));
    const candidates = shuffle(pool.filter(other => (!['synonym','antonym'].includes(mode) || other.unit === word.unit) && !clueWords.includes(normalize(other.word)) && other.word !== word.word && !synonyms.includes(normalize(other.word))), random);
    const values = [correct];
    for (const other of candidates) {
      const option = mode === 'meaning' ? other.senses[0].definition : other.word;
      if (!values.some(v => normalize(v) === normalize(option)) && !other.senses.some(s => normalize(s.definition) === normalize(sense.definition))) values.push(option);
      if (values.length === 4) break;
    }
    return shuffle(values, random);
  }
  function generate(pool, config = {}, random = Math.random) {
    if (!pool.length) throw new Error('Select at least one unit.');
    const modes = TYPES.filter(type => (config.types || TYPES).includes(type));
    if (!modes.length) throw new Error('Select at least one question style.');
    const count = config.count === 'all' ? pool.length : Math.min(pool.length, Math.max(1, Number(config.count) || 10));
    const cycle = shuffle(modes, random);
    return fairPool(pool, random).slice(0, count).map((word, i) => {
      let type = cycle[i % cycle.length];
      const available = modes.filter(t => t !== 'synonym' && t !== 'antonym' || Boolean((t === 'synonym' ? word.synonyms : word.antonyms).trim()));
      if (!available.includes(type)) type = available[Math.floor(random() * available.length)] || 'word';
      const sense = word.senses[Math.floor(random() * word.senses.length)];
      const match = sense.sentence.match(/\{([^}]+)\}/);
      let answer = type === 'meaning' ? sense.definition : type === 'sentence' ? match[1] : word.word;
      let options = null;
      if (['meaning', 'word', 'synonym', 'antonym', 'sentence'].includes(type)) {
        options = optionsFor(word, sense, config.distractorPool || pool, type, random);
        if (type === 'sentence') options = options.map(option => option === word.word ? answer : option);
      }
      if (options && options.length < 2) { type = 'typing'; answer = word.word; options = null; }
      return { word, sense, type, answer, options, accepted: [...new Set([answer, word.word].map(normalize))] };
    });
  }
  function isCorrect(question, answer) {
    if (question.type === 'typing') return question.accepted.includes(normalize(answer));
    return normalize(answer) === normalize(question.answer);
  }
  return { TYPES, shuffle, normalize, cleanSynonyms, generate, isCorrect };
});
