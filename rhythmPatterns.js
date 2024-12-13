class RhythmPatterns {
    constructor() {
        this.currentPattern = 'custom';
        this.patterns = {
            basic: {
                name: 'Простой ритм',
                description: 'Базовый ритм 4/4',
                kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            march: {
                name: 'Марш',
                description: 'Простой маршевый ритм',
                kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            pop: {
                name: 'Поп-ритм',
                description: 'Простой поп-ритм',
                kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            rock: {
                name: 'Рок-ритм',
                description: 'Базовый рок-ритм',
                kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            dance: {
                name: 'Танцевальный',
                description: 'Простой танцевальный ритм',
                kick:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
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
