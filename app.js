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
            rock: document.getElementById('patternRock'),
            funk: document.getElementById('patternFunk'),
            jazz: document.getElementById('patternJazz'),
            custom: document.getElementById('patternCustom')
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

        // Get the pattern
        const pattern = this.rhythmPatterns.getPattern(patternId);
        this.currentPattern = patternId;

        // Update pattern info
        document.getElementById('currentPatternName').textContent = pattern.name;
        document.getElementById('patternDescription').textContent = pattern.description;

        // Update grid buttons
        ['kick', 'snare', 'hihat'].forEach(instrument => {
            const grid = document.getElementById(`${instrument}Grid`);
            if (grid) {
                const buttons = grid.getElementsByClassName('grid-button');
                for (let i = 0; i < buttons.length; i++) {
                    buttons[i].classList.toggle('active', pattern[instrument][i]);
                }
            }
        });
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
                    button.className = 'grid-button';
                    button.addEventListener('click', () => {
                        button.classList.toggle('active');
                        if (this.currentPattern === 'custom') {
                            this.rhythmPatterns.setCustomPattern(
                                instrument,
                                i,
                                button.classList.contains('active')
                            );
                        }
                    });
                    grid.appendChild(button);
                }
            }
        });
    }

    playRhythm() {
        if (!this.isPlayingRhythm) {
            if (!this.rhythmContext) {
                this.rhythmContext = new AudioContext();
            }
            
            const pattern = this.rhythmPatterns.getPattern(this.currentPattern);
            const bpm = this.fixedBPM;
            const secondsPerBeat = 60.0 / bpm;
            const secondsPerStep = secondsPerBeat / 4; // 16th notes
            
            let step = 0;
            
            // Reset current step indicators
            document.querySelectorAll('.grid-button').forEach(btn => btn.classList.remove('current'));
            
            this.rhythmInterval = setInterval(() => {
                const currentTime = this.rhythmContext.currentTime;
                
                // Update current step indicator
                document.querySelectorAll('.grid-button').forEach(btn => btn.classList.remove('current'));
                document.querySelectorAll(`.grid-button:nth-child(${step + 1})`).forEach(btn => btn.classList.add('current'));
                
                // Play sounds for active steps
                if (pattern.kick[step]) this.playDrumSound('kick', currentTime);
                if (pattern.snare[step]) this.playDrumSound('snare', currentTime);
                if (pattern.hihat[step]) this.playDrumSound('hihat', currentTime);
                
                step = (step + 1) % 16;
            }, secondsPerStep * 1000);
            
            this.isPlayingRhythm = true;
            this.playRhythmButton.textContent = 'Stop';
        } else {
            this.stopRhythm();
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

    playDrumSound(instrument, time) {
        switch (instrument) {
            case 'kick':
                this.createKick(time);
                break;
            case 'snare':
                this.createSnare(time);
                break;
            case 'hihat':
                this.createHihat(time);
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

    stopRhythm() {
        if (this.rhythmInterval) {
            clearInterval(this.rhythmInterval);
        }
        if (this.rhythmContext) {
            this.rhythmContext.close();
            this.rhythmContext = null;
        }
        this.isPlayingRhythm = false;
        this.playRhythmButton.textContent = 'Play';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BPMDetector();
});
