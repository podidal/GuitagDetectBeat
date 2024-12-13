class RhythmPatterns {
    constructor() {
        this.currentPattern = 'custom';
        this.patterns = {
            sixEight: {
                name: 'Шестерка бой',
                description: 'Классический шестерочный бой (6/8)',
                kick:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
                snare: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            eightBeat: {
                name: 'Восьмерка бой',
                description: 'Популярный восьмерочный бой (4/4)',
                kick:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                snare: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            quarterBeat: {
                name: 'Четвертной бой',
                description: 'Простой четвертной бой (4/4)',
                kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            fastFinger: {
                name: 'Быстрый перебор',
                description: 'Быстрый пальцевой перебор',
                kick:  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                snare: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            syncopated: {
                name: 'Синкопированный',
                description: 'Синкопированный ритм',
                kick:  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
                hihat: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1]
            },
            waltz: {
                name: 'Вальсовый',
                description: 'Вальсовый ритм (3/4)',
                kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            rumba: {
                name: 'Румба',
                description: 'Румба гитарный ритм',
                kick:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                snare: [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1],
                hihat: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1]
            },
            bossaNova: {
                name: 'Босса-нова',
                description: 'Босса-нова гитарный ритм',
                kick:  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            custom: {
                name: 'Свой ритм',
                description: 'Создайте свой ритм',
                kick:  new Array(16).fill(false),
                snare: new Array(16).fill(false),
                hihat: new Array(16).fill(false)
            }
        };
    }

    getPattern(name) {
        return this.patterns[name] || this.patterns.custom;
    }

    setCustomPattern(instrument, index, value) {
        if (this.patterns.custom[instrument]) {
            this.patterns.custom[instrument][index] = value;
        }
    }

    getAllPatterns() {
        return Object.entries(this.patterns).map(([id, pattern]) => ({
            id,
            name: pattern.name,
            description: pattern.description
        }));
    }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmPatterns;
}
