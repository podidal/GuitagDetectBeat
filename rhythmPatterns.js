class RhythmPatterns {
    constructor() {
        this.currentPattern = 'custom';
        this.patterns = {
            basic: {
                name: 'Базовый рок',
                description: 'Классический рок-ритм',
                kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1]
            },
            march: {
                name: 'Военный марш',
                description: 'Строгий маршевый ритм',
                kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
            },
            electronic: {
                name: 'Электронный',
                description: 'Современный электронный бит',
                kick:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                snare: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            },
            reggae: {
                name: 'Регги',
                description: 'Расслабленный регги-ритм',
                kick:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
            },
            funk: {
                name: 'Фанк',
                description: 'Синкопированный фанк-ритм',
                kick:  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
                hihat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0]
            },
            random: {
                name: 'Случайный ритм',
                description: 'Случайно сгенерированный ритм 4/4',
                kick: new Array(16).fill(0),
                snare: new Array(16).fill(0),
                hihat: new Array(16).fill(0)
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
        const pattern = this.patterns[name] || this.patterns.custom;
        // Ensure all values are numbers (1 or 0)
        return {
            ...pattern,
            kick: pattern.kick.map(v => v ? 1 : 0),
            snare: pattern.snare.map(v => v ? 1 : 0),
            hihat: pattern.hihat.map(v => v ? 1 : 0)
        };
    }

    setCustomPattern(instrument, index, value) {
        if (this.patterns.custom[instrument]) {
            this.patterns.custom[instrument][index] = value;
            // Convert to number for consistency
            this.patterns.custom[instrument] = this.patterns.custom[instrument].map(v => v ? 1 : 0);
        }
    }

    generateRandomPattern() {
        // Helper function to get random beats with weight
        const getRandomBeats = (total, weight = 0.3) => {
            const pattern = new Array(16).fill(0);
            // Always set beat on 1 and 9 (main beats in 4/4)
            pattern[0] = 1;
            pattern[8] = 1;
            
            // Add random beats with probability
            for(let i = 0; i < 16; i++) {
                if(i !== 0 && i !== 8 && Math.random() < weight) {
                    pattern[i] = 1;
                }
            }
            return pattern;
        };

        // Generate patterns with different weights for each instrument
        this.patterns.random.kick = getRandomBeats(4, 0.15);  // Less kicks for simplicity
        this.patterns.random.snare = getRandomBeats(4, 0.2);  // Medium snare density
        this.patterns.random.hihat = getRandomBeats(8, 0.4);  // More hi-hats for groove

        return this.patterns.random;
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
