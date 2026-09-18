/* Silent, automatic product illustrations. No microphone, speech recognition,
   analytics, or storage. Pause offscreen; reduced motion starts paused. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Each player owns one timer and preserves its remaining delay when paused.
  // A fresh sequence cancels the old one, including rapid command selections.
  function createPlayer(root, button, frames, labels = { play: 'Play demo', pause: 'Pause demo' }) {
    let sequence = frames;
    let index = 1;
    let remaining = sequence[0].wait;
    let timer = null;
    let deadline = 0;
    let visible = false;
    let wanted = !reducedMotion.matches;
    let running = false;
    sequence[0].run();

    function schedule() {
      deadline = performance.now() + remaining;
      timer = setTimeout(() => {
        timer = null;
        const frame = sequence[index];
        frame.run();
        remaining = frame.wait;
        index = (index + 1) % sequence.length;
        if (running) schedule();
      }, remaining);
    }
    function sync() {
      const next = visible && !document.hidden && wanted;
      if (!next && timer !== null) {
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, deadline - performance.now());
      }
      running = next;
      root.dataset.playback = running ? 'playing' : 'paused';
      button.querySelector('use').setAttribute('href', running ? '#icon-pause' : '#icon-play');
      button.querySelector('span').textContent = running ? labels.pause : labels.play;
      if (running && timer === null) schedule();
    }
    function replace(nextFrames, play = true) {
      clearTimeout(timer);
      timer = null;
      sequence = nextFrames;
      index = 1;
      sequence[0].run();
      remaining = sequence[0].wait;
      wanted = play;
      sync();
    }
    button.addEventListener('click', () => { wanted = !running; sync(); });
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', () => { wanted = !reducedMotion.matches; sync(); });
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      sync();
    }, { threshold: 0.15 }).observe(root);
    sync();
    return { replace, play: () => { wanted = true; sync(); } };
  }

  const hero = $('#prompter-preview');
  const pairs = [...document.querySelectorAll('.script-pair')];
  const words = pairs.flatMap((pair) => [...pair.querySelectorAll('span')]);
  const heroCue = $('#hero-voice-cue');
  function cue(kind, label, text, icon = 'follow') {
    heroCue.dataset.kind = kind;
    $('#hero-cue-label').textContent = label;
    $('#hero-cue-text').textContent = text;
    $('#hero-cue-icon').setAttribute('href', `#icon-${icon}`);
  }
  function moveTo(pairIndex) {
    $('#reading-lines').style.setProperty('--pair-index', pairIndex);
    pairs.forEach((pair, i) => {
      pair.classList.toggle('is-active', i === pairIndex);
      pair.classList.toggle('is-past', i < pairIndex);
    });
  }
  function resetHero(take = 1) {
    hero.dataset.state = 'playing';
    $('#take-counter').textContent = `CUT 01 / TAKE 0${take}`;
    $('#demo-status').textContent = 'Following your words';
    words.forEach((word) => word.classList.remove('current', 'said'));
    $('#demo-progress').style.width = '0%';
    moveTo(0);
    cue('reading', 'YOUR VOICE LEADS', 'The words move with you.');
  }
  const frame = (run, wait = 500) => ({ run, wait });
  function readPair(pairIndex) {
    return [...pairs[pairIndex].querySelectorAll('span')].map((word, i) => frame(() => {
      moveTo(pairIndex);
      const position = words.indexOf(word);
      words.forEach((item, n) => {
        item.classList.toggle('said', n < position);
        item.classList.toggle('current', n === position);
      });
      $('#demo-progress').style.width = `${(position + 1) / words.length * 100}%`;
    }, pairIndex === 2 && i === 1 ? 1100 : 460));
  }
  function finishCut() {
    words.forEach((word) => {
      if (word.classList.contains('current')) word.classList.add('said');
      word.classList.remove('current');
    });
    hero.dataset.state = 'complete';
    $('#demo-status').textContent = 'Cut complete. Your call.';
  }
  const heroFrames = [
    frame(() => resetHero(), 900),
    ...readPair(0), ...readPair(1),
    frame(finishCut, 700),
    frame(() => cue('command', 'YOU SAY', '“Take that again.”', 'restart'), 1600),
    frame(() => { resetHero(2); cue('command', 'BACK TO THE START', 'Take 02. Another go.', 'restart'); }, 1200),
    ...readPair(0), ...readPair(1),
    frame(finishCut, 800),
    frame(() => { cue('keeper', 'YOU SAY', '“That’s the one.”', 'keeper'); hero.dataset.state = 'kept'; $('#demo-status').textContent = 'Take 02 marked as a keeper'; }, 2200),
    frame(() => cue('command', 'YOU SAY', '“Move on.”', 'next'), 1500),
    frame(() => {
      $('#take-counter').textContent = 'CUT 02 / TAKE 01';
      hero.dataset.state = 'playing';
      $('#demo-status').textContent = 'Next cut. Keep going.';
      hero.querySelector('.cut-rail span').textContent = '02';
      cue('reading', 'YOUR VOICE LEADS', 'A breath. The script waits.');
      moveTo(2);
    }, 800),
    ...readPair(2), ...readPair(3),
    frame(() => { finishCut(); cue('keeper', 'STAY IN THE TAKE', 'Your pace. Your words.', 'keeper'); }, 2500),
    frame(() => { hero.querySelector('.cut-rail span').textContent = '01'; }, 100)
  ];
  const heroPlayer = createPlayer(hero, $('#demo-play'), heroFrames);
  $('#demo-restart').addEventListener('click', () => {
    hero.querySelector('.cut-rail span').textContent = '01';
    heroPlayer.replace(heroFrames);
  });
  $('#see-demo').addEventListener('click', () => heroPlayer.play());

  const result = $('#command-result');
  const buttons = [...document.querySelectorAll('.command-option')];
  const miniTrack = $('#mini-track');
  const commands = {
    restart: {
      order: '01 / 03 · RETRY', spoken: '“Take that again.”',
      title: 'Back to your first word.', detail: 'The script rewinds. A fresh take begins.',
      before: 'CUT 01 / TAKE 01', after: 'CUT 01 / TAKE 02',
      lines: ['You have', 'something to say.', 'Give yourself', 'room to say it.']
    },
    keep: {
      order: '02 / 03 · KEEP', spoken: '“That’s the one.”',
      title: 'One less take to hunt for.', detail: 'Your keeper is marked in the take log.',
      before: 'CUT 01 / TAKE 02', after: 'CUT 01 / TAKE 02',
      lines: ['You have', 'something to say.', 'Give yourself', 'room to say it.']
    },
    next: {
      order: '03 / 03 · NEXT', spoken: '“Move on.”',
      title: 'New cut. Same momentum.', detail: 'The next part of your script moves into place.',
      before: 'CUT 01 / TAKE 02', after: 'CUT 02 / TAKE 01',
      lines: ['Give yourself', 'room to say it.', 'A breath.', 'Another try.']
    }
  };
  function setMiniLines(lines) {
    miniTrack.replaceChildren(...[0, 2].map((i) => {
      const paragraph = document.createElement('p');
      paragraph.append(lines[i], document.createElement('br'), lines[i + 1]);
      return paragraph;
    }));
  }
  function prepareCommand(key) {
    const command = commands[key];
    result.dataset.commandState = key;
    result.dataset.phase = 'before';
    buttons.forEach((button) => {
      const selected = button.dataset.command === key;
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#result-spoken').textContent = command.spoken;
    $('#result-icon-use').setAttribute('href', `#icon-${key === 'keep' ? 'keeper' : key}`);
    $('#result-title').textContent = command.title;
    $('#result-detail').textContent = command.detail;
    $('#result-cut').textContent = command.before;
    $('#command-step').textContent = command.order;
    $('#log-take').textContent = key === 'restart' ? '01 / TAKE 01' : '01 / TAKE 02';
    $('#log-state').textContent = key === 'restart' ? 'In progress' : key === 'keep' ? 'Unmarked' : 'Keeper';
    $('#take-log').classList.toggle('is-kept', key === 'next');
    $('#command-progress').style.width = '0%';
    miniTrack.classList.add('no-transition');
    setMiniLines(command.lines);
    miniTrack.style.setProperty('--mini-position', key === 'next' ? 0 : 1);
  }
  function performCommand(key) {
    result.dataset.phase = 'after';
    $('#result-cut').textContent = commands[key].after;
    if (key === 'restart') {
      miniTrack.style.setProperty('--mini-position', 0);
      $('#log-take').textContent = '01 / TAKE 02';
      $('#log-state').textContent = 'New take';
    } else if (key === 'keep') {
      $('#take-log').classList.add('is-kept');
      $('#log-state').textContent = 'Keeper';
    } else {
      miniTrack.style.setProperty('--mini-position', 1);
      $('#log-state').textContent = 'Keeper';
    }
    $('#command-progress').style.width = '78%';
  }
  function commandFrames(startKey = 'restart', singleCommand = false) {
    const keys = ['restart', 'keep', 'next'];
    const startIndex = keys.indexOf(startKey);
    // Browsing cycles through all three; choosing a card keeps that example
    // selected so the automatic sequence never takes control away from a click.
    const order = singleCommand ? [startKey] : [...keys.slice(startIndex), ...keys.slice(0, startIndex)];
    return order.flatMap((key) => [
      frame(() => prepareCommand(key), 500),
      frame(() => { miniTrack.classList.remove('no-transition'); result.dataset.phase = 'listening'; $('#command-progress').style.width = '24%'; }, 1200),
      frame(() => { result.dataset.phase = 'heard'; $('#command-progress').style.width = '44%'; }, 900),
      frame(() => performCommand(key), 2700),
      frame(() => { $('#command-progress').style.width = '100%'; }, 900)
    ]);
  }
  const commandPlayer = createPlayer(result, $('#command-play'), commandFrames());
  buttons.forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.command;
    commandPlayer.replace(commandFrames(key, true), !reducedMotion.matches);
    if (reducedMotion.matches) performCommand(key);
    $('#command-announcement').textContent = `${commands[key].spoken} ${commands[key].detail}`;
  }));

  // The app's five-second purple countdown, given a larger marketing stage.
  // This is a silent illustration, never a delayed launch or recording action.
  const countdown = $('#closing-countdown');
  const countdownFrames = [5, 4, 3, 2, 1, 0].map((n) => frame(() => {
    countdown.dataset.count = String(n);
    countdown.dataset.beat = n % 2 ? 'a' : 'b';
    $('#countdown-number').textContent = n ? String(n) : 'Go.';
    $('#countdown-words').textContent = n >= 4 ? 'Find your mark.' : n >= 2 ? 'Take a breath.' : n === 1 ? 'The words are next.' : 'Make it yours.';
    $('#countdown-progress').style.strokeDashoffset = String((5 - n) * 20);
  }, n ? 1000 : 3500));
  createPlayer(countdown, $('#countdown-play'), countdownFrames, { play: 'Play animation', pause: 'Pause animation' });
})();
