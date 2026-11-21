const rules = { seed: 4, pumpkin: 10, reward: 8, nights: 3, growth: 2 };
const clock = { morning: 360, evening: 1080, end: 1560, step: 10, interval: 2000 };
const newGame = () => ({
  day: 1, time: clock.morning, night: false, coins: 20, seeds: 0, pumpkins: 0, moon: 0,
  lantern: 0, charges: 0, won: false, beds: Array(4).fill(null)
});

function advanceTime(s, minutes = clock.step) {
  s.time += minutes;
  if (s.time >= clock.end) {
    s.time = clock.morning;
    s.day++;
    s.night = false;
    s.charges = 0;
    return 'Настало утро. Можно сажать и поливать.';
  }
  if (s.time < clock.evening || s.night) return '';
  s.night = true;
  s.charges = rules.nights;
  for (const bed of s.beds) {
    if (bed?.wet) {
      bed.age = Math.min(rules.growth, bed.age + 1);
      bed.wet = false;
    }
  }
  return 'Настала ночь. Алтарь пополнил запас до 3 зарядов.';
}

function allowed(s, action, i) {
  const bed = s.beds[i];
  const ready = bed?.age === rules.growth;
  switch (action) {
    case 'buy': return s.coins >= rules.seed;
    case 'sell': return s.pumpkins > 0;
    case 'plant': return !s.night && bed === null && s.seeds > 0;
    case 'water': return !s.night && bed && !ready && !bed.wet;
    case 'harvest': return ready;
    case 'moon': return ready && s.night && s.charges > 0;
    case 'craft': return s.moon > 0 && !s.lantern && !s.won;
    case 'deliver': return s.lantern > 0 && !s.won;
    case 'rescue': return !s.won && s.coins < rules.seed && !s.seeds &&
      !s.pumpkins && !s.moon && !s.lantern && s.beds.every(b => b === null);
    case 'clock': return true;
    default: return false;
  }
}

function act(s, action, i) {
  if (!allowed(s, action, i)) return '';
  switch (action) {
    case 'buy': s.coins -= rules.seed; s.seeds++; return 'Семя куплено.';
    case 'sell': s.pumpkins--; s.coins += rules.pumpkin; return 'Тыква продана за 10 монет.';
    case 'plant': s.seeds--; s.beds[i] = { age: 0, wet: false }; return 'Семя посажено. Теперь полей грядку.';
    case 'water': s.beds[i].wet = true; return 'Грядка полита.';
    case 'harvest': s.beds[i] = null; s.pumpkins++; return 'Тыква собрана. Её можно продать.';
    case 'moon':
      s.beds[i] = null; s.charges--; s.moon++;
      return 'Получена лунная тыква. Сделай из неё фонарь на верстаке.';
    case 'craft': s.moon--; s.lantern++; return 'Фонарь готов. Отдай его духу.';
    case 'deliver':
      s.lantern--; s.coins += rules.reward; s.won = true;
      return 'Дух принял фонарь, дал 8 монет и открыл тёмную тропу. Задание выполнено!';
    case 'rescue': s.seeds++; return 'Дух подарил тебе семя тыквы.';
    case 'clock': return advanceTime(s, (s.night ? clock.end : clock.evening) - s.time);
  }
}

if (typeof module !== 'undefined') module.exports = { newGame, act, allowed, advanceTime, clock };
