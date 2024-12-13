class RhythmPatterns {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.rhythmSources = [];
        this.isPlaying = false;
        this.currentBPM = 90;
        this.masterGainNode = null;
        
        // Fade-in properties
        this.fadeInDuration = 2; // seconds
        this.fadeInStartTime = 0;
        
        // Rhythm playback properties
        this.rhythmInterval = null;
        this.beatCallback = null;
        
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
    }

    setupMasterGain() {
        // Create master gain node for volume control
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.masterGainNode.connect(this.audioContext.destination);
    }

    startRhythmWithFadeIn() {
        if (this.isPlaying) return;

        this.setupMasterGain();
        this.isPlaying = true;
        this.fadeInStartTime = this.audioContext.currentTime;

        // Exponential fade-in for smoother volume increase
        this.masterGainNode.gain.exponentialRampToValueAtTime(
            1, 
            this.audioContext.currentTime + this.fadeInDuration
        );

        // Start rhythm playback
        this.startRhythmLoop();
    }

    startRhythmLoop() {
        // Calculate beat interval based on BPM
        const beatInterval = 60 / this.currentBPM;
        
        // Create oscillators for different drum sounds
        const kick = this.createDrumSound('sine', 60, 0.7);
        const snare = this.createDrumSound('triangle', 200, 0.5);
        const hiHat = this.createDrumSound('square', 1000, 0.3);

        // Connect to master gain
        [kick, snare, hiHat].forEach(sound => 
            sound.connect(this.masterGainNode)
        );

        // Rhythm pattern (4/4 time signature)
        this.rhythmInterval = setInterval(() => {
            const currentBeat = Date.now() % 4;
            
            // Basic 4/4 rhythm pattern
            switch(currentBeat) {
                case 0: // First beat (strongest)
                    this.playSound(kick, 1);
                    break;
                case 1:
                    this.playSound(hiHat, 0.6);
                    break;
                case 2:
                    this.playSound(snare, 0.8);
                    this.playSound(hiHat, 0.5);
                    break;
                case 3:
                    this.playSound(hiHat, 0.4);
                    break;
            }

            // Trigger beat callback if set
            if (this.beatCallback) {
                this.beatCallback(currentBeat);
            }
        }, beatInterval * 1000);
    }

    createDrumSound(type, frequency, volume) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

        oscillator.connect(gainNode);
        return gainNode;
    }

    playSound(soundNode, volumeMultiplier = 1) {
        const now = this.audioContext.currentTime;
        
        // Quick envelope for percussive sound
        soundNode.gain.cancelScheduledValues(now);
        soundNode.gain.setValueAtTime(soundNode.gain.value, now);
        soundNode.gain.linearRampToValueAtTime(0.001, now + 0.1);
    }

    stopRhythm() {
        if (!this.isPlaying) return;

        // Fade out
        if (this.masterGainNode) {
            this.masterGainNode.gain.exponentialRampToValueAtTime(
                0.001, 
                this.audioContext.currentTime + 1
            );
        }

        // Clear interval and reset flags
        if (this.rhythmInterval) {
            clearInterval(this.rhythmInterval);
            this.rhythmInterval = null;
        }

        this.isPlaying = false;
    }

    setBPM(bpm) {
        this.currentBPM = Math.max(40, Math.min(240, bpm));
        
        // If already playing, restart with new BPM
        if (this.isPlaying) {
            this.stopRhythm();
            this.startRhythmWithFadeIn();
        }
    }

    setBeatCallback(callback) {
        this.beatCallback = callback;
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
