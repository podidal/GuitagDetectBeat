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

        this.audioContext = null;
        this.rhythmSources = [];
        this.bpm = 120;
        this.isPlaying = false;
        this.fadeStartTime = 0;
        this.fadeDuration = 2000; // 2 seconds fade-in
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

    setBPM(newBPM) {
        this.bpm = Math.max(40, Math.min(240, newBPM));
    }

    startRhythm(pattern, autoStart = false) {
        // Stop any existing rhythm
        this.stopRhythm();

        // Initialize audio context
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.currentPattern = pattern;
        this.isPlaying = true;
        this.fadeStartTime = this.audioContext.currentTime;

        const secondsPerBeat = 60.0 / this.bpm;
        const secondsPerStep = secondsPerBeat / 4; // 16th notes

        // Create master gain node for fade control
        const masterGain = this.audioContext.createGain();
        masterGain.connect(this.audioContext.destination);
        masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);

        // Fade-in curve
        masterGain.gain.linearRampToValueAtTime(1, 
            this.audioContext.currentTime + this.fadeDuration / 1000
        );

        // Play each sound type in the pattern
        ['kick', 'snare', 'hihat'].forEach(soundType => {
            pattern[soundType].forEach((isActive, index) => {
                if (isActive) {
                    const time = index * secondsPerStep;
                    this.playSound(soundType, time, masterGain);
                }
            });
        });

        // Schedule repeating pattern
        this.rhythmInterval = setInterval(() => {
            const now = this.audioContext.currentTime;
            ['kick', 'snare', 'hihat'].forEach(soundType => {
                pattern[soundType].forEach((isActive, index) => {
                    if (isActive) {
                        const time = now + index * secondsPerStep;
                        this.playSound(soundType, time, masterGain);
                    }
                });
            });
        }, secondsPerBeat * 1000);
    }

    playSound(soundType, time, masterGain) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Different frequencies for each sound type
        const frequencies = {
            kick: 80,    // Low frequency for kick
            snare: 200,  // Mid frequency for snare
            hihat: 6000  // High frequency for hi-hat
        };

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequencies[soundType], time);

        // Envelope
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.7, time + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, time + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(time);
        oscillator.stop(time + 0.1);
    }

    stopRhythm() {
        if (this.rhythmInterval) {
            clearInterval(this.rhythmInterval);
            this.rhythmInterval = null;
        }
        this.isPlaying = false;
    }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmPatterns;
}
