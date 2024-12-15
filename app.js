class BPMDetector {
    constructor() {
        this.audioProcessor = new AudioProcessor();
        this.isListening = false;
        this.fixedBPM = 90;
        this.beatDetector = new BeatDetector();
        this.lastBeatTime = 0;
        this.rhythmPatterns = new RhythmPatterns();
        this.currentPattern = 'custom';
        this.tapTimes = [];
        this.lastTapTime = 0;
        this.version = '1.2.0';

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
        this.versionDisplay = document.getElementById('version');
        this.tapBpmButton = document.getElementById('tapBpm');
        this.manualBpmInput = document.getElementById('manualBpm');
        this.bpmDecreaseButton = document.getElementById('bpmDecrease');
        this.bpmIncreaseButton = document.getElementById('bpmIncrease');

        // Pattern buttons
        this.patternButtons = {
            'basic': document.getElementById('pattern-basic'),
            'march': document.getElementById('pattern-march'),
            'electronic': document.getElementById('pattern-electronic'),
            'reggae': document.getElementById('pattern-reggae'),
            'funk': document.getElementById('pattern-funk'),
            'random': document.getElementById('pattern-random'),
            'custom': document.getElementById('pattern-custom')
        };

        // Initialize pattern grid
        this.initializePatternGrid();
        
        // Set up pattern buttons
        this.setupPatternButtons();

        // Initialize displays with default BPM
        this.bpmDisplay.textContent = `Detected BPM: ${this.fixedBPM}`;
        this.playRhythmButton.disabled = false;

        // Update version display
        this.updateVersion();
        
        // Set version
        if (this.versionDisplay) {
            this.versionDisplay.textContent = 'v1.2.0';
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
        this.playRhythmButton.addEventListener('click', () => this.playRhythm());

        // Add pattern button listeners
        Object.entries(this.patternButtons).forEach(([pattern, button]) => {
            button.addEventListener('click', () => this.setPattern(pattern));
        });

        // BPM Adjustment Event Listeners
        this.bpmDecreaseButton.addEventListener('click', () => this.adjustBPM(-10));
        this.bpmIncreaseButton.addEventListener('click', () => this.adjustBPM(10));

        // Initialize event listeners
        this.initializeEventListeners();

        // Audio context for rhythm playback
        this.rhythmContext = null;
        this.isPlayingRhythm = false;
        this.rhythmInterval = null;
    }

    updateVersion() {
        const versionElement = document.querySelector('.version');
        if (versionElement) {
            const date = new Date();
            const buildNumber = Math.floor((date.getTime() / 1000) % 10000);
            versionElement.textContent = `v${this.version}-${buildNumber}`;
        }
    }

    setupPatternButtons() {
        const patterns = this.rhythmPatterns.getAllPatterns();
        patterns.forEach(pattern => {
            const button = document.getElementById(`pattern-${pattern.id}`);
            if (button) {
                button.addEventListener('click', () => this.setPattern(pattern.id));
                button.title = pattern.description;
            }
        });
    }

    setPattern(patternId) {
        // Remove active class from all pattern buttons
        document.querySelectorAll('.pattern-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        const selectedButton = document.getElementById(`pattern-${patternId}`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }

        // Generate new random pattern if random is selected
        if (patternId === 'random') {
            this.rhythmPatterns.generateRandomPattern();
        }

        // Get the pattern
        const pattern = this.rhythmPatterns.getPattern(patternId);
        this.currentPattern = patternId;

        // Update pattern info
        const patternNameElement = document.getElementById('currentPatternName');
        const patternDescElement = document.getElementById('patternDescription');
        if (patternNameElement) patternNameElement.textContent = pattern.name;
        if (patternDescElement) patternDescElement.textContent = pattern.description;

        // Update grid buttons
        ['kick', 'snare', 'hihat'].forEach(instrument => {
            const grid = document.getElementById(`${instrument}Grid`);
            if (grid) {
                const buttons = grid.getElementsByClassName('grid-btn');
                Array.from(buttons).forEach((button, i) => {
                    const isActive = pattern[instrument][i] === 1 || pattern[instrument][i] === true;
                    button.classList.toggle('active', isActive);
                });
            }
        });

        // If rhythm is playing, continue with new pattern
        if (this.isPlayingRhythm) {
            this.updateCurrentStepDisplay();
        }
    }

    initializePatternGrid() {
        ['kick', 'snare', 'hihat'].forEach(instrument => {
            const grid = document.getElementById(`${instrument}Grid`);
            if (grid) {
                // Clear existing buttons
                grid.innerHTML = '';
                
                // Create 16 buttons for each instrument
                for (let i = 0; i < 16; i++) {
                    const button = document.createElement('button');
                    button.className = 'grid-btn';
                    button.dataset.beat = i;
                    button.addEventListener('click', () => {
                        button.classList.toggle('active');
                        // Update pattern immediately
                        const isActive = button.classList.contains('active');
                        if (this.currentPattern === 'custom') {
                            this.customPattern[instrument][i] = isActive;
                            this.rhythmPatterns.setCustomPattern(instrument, i, isActive);
                        } else {
                            // If we're not in custom pattern, switch to custom and copy current pattern
                            const currentPattern = this.rhythmPatterns.getPattern(this.currentPattern);
                            Object.keys(this.customPattern).forEach(inst => {
                                this.customPattern[inst] = [...currentPattern[inst]];
                            });
                            this.customPattern[instrument][i] = isActive;
                            
                            // Update the custom pattern in rhythmPatterns
                            Object.keys(this.customPattern).forEach(inst => {
                                for (let j = 0; j < 16; j++) {
                                    this.rhythmPatterns.setCustomPattern(inst, j, this.customPattern[inst][j]);
                                }
                            });
                            
                            // Switch to custom pattern
                            this.setPattern('custom');
                        }
                    });
                    grid.appendChild(button);
                }
            }
        });

        // Set initial pattern
        this.setPattern(this.currentPattern);
    }

    playRhythm() {
        if (!this.isPlayingRhythm) {
            if (!this.rhythmContext) {
                this.rhythmContext = new AudioContext();
            }
            
            const bpm = this.fixedBPM;
            const secondsPerBeat = 60.0 / bpm;
            const secondsPerStep = secondsPerBeat / 4; // 16th notes
            
            let step = 0;
            
            // Reset current step indicators
            this.updateCurrentStepDisplay(step);
            
            this.rhythmInterval = setInterval(() => {
                const currentTime = this.rhythmContext.currentTime;
                const pattern = this.rhythmPatterns.getPattern(this.currentPattern); // Get current pattern each step
                
                // Play sounds for active steps
                if (pattern.kick[step]) this.playDrumSound('kick', currentTime);
                if (pattern.snare[step]) this.playDrumSound('snare', currentTime);
                if (pattern.hihat[step]) this.playDrumSound('hihat', currentTime);
                
                // Update current step indicator
                this.updateCurrentStepDisplay(step);
                
                step = (step + 1) % 16;
            }, secondsPerStep * 1000);
            
            this.isPlayingRhythm = true;
            this.playRhythmButton.textContent = 'Stop';
        } else {
            this.stopRhythm();
        }
    }

    stopRhythm() {
        if (this.rhythmInterval) {
            clearInterval(this.rhythmInterval);
            this.rhythmInterval = null;
        }
        this.isPlayingRhythm = false;
        this.playRhythmButton.textContent = 'Play Rhythm';
        // Clear current step indicator
        this.updateCurrentStepDisplay(-1);
    }

    updateCurrentStepDisplay(currentStep) {
        // First remove current class from all buttons
        document.querySelectorAll('.grid-btn').forEach(btn => {
            btn.classList.remove('current');
        });

        // If we have a valid step, add current class to those buttons
        if (currentStep >= 0 && currentStep < 16) {
            document.querySelectorAll(`.grid-btn[data-beat="${currentStep}"]`).forEach(btn => {
                btn.classList.add('current');
            });
        }
    }

    async toggleListening() {
        if (!this.isListening) {
            const success = await this.audioProcessor.startListening();
            if (success) {
                this.isListening = true;
                this.startButton.textContent = 'Stop Listening';
                this.startButton.classList.add('listening');
                this.fixedBPM = null;
                this.beatDetector.reset();
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
        const bpm = this.beatDetector.detectBPM(now);
        if (bpm) {
            const stableBPM = this.beatDetector.getStableBPM();
            if (stableBPM) {
                this.bpmDisplay.textContent = `Detected BPM: ${stableBPM}`;
                this.fixedBPM = stableBPM;
                this.fixBpmButton.disabled = false;
                
                // Auto-play rhythm if it's stable
                if (this.beatDetector.isRhythmStable() && !this.isPlayingRhythm) {
                    this.playRhythm();
                }
            }
        } else {
            // If no beat detected for a while, stop the rhythm
            if (this.isPlayingRhythm) {
                this.stopRhythm();
            }
        }
    }

    drawWaveform(dataArray) {
        const width = this.waveCanvas.width;
        const height = this.waveCanvas.height;
        const ctx = this.waveCtx;

        // Clear previous frame
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, width, height);

        // Draw new frame
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 255, 0)';
        ctx.beginPath();

        const sliceWidth = width * 1.0 / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height / 2) + height / 2; // Center the waveform

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
        // Shift energy history
        this.energyHistory.push(energy);
        this.energyHistory.shift();

        const width = this.energyCanvas.width;
        const height = this.energyCanvas.height;
        const ctx = this.energyCtx;

        // Clear canvas
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, width, height);

        // Draw energy history with gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#4CAF50');   // Green
        gradient.addColorStop(0.6, '#FFC107'); // Yellow
        gradient.addColorStop(1, '#F44336');   // Red

        ctx.beginPath();
        ctx.moveTo(0, height);

        // Draw smooth energy curve
        for (let i = 0; i < this.energyHistory.length; i++) {
            const x = (i / (this.energyHistory.length - 1)) * width;
            const normalizedEnergy = Math.min(this.energyHistory[i] * 3, 1);
            const y = height - (normalizedEnergy * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                // Use quadratic curves for smoother visualization
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

        // Add grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = (height * i) / 4;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 8; i++) {
            const x = (width * i) / 8;
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
            this.energyBar.style.backgroundColor = '#F44336'; // Red
        } else if (percentage > 50) {
            this.energyBar.style.backgroundColor = '#FFC107'; // Yellow
        } else {
            this.energyBar.style.backgroundColor = '#4CAF50'; // Green
        }
    }

    fixBPM() {
        this.fixedBPM = parseInt(this.bpmDisplay.textContent.match(/\d+/)[0]);
        this.isListening = false;
        this.startButton.textContent = 'Start Listening';
        this.startButton.classList.remove('listening');
        this.playRhythmButton.disabled = false;
    }

    createKick(time, velocity = 1) {
        const osc = this.rhythmContext.createOscillator();
        const gain = this.rhythmContext.createGain();
        
        // Increase velocity for the first beat
        if (time === this.rhythmContext.currentTime) {
            velocity *= 1.2;
        }

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        gain.gain.setValueAtTime(velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.rhythmContext.destination);
        
        osc.start(time);
        osc.stop(time + 0.5);
    }

    createSnare(time, velocity = 0.8) {
        const noise = this.rhythmContext.createBufferSource();
        const noiseGain = this.rhythmContext.createGain();
        const osc = this.rhythmContext.createOscillator();
        const oscGain = this.rhythmContext.createGain();
        
        // Increase velocity for the first beat
        if (time === this.rhythmContext.currentTime) {
            velocity *= 1.2;
        }

        // Create and fill noise buffer
        const bufferSize = this.rhythmContext.sampleRate * 0.5;
        const buffer = this.rhythmContext.createBuffer(1, bufferSize, this.rhythmContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        
        noiseGain.gain.setValueAtTime(velocity, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        oscGain.gain.setValueAtTime(velocity * 3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        osc.frequency.setValueAtTime(100, time);
        
        noise.connect(noiseGain);
        osc.connect(oscGain);
        noiseGain.connect(this.rhythmContext.destination);
        oscGain.connect(this.rhythmContext.destination);
        
        noise.start(time);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    createHihat(time, velocity = 0.6) {
        const noise = this.rhythmContext.createBufferSource();
        const noiseGain = this.rhythmContext.createGain();
        
        // Increase velocity for the first beat
        if (time === this.rhythmContext.currentTime) {
            velocity *= 1.2;
        }

        // Create and fill noise buffer
        const bufferSize = this.rhythmContext.sampleRate * 0.1;
        const buffer = this.rhythmContext.createBuffer(1, bufferSize, this.rhythmContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        
        const filter = this.rhythmContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        
        noiseGain.gain.setValueAtTime(velocity * 0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.rhythmContext.destination);
        
        noise.start(time);
    }

    playDrumSound(instrument, time) {
        const isFirstBeat = time === this.rhythmContext.currentTime;
        const velocity = isFirstBeat ? 1.2 : 1;

        switch(instrument) {
            case 'kick':
                this.createKick(time, velocity);
                break;
            case 'snare':
                this.createSnare(time, velocity * 0.8);
                break;
            case 'hihat':
                this.createHihat(time, velocity * 0.6);
                break;
        }
    }

    initializeEventListeners() {
        // Add existing event listeners here
        
        // Add tap BPM functionality
        this.tapBpmButton.addEventListener('click', () => this.handleTapBpm());
        
        // Add manual BPM input handler
        this.manualBpmInput.addEventListener('change', (e) => {
            const newBpm = parseInt(e.target.value);
            if (newBpm >= 30 && newBpm <= 300) {
                this.fixedBPM = newBpm;
                this.bpmDisplay.textContent = `BPM: ${this.fixedBPM}`;
            }
        });
    }

    handleTapBpm() {
        const currentTime = performance.now();
        
        // Remove taps that are older than 2 seconds
        this.tapTimes = this.tapTimes.filter(time => currentTime - time < 2000);
        
        // Add new tap
        this.tapTimes.push(currentTime);
        
        // Calculate BPM if we have at least 2 taps
        if (this.tapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }
            
            // Calculate average interval
            const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            
            // Convert to BPM
            const bpm = Math.round(60000 / averageInterval);
            
            // Update BPM if it's within reasonable range
            if (bpm >= 30 && bpm <= 300) {
                this.fixedBPM = bpm;
                this.bpmDisplay.textContent = `BPM: ${this.fixedBPM}`;
                this.manualBpmInput.value = this.fixedBPM;
            }
        }
    }

    adjustBPM(adjustment) {
        // Adjust the current BPM
        if (this.fixedBPM !== null) {
            this.fixedBPM = Math.max(40, Math.min(220, this.fixedBPM + adjustment));
            
            // Update BPM display
            this.bpmDisplay.textContent = `Detected BPM: ${this.fixedBPM}`;
            
            // If rhythm is currently playing, restart with new BPM
            if (this.isPlayingRhythm) {
                this.stopRhythm();
                this.playRhythm();
            }
        }
    }
}

class BeatDetector {
    constructor() {
        // BPM tracking
        this.beatTimes = [];
        this.bpmHistory = [];
        this.maxBeatHistory = 8;  // Store last 8 beat times
        this.delayThreshold = 50;  // ms delay threshold
        this.lastValidBeatTime = 0;

        // Stable rhythm detection
        this.stableRhythmMeasures = 0;
        this.maxStableMeasures = 8;  // 8 measures to consider rhythm stable
        this.bpmStabilityThreshold = 0.1;  // ±10% variation allowed
        this.lastStableBPM = null;
        this.rhythmStabilityTimer = null;
        this.rhythmStabilityTimeout = 2000;  // 2 seconds of inactivity to stop
    }

    detectBPM(currentTime) {
        // Ignore beats that are too close together (potential noise)
        if (currentTime - this.lastValidBeatTime < this.delayThreshold) {
            return null;
        }

        // Add current beat time
        this.beatTimes.push(currentTime);

        // Trim beat times to keep only recent beats
        if (this.beatTimes.length > this.maxBeatHistory) {
            this.beatTimes.shift();
        }

        // Calculate BPM if we have at least 2 beats
        if (this.beatTimes.length >= 2) {
            const bpms = [];
            
            // Calculate BPM between consecutive beats
            for (let i = 1; i < this.beatTimes.length; i++) {
                const timeDiff = this.beatTimes[i] - this.beatTimes[i-1];
                const beatsPerMinute = 60000 / timeDiff;
                bpms.push(beatsPerMinute);
            }

            // Calculate average of last 2 measures (4 beats)
            const averageBPM = bpms.slice(-2).reduce((a, b) => a + b, 0) / 2;

            // Store in history
            this.bpmHistory.push(averageBPM);
            if (this.bpmHistory.length > 4) {
                this.bpmHistory.shift();
            }

            // Check rhythm stability
            this.checkRhythmStability(averageBPM);

            // Update last valid beat time
            this.lastValidBeatTime = currentTime;

            return Math.round(averageBPM);
        }

        return null;
    }

    checkRhythmStability(currentBPM) {
        // Clear any existing stability timer
        if (this.rhythmStabilityTimer) {
            clearTimeout(this.rhythmStabilityTimer);
        }

        // Set a timeout to check for rhythm interruption
        this.rhythmStabilityTimer = setTimeout(() => {
            // Reset stability if no beat detected
            this.stableRhythmMeasures = 0;
            this.lastStableBPM = null;
        }, this.rhythmStabilityTimeout);

        // If this is the first stable BPM, set it
        if (this.lastStableBPM === null) {
            this.lastStableBPM = currentBPM;
            this.stableRhythmMeasures = 1;
            return false;
        }

        // Check if current BPM is within threshold of last stable BPM
        const isStable = Math.abs(currentBPM - this.lastStableBPM) / this.lastStableBPM <= this.bpmStabilityThreshold;

        if (isStable) {
            this.stableRhythmMeasures++;

            // Update last stable BPM
            this.lastStableBPM = (this.lastStableBPM + currentBPM) / 2;
        } else {
            // Reset stability if BPM varies too much
            this.stableRhythmMeasures = 0;
            this.lastStableBPM = currentBPM;
        }

        return this.stableRhythmMeasures >= this.maxStableMeasures;
    }

    isRhythmStable() {
        return this.stableRhythmMeasures >= this.maxStableMeasures;
    }

    getStableBPM() {
        if (this.bpmHistory.length === 0) return null;

        // Calculate average of recent BPM measurements
        const averageBPM = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
        return Math.round(averageBPM);
    }

    reset() {
        this.beatTimes = [];
        this.bpmHistory = [];
        this.lastValidBeatTime = 0;
        this.stableRhythmMeasures = 0;
        this.lastStableBPM = null;
        
        // Clear any existing stability timer
        if (this.rhythmStabilityTimer) {
            clearTimeout(this.rhythmStabilityTimer);
            this.rhythmStabilityTimer = null;
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BPMDetector();
});
