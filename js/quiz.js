// Тесты: мини-тест после каждого занятия и большой тест, когда пройдены все слова блока.
// Виды вопросов: 'en-ru' — выбрать перевод, 'ru-en' — выбрать английское слово, 'type' — написать самому.
const QUIZ = (() => {
  const SMALL_SIZE = 6;  // вопросов в мини-тесте
  const PASS = 0.8;      // большой тест сдан с 80%
  const KINDS = ['en-ru', 'ru-en', 'type'];

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Писать вручную даём только слова и короткие сочетания, длинные фразы — выбором.
  function canType(w) {
    return /^[a-z' -]+$/i.test(w.en) && w.en.split(' ').length <= 2;
  }

  function question(w, kind, pool, rnd = Math.random) {
    if (kind === 'type' && !canType(w)) kind = 'ru-en';
    if (kind === 'type') return { w, kind, answer: w.en };
    const field = kind === 'en-ru' ? 'ru' : 'en';
    // Неправильные варианты: сначала из того же блока (так труднее угадать), потом из той же темы
    const same = shuffle(pool.filter(o => o.group === w.group && o.topic === w.topic), rnd);
    const topic = shuffle(pool.filter(o => o.topic === w.topic && o.group !== w.group), rnd);
    const wrong = [];
    for (const o of [...same, ...topic, ...shuffle(pool, rnd)]) {
      if (wrong.length === 3) break;
      if (o[field] !== w[field] && !wrong.includes(o[field])) wrong.push(o[field]);
    }
    return { w, kind, answer: w[field], options: shuffle([w[field], ...wrong], rnd) };
  }

  // Мини-тест по словам занятия. Чем лучше знаешь слово, тем труднее вопрос.
  function smallTest(words, state, pool, rnd = Math.random) {
    return shuffle(words, rnd).slice(0, SMALL_SIZE).map(w => {
      const box = state.words[w.id] ? state.words[w.id].box : 0;
      return question(w, box <= 1 ? 'en-ru' : box === 2 ? 'ru-en' : 'type', pool, rnd);
    });
  }

  // Большой тест: все слова блока, виды вопросов по очереди.
  function bigTest(words, pool, rnd = Math.random) {
    return shuffle(words, rnd).map((w, i) => question(w, KINDS[i % KINDS.length], pool, rnd));
  }

  // ---------- Проверка написанного ----------

  const norm = s => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  // 'ok' — верно, 'typo' — одна опечатка в длинном слове (засчитываем), 'wrong' — неверно
  function checkTyped(input, answer) {
    const a = norm(input), b = norm(answer);
    if (a === b) return 'ok';
    if (b.length >= 5 && distance(a, b) === 1) return 'typo';
    return 'wrong';
  }

  // ---------- Блоки ----------

  function blocks(words) {
    const map = new Map();
    for (const w of words) {
      const id = `${w.topic}/${w.group}`;
      if (!map.has(id)) map.set(id, { id, topic: w.topic, title: w.group, words: [] });
      map.get(id).words.push(w);
    }
    return [...map.values()];
  }

  const isPassed = (state, b) => !!(state.blocks[b.id] && state.blocks[b.id].passed);

  // Блоки, где все слова уже встречались, а большой тест ещё не сдан
  function pendingBlocks(state, words) {
    return blocks(words).filter(b => !isPassed(state, b) && b.words.every(w => state.words[w.id]));
  }

  // Записать результат большого теста. Возвращает процент.
  function recordBig(state, block, right) {
    const pct = Math.round(right / block.words.length * 100);
    const prev = state.blocks[block.id] || { best: 0, passed: false };
    state.blocks[block.id] = { best: Math.max(prev.best, pct), passed: prev.passed || right / block.words.length >= PASS };
    return pct;
  }

  return { SMALL_SIZE, PASS, shuffle, canType, question, smallTest, bigTest, checkTyped, blocks, isPassed, pendingBlocks, recordBig };
})();
