export const countries = [
  { id: 'ukraine', name: 'Україна', icon: '🌻', color: '#3f8cff', chapter: 'Соняшникові поля чекають на команду рятівників.' },
  { id: 'poland', name: 'Польща', icon: '🦅', color: '#f4476b', chapter: 'Міські площі кличуть героїв на веселу оборону.' },
  { id: 'japan', name: 'Японія', icon: '🌸', color: '#ff7bac', chapter: 'Сакура підказує шлях до наступного Мегабокса.' },
  { id: 'brazil', name: 'Бразилія', icon: '🌴', color: '#2fc769', chapter: 'Джунглі шумлять: зомбі заблукали серед пальм.' },
  { id: 'egypt', name: 'Єгипет', icon: '🐪', color: '#f2b84b', chapter: 'Піраміди сховали фінальний ключ до боса.' },
];

export const fighters = [
  {
    id: 'artem',
    name: 'Артем Блискавка',
    role: 'швидкий герой',
    emoji: '⚡',
    color: '#36d4ff',
    baseHp: 135,
    baseDamage: 34,
    hpPerLevel: 18,
    damagePerLevel: 7,
    unlockText: 'Стартовий герой — завжди готовий рятувати країни!',
  },
  {
    id: 'sofia',
    name: 'Софія Щит',
    role: 'захисниця команди',
    emoji: '🛡️',
    color: '#9b7cff',
    baseHp: 175,
    baseDamage: 26,
    hpPerLevel: 24,
    damagePerLevel: 5,
    unlockText: 'Софія бере удар на себе й тримає лінію.',
  },
  {
    id: 'maks',
    name: 'Макс Ракета',
    role: 'сильний атакер',
    emoji: '🚀',
    color: '#ff8b38',
    baseHp: 120,
    baseDamage: 44,
    hpPerLevel: 14,
    damagePerLevel: 9,
    unlockText: 'Макс робить яскравий ракетний ривок у безпечному мультяшному стилі.',
  },
  {
    id: 'lina',
    name: 'Ліна Іскра',
    role: 'розумна тактикиня',
    emoji: '✨',
    color: '#53e69d',
    baseHp: 145,
    baseDamage: 32,
    hpPerLevel: 19,
    damagePerLevel: 8,
    unlockText: 'Ліна шукає слабке місце зомбі й підбадьорює друзів.',
  },
  {
    id: 'danylo',
    name: 'Данило Лев',
    role: 'потужний фінішер',
    emoji: '🦁',
    color: '#ffd447',
    baseHp: 160,
    baseDamage: 39,
    hpPerLevel: 21,
    damagePerLevel: 8,
    unlockText: 'Данило ричить як лев і веде команду до боса.',
  },
];

export const boss = {
  id: 'bul-bul',
  name: 'Зомбі-Бос Буль-Буль',
  hp: 1200,
  damage: 58,
  emoji: '🧟‍♂️',
};

export const MAX_FIGHTER_LEVEL = 10;
export const LEVELS_PER_COUNTRY = 25;
export const MEGA_BOX_LEVEL = 10;
export const MEGA_BOX_UNLOCK_CHANCE = 0.56;
export const PITY_TOKENS_FOR_UNLOCK = 2;
