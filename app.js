class BPMDetector {
    constructor() {
        this.audioProcessor = new AudioProcessor();
        this.isListening = false;
        this.currentBPM = 120;
        this.beatTimes = [];
        this.lastBeatTime = 0;
        this.currentPattern = 'custom';

        // Tap tempo variables
        this.tapTimes = [];
        this.lastTapTime = 0;

        // Visualization elements
        this.waveCanvas = document.getElementById('audioVisualizerWave');
        this.waveCtx = this.waveCanvas?.getContext('2d');
        this.energyCanvas = document.getElementById('audioVisualizerEnergy');
        this.energyCtx = this.energyCanvas?.getContext('2d');
        this.energyBar = document.getElementById('energyBar');
        this.energyValue = document.getElementById('energyValue');
        
        // Visualization history
        this.energyHistory = this.energyCanvas ? new Array(this.energyCanvas.width).fill(0) : [];

        // Custom pattern grid state
        this.customPattern = {
            kick: new Array(16).fill(false),
            snare: new Array(16).fill(false),
            hihat: new Array(16).fill(false)
        };

        // DOM Elements
        this.startButton = document.getElementById('startListening');
        this.bpmDisplay = document.getElementById('bpmDisplay');
        this.fixBpmButton = document.getElementById('fixBpm');
        this.playRhythmButton = document.getElementById('playRhythm');
        this.tapTempoButton = document.getElementById('tapTempo');
        this.versionDisplay = document.getElementById('version');

        // Pattern buttons
        this.patternButtons = {
            rock: document.getElementById('patternRock'),
            funk: document.getElementById('patternFunk'),
            jazz: document.getElementById('patternJazz'),
            custom: document.getElementById('patternCustom')
        };

        // Initialize pattern grid
        this.initializePatternGrid();

        // Initialize displays with default BPM
        this.updateBPMDisplay(this.currentBPM);
        this.playRhythmButton.disabled = false;
        
        // Set version
        if (this.versionDisplay) {
            this.versionDisplay.textContent = 'v1.0.2';
        }

        // Set up audio processor callbacks
        this.audioProcessor.setCallbacks(
            () => this.beatDetected(),
            (data) => this.drawWaveform(data),
            (energy) => {
                this.updateEnergyHistory(energy);
                this.updateEnergyMeter(energy);
            }
        );

        // Bind event listeners
        this.startButton.addEventListener('click', () => this.toggleListening());
        this.fixBpmButton.addEventListener('click', () => this.fixBPM());
        this.playRhythmButton.addEventListener('click', () => this.toggleRhythm());
        this.tapTempoButton.addEventListener('click', () => this.handleTap());

        // Add keyboard support for tapping (spacebar)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent page scrolling
                this.handleTap();
            }
        });

        // Add pattern button listeners
        Object.entries(this.patternButtons).forEach(([pattern, button]) => {
            button.addEventListener('click', () => this.setPattern(pattern));
        });

        // Audio context for rhythm playback
        this.rhythmContext = null;
        this.isPlayingRhythm = false;
        this.rhythmInterval = null;
    }

    initializePatternGrid() {
        // Set up grid button listeners
        ['kick', 'snare', 'hihat'].forEach(instrument => {
            const grid = document.getElementById(`${instrument}Grid`);
            if (grid) {
                grid.querySelectorAll('.grid-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const beat = parseInt(btn.dataset.beat);
                        this.customPattern[instrument][beat] = !this.customPattern[instrument][beat];
                        btn.classList.toggle('active', this.customPattern[instrument][beat]);
                    });
                });
            }
        });

        // Set default pattern
        this.setDefaultCustomPattern();
    }

    setDefaultCustomPattern() {
        // Basic pattern: kick on 1 and 3, snare on 2 and 4, hihat on every beat
        const defaultPattern = {
            kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
        };

        Object.entries(defaultPattern).forEach(([instrument, pattern]) => {
            pattern.forEach((value, beat) => {
                const btn = document.querySelector(`#${instrument}Grid .grid-btn[data-beat="${beat}"]`);
                if (btn && value) {
                    btn.classList.add('active');
                    this.customPattern[instrument][beat] = true;
                }
            });
        });
    }

    async toggleListening() {
        if (!this.isListening) {
            const success = await this.audioProcessor.startListening();
            if (success) {
                this.isListening = true;
                this.startButton.textContent = 'Stop Listening';
                this.startButton.classList.add('listening');
                this.currentBPM = null;
                this.beatTimes = [];
            }
        } else {
            this.audioProcessor.stopListening();
            this.isListening = false;
            this.startButton.textContent = 'Start Listening';
            this.startButton.classList.remove('listening');
        }
    }

    beatDetected() {
        const now = Date.now();
        this.beatTimes.push(now);

        // Храним только последние 8 ударов для более точного расчета
        if (this.beatTimes.length > 8) {
            this.beatTimes.shift();
        }

        this.calculateBPM();
    }

    updateBPMDisplay(bpm) {
        this.currentBPM = bpm;
        this.bpmDisplay.textContent = `BPM: ${bpm}`;
        
        // Enable/disable buttons based on BPM
        this.fixBpmButton.disabled = false;
        this.playRhythmButton.disabled = false;
    }

    calculateBPM() {
        if (this.beatTimes.length < 4) return;

        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const filteredIntervals = intervals.filter(interval => 
            Math.abs(interval - avgInterval) < avgInterval * 0.5
        );

        if (filteredIntervals.length < 2) return;

        const cleanAvgInterval = filteredIntervals.reduce((a, b) => a + b) / filteredIntervals.length;
        let bpm = Math.round(60000 / cleanAvgInterval);

        // Keep BPM in reasonable range
        if (bpm < 60) bpm *= 2;
        if (bpm > 200) bpm = Math.round(bpm / 2);

        if (bpm >= 40 && bpm <= 220) {
            this.updateBPMDisplay(bpm);
        }
    }

    drawWaveform(dataArray) {
        const width = this.waveCanvas.width;
        const height = this.waveCanvas.height;
        const ctx = this.waveCtx;

        // Clear previous frame
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw new frame
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'var(--primary-color)';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height / 2) + height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }

    updateEnergyHistory(energy) {
        this.energyHistory.push(energy);
        this.energyHistory.shift();

        const width = this.energyCanvas.width;
        const height = this.energyCanvas.height;
        const ctx = this.energyCtx;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw energy history with gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'var(--primary-color)');
        gradient.addColorStop(0.6, '#FFB74D');
        gradient.addColorStop(1, '#FF7043');

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let i = 0; i < this.energyHistory.length; i++) {
            const x = (i / (this.energyHistory.length - 1)) * width;
            const normalizedEnergy = Math.min(this.energyHistory[i] * 3, 1);
            const y = height - (normalizedEnergy * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevX = ((i - 1) / (this.energyHistory.length - 1)) * width;
                const prevY = height - (Math.min(this.energyHistory[i - 1] * 3, 1) * height);
                const cpX = (x + prevX) / 2;
                ctx.quadraticCurveTo(cpX, prevY, x, y);
            }
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        // Add subtle grid lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 2; i++) {
            const y = (height * i) / 2;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 4; i++) {
            const x = (width * i) / 4;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    updateEnergyMeter(energy) {
        // Update energy bar with smoother animation
        const percentage = Math.min(energy * 300, 100);
        this.energyBar.style.transition = 'width 100ms ease-out';
        this.energyBar.style.width = `${percentage}%`;
        
        // Update text with formatted value
        const formattedEnergy = (energy * 100).toFixed(1);
        this.energyValue.textContent = `Energy: ${formattedEnergy}%`;
        
        // Update color based on energy level
        if (percentage > 80) {
            this.energyBar.style.backgroundColor = '#FF7043'; // Red
        } else if (percentage > 50) {
            this.energyBar.style.backgroundColor = '#FFB74D'; // Yellow
        } else {
            this.energyBar.style.backgroundColor = 'var(--primary-color)'; // Green
        }
    }

    fixBPM() {
        this.updateBPMDisplay(this.currentBPM);
        this.isListening = false;
        this.startButton.textContent = 'Start Listening';
        this.startButton.classList.remove('listening');
        this.playRhythmButton.disabled = false;
    }

    handleTap() {
        const now = Date.now();
        
        // Clear tap history if too much time has passed
        if (now - this.lastTapTime > 2000) {
            this.tapTimes = [];
        }
        
        this.tapTimes.push(now);
        
        // Keep only last 4 taps
        if (this.tapTimes.length > 4) {
            this.tapTimes.shift();
        }
        
        // Calculate BPM from taps
        if (this.tapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i-1]);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            let bpm = Math.round(60000 / avgInterval);
            
            // Keep BPM in reasonable range
            if (bpm < 60) bpm *= 2;
            if (bpm > 200) bpm = Math.round(bpm / 2);
            
            if (bpm >= 40 && bpm <= 220) {
                this.updateBPMDisplay(bpm);
            }
        }
        
        this.lastTapTime = now;
    }

    createKick(time, velocity = 1) {
        const oscillator = this.rhythmContext.createOscillator();
        const gainNode = this.rhythmContext.createGain();
        const filter = this.rhythmContext.createBiquadFilter();
        
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.rhythmContext.destination);
        
        oscillator.frequency.setValueAtTime(160, time);
        gainNode.gain.setValueAtTime(velocity, time);
        
        oscillator.frequency.exponentialRampToValueAtTime(55, time + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        oscillator.start(time);
        oscillator.stop(time + 0.15);
    }

    createHihat(time, isAccent) {
        const noise = this.rhythmContext.createBufferSource();
        const gainNode = this.rhythmContext.createGain();
        const filter = this.rhythmContext.createBiquadFilter();
        
        const bufferSize = this.rhythmContext.sampleRate * 0.1;
        const buffer = this.rhythmContext.createBuffer(1, bufferSize, this.rhythmContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        
        noise.buffer = buffer;
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.rhythmContext.destination);
        
        gainNode.gain.setValueAtTime(isAccent ? 0.4 : 0.1, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        
        noise.start(time);
        noise.stop(time + 0.05);
    }

    createSnare(time, velocity = 0.8) {
        // Noise component
        const noise = this.rhythmContext.createBufferSource();
        const noiseGain = this.rhythmContext.createGain();
        const noiseFilter = this.rhythmContext.createBiquadFilter();
        
        const bufferSize = this.rhythmContext.sampleRate * 0.1;
        const buffer = this.rhythmContext.createBuffer(1, bufferSize, this.rhythmContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1000;
        noiseFilter.Q.value = 1;
        
        noise.buffer = buffer;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.rhythmContext.destination);
        
        noiseGain.gain.setValueAtTime(velocity * 0.5, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        noise.start(time);
        noise.stop(time + 0.1);

        // Tone component
        const osc = this.rhythmContext.createOscillator();
        const oscGain = this.rhythmContext.createGain();
        
        osc.connect(oscGain);
        oscGain.connect(this.rhythmContext.destination);
        
        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(velocity * 0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        osc.start(time);
        osc.stop(time + 0.1);
    }

    createCustomPattern(time, beatNumber, subBeat) {
        const beatIndex = beatNumber * 4 + subBeat;
        
        if (this.customPattern.kick[beatIndex]) {
            this.createKick(time, beatNumber === 0 ? 1.2 : 1);
        }
        if (this.customPattern.snare[beatIndex]) {
            this.createSnare(time, 0.8);
        }
        if (this.customPattern.hihat[beatIndex]) {
            this.createHihat(time, beatNumber === 0 && subBeat === 0);
        }
    }

    createBeats(time, beatNumber, barCount) {
        if (this.currentPattern === 'custom') {
            // For custom pattern, we divide each beat into 4 sixteenth notes
            for (let i = 0; i < 4; i++) {
                const subBeatTime = time + (i * (60 / this.currentBPM) / 4);
                this.createCustomPattern(subBeatTime, beatNumber, i);
            }
        } else {
            switch(this.currentPattern) {
                case 'rock':
                    this.createRockPattern(time, beatNumber, barCount);
                    break;
                case 'funk':
                    this.createFunkPattern(time, beatNumber, barCount);
                    break;
                case 'jazz':
                    this.createJazzPattern(time, beatNumber, barCount);
                    break;
            }
        }
    }

    createRockPattern(time, beatNumber, isLastBar) {
        if (isLastBar && beatNumber === 3) {
            // Fill on the last beat of bar 4
            for (let i = 0; i < 4; i++) {
                this.createSnare(time + (i * 0.25 * (60 / this.currentBPM)), 0.7 - (i * 0.1));
            }
        } else {
            // Basic rock pattern
            if (beatNumber % 2 === 0) {
                // Beats 1 and 3: Kick
                this.createKick(time, beatNumber === 0 ? 1.2 : 1);
            } else {
                // Beats 2 and 4: Snare
                this.createSnare(time, beatNumber === 3 ? 0.9 : 0.8);
            }
            // Hi-hat on every beat
            this.createHihat(time, beatNumber === 0);
        }
    }

    createFunkPattern(time, beatNumber, isLastBar) {
        if (isLastBar && beatNumber >= 2) {
            // Syncopated fill on last two beats of bar 4
            const divisions = 3;
            for (let i = 0; i < divisions; i++) {
                this.createSnare(time + (i * (60 / this.currentBPM) / divisions), 0.7);
            }
        } else {
            // Funk pattern with syncopated kicks
            this.createHihat(time, beatNumber === 0); // Hi-hat on every beat
            
            if (beatNumber === 0) {
                this.createKick(time, 1.2);
            } else if (beatNumber === 1) {
                this.createSnare(time, 0.8);
                this.createKick(time + (60 / this.currentBPM) / 2, 0.9); // "and" of 2
            } else if (beatNumber === 2) {
                this.createKick(time, 1);
            } else {
                this.createSnare(time, 0.9);
                if (!isLastBar) {
                    this.createKick(time + (60 / this.currentBPM) / 2, 0.9); // "and" of 4
                }
            }
        }
    }

    createJazzPattern(time, beatNumber, isLastBar) {
        if (isLastBar && beatNumber >= 2) {
            // Swing fill on last two beats of bar 4
            const divisions = 4;
            for (let i = 0; i < divisions; i++) {
                const swingOffset = i % 2 === 1 ? 0.33 : 0;
                this.createSnare(
                    time + (i * (60 / this.currentBPM) / divisions) + swingOffset,
                    0.6 + (i * 0.1)
                );
            }
        } else {
            // Jazz ride pattern with swing
            const swingOffset = beatNumber % 2 === 1 ? 0.33 : 0;
            this.createHihat(time + swingOffset, beatNumber === 0);

            if (beatNumber === 0) {
                this.createKick(time, 1.1);
            } else if (beatNumber === 2) {
                this.createKick(time, 0.9);
            }
            
            // Add swing eighth notes on the ride
            if (!isLastBar) {
                this.createHihat(time + (60 / this.currentBPM) / 3, false);
            }
        }
    }

    setPattern(pattern) {
        this.currentPattern = pattern;
        // Update button states
        Object.entries(this.patternButtons).forEach(([p, button]) => {
            button.classList.toggle('active', p === pattern);
        });
    }

    toggleRhythm() {
        if (!this.isPlayingRhythm) {
            if (!this.rhythmContext) {
                this.rhythmContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (this.rhythmContext.state === 'suspended') {
                this.rhythmContext.resume();
            }
            
            let lastScheduledTime = this.rhythmContext.currentTime;
            let beatCount = 0;
            
            const scheduleBeats = () => {
                const currentTime = this.rhythmContext.currentTime;
                
                while (lastScheduledTime < currentTime + 0.5) {
                    const barCount = Math.floor(beatCount / 4);
                    this.createBeats(lastScheduledTime, beatCount % 4, barCount);
                    lastScheduledTime += 60 / this.currentBPM;
                    beatCount++;
                }
            };
            
            scheduleBeats();
            this.rhythmInterval = setInterval(scheduleBeats, 100);
            
            this.isPlayingRhythm = true;
            this.playRhythmButton.textContent = 'Stop Rhythm';
        } else {
            if (this.rhythmInterval) {
                clearInterval(this.rhythmInterval);
            }
            if (this.rhythmContext) {
                this.rhythmContext.close();
                this.rhythmContext = null;
            }
            this.isPlayingRhythm = false;
            this.playRhythmButton.textContent = 'Play Rhythm';
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BPMDetector();
});
