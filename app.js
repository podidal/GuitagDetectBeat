class BPMDetector {
    constructor() {
        this.audioProcessor = new AudioProcessor();
        this.isListening = false;
        this.fixedBPM = 90;
        this.beatTimes = [];
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

        // Pattern buttons
        this.patternButtons = {
            basic: document.getElementById('pattern-basic'),
            march: document.getElementById('pattern-march'),
            pop: document.getElementById('pattern-pop'),
            rock: document.getElementById('pattern-rock'),
            dance: document.getElementById('pattern-dance'),
            custom: document.getElementById('pattern-custom'),
            random: document.getElementById('pattern-random')
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

        // Initialize event listeners
        this.initializeEventListeners();

        // Audio context for rhythm playback
        this.rhythmContext = null;
        this.isPlayingRhythm = false;
        this.rhythmInterval = null;

        // BPM Detection and Management
        this.currentBPM = null;
        this.isFixedBPM = false;

        // Rhythm Auto-Start and Management
        this.autoStartEnabled = true;
        this.playIndicator = null;

        this.updateBPMDisplay = (bpm) => {
            const bpmValueElement = document.getElementById('bpmValue');
            const setBpmButton = document.getElementById('setBpmButton');

            if (bpm) {
                bpmValueElement.textContent = Math.round(bpm);
                bpmValueElement.classList.remove('no-bpm');
                setBpmButton.disabled = false;
            } else {
                bpmValueElement.textContent = '--';
                bpmValueElement.classList.add('no-bpm');
                setBpmButton.disabled = true;
            }
        }

        this.initializeBPMControls = () => {
            const setBpmButton = document.getElementById('setBpmButton');
            
            this.audioProcessor.setCallbacks(
                () => {}, // Beat callback (optional)
                null, // Visualization callback
                (energy) => {
                    // Optional energy visualization or processing
                }
            );

            // Periodically calculate BPM with more sophisticated averaging
            const bpmUpdateInterval = setInterval(() => {
                if (!this.isFixedBPM) {
                    const detectedBPM = this.audioProcessor.calculateBPM();
                    if (detectedBPM) {
                        this.currentBPM = detectedBPM;
                        this.updateBPMDisplay(this.currentBPM);

                        // Auto-start rhythm if consistent and enabled
                        if (this.autoStartEnabled && 
                            this.audioProcessor.checkConsistency(this.currentBPM)) {
                            this.rhythmPatterns.startRhythmWithFadeIn();
                            this.updatePlayIndicator(true);
                        }
                    } else {
                        this.updateBPMDisplay(null);
                    }
                }
            }, 1000); // More frequent updates for responsiveness

            // Set BPM Button Logic
            setBpmButton.addEventListener('click', () => {
                if (this.currentBPM) {
                    this.isFixedBPM = !this.isFixedBPM;
                    setBpmButton.classList.toggle('active', this.isFixedBPM);
                    
                    if (this.isFixedBPM) {
                        // Pass fixed BPM to rhythm and beat detection systems
                        this.rhythmPatterns.setBPM(this.currentBPM);
                        this.audioProcessor.setFixedBPM(this.currentBPM);
                        
                        setBpmButton.textContent = 'Unlock BPM';
                        setBpmButton.setAttribute('title', `Locked at ${this.currentBPM} BPM`);
                    } else {
                        // Reset fixed BPM
                        this.rhythmPatterns.stopRhythm();
                        this.updatePlayIndicator(false);
                        
                        setBpmButton.textContent = 'Set BPM';
                        setBpmButton.removeAttribute('title');
                    }
                }
            });

            // Cleanup function to stop BPM updates when needed
            return () => {
                clearInterval(bpmUpdateInterval);
            };
        }

        this.stopBPMUpdates = this.initializeBPMControls();

        this.updatePlayIndicator = (isPlaying) => {
            if (!this.playIndicator) this.initializePlayIndicator();
            
            if (isPlaying) {
                this.playIndicator.classList.add('active');
            } else {
                this.playIndicator.classList.remove('active');
            }
        }

        this.initializePlayIndicator = () => {
            this.playIndicator = document.createElement('div');
            this.playIndicator.id = 'playIndicator';
            this.playIndicator.classList.add('play-indicator');
            document.querySelector('.bpm-container').appendChild(this.playIndicator);
        }
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

    calculateBPM() {
        if (this.beatTimes.length < 4) return; // Нужно минимум 4 удара для точного расчета

        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
            intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }

        // Удаляем выбросы (интервалы, сильно отличающиеся от среднего)
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const filteredIntervals = intervals.filter(interval => 
            Math.abs(interval - avgInterval) < avgInterval * 0.5
        );

        if (filteredIntervals.length < 2) return;

        const cleanAvgInterval = filteredIntervals.reduce((a, b) => a + b) / filteredIntervals.length;
        let bpm = Math.round(60000 / cleanAvgInterval);

        // Корректируем BPM в разумных пределах
        if (bpm < 60) bpm *= 2;
        if (bpm > 200) bpm = Math.round(bpm / 2);

        // Проверяем, что BPM в разумных пределах
        if (bpm >= 40 && bpm <= 220) {
            this.bpmDisplay.textContent = `Detected BPM: ${bpm}`;
            this.fixedBPM = bpm;
            this.fixBpmButton.disabled = false;
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
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BPMDetector();
});
