
export const RANKS = [
    { level: 1, name: 'Novice Trader' },
    { level: 10, name: 'Bronze Merchant' },
    { level: 30, name: 'Iron Investor' },
    { level: 50, name: 'Steel Tycoon' },
    { level: 70, name: 'Mithril Magnate' },
    { level: 90, name: 'Adamant Financier' },
    { level: 99, name: 'Rune Grandmaster' },
];

export const getRankForLevel = (level: number): string => {
    let currentRank = 'Novice Trader';
    for (const rank of RANKS) {
        if (level >= rank.level) {
            currentRank = rank.name;
        } else {
            break;
        }
    }
    return currentRank;
};

// This table stores the *total* XP required to reach a certain level.
// Level 1 requires 0 XP. To reach level 2, you need 83 total XP.
const xp_table: number[] = [
    0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411, 2746, 3115, 3523, 3973, 4470, 
    5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031, 13363, 14833, 16456, 18247, 20224, 22406, 24815, 27473, 
    30408, 33648, 37224, 41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333, 111945, 123660, 
    136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742, 302288, 333804, 368599, 407015, 449428, 496254,
    547953, 605032, 668051, 737627, 814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581, 1629200, 1798808, 
    1986068, 2192818, 2421087, 2673114, 2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332, 5902831, 
    6517253, 7195629, 7944614, 8771558, 9684577, 10692629, 11805606, 13034431
];

export const getTotalXpForLevel = (level: number): number => {
    if (level < 1) return 0;
    if (level > 99) level = 99;
    return xp_table[level - 1];
};

export const getLevelForXp = (xp: number): number => {
    if (xp <= 0) return 1;
    for (let i = 0; i < xp_table.length; i++) {
        if (xp < xp_table[i]) {
            return i;
        }
    }
    return 99;
};
