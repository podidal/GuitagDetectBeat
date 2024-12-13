class BPMDetector {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.isListening = false;
        this.fixedBPM = 120;
        this.audioProcessor = null;
        this.beatTimes = [];
        this.lastBeatTime = 0;
        this.currentPattern = 'custom';

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
        this.tapBpmDisplay = document.getElementById('tapBpmDisplay');

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
        this.bpmDisplay.textContent = `Detected BPM: ${this.fixedBPM}`;
        this.tapBpmDisplay.textContent = `Tapped BPM: ${this.fixedBPM}`;
        this.playRhythmButton.disabled = false;

        // Bind event listeners
        this.startButton.addEventListener('click', () => this.toggleListening());
        this.fixBpmButton.addEventListener('click', () => this.fixBPM());
        this.playRhythmButton.addEventListener('click', () => this.toggleRhythm());
        this.tapTempoButton.addEventListener('click', () => this.handleTap());

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

    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            // Create analyzer node with better settings for rhythm detection
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 4096; // Увеличиваем для лучшего разрешения
            analyser.smoothingTimeConstant = 0.4; // Меньше сглаживания для более четкого определения атак
            source.connect(analyser);

            // Создаем фильтр для выделения низких частот (для лучшего определения ритма)
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 100; // Фокус на низких частотах
            filter.Q.value = 1.0;
            
            source.connect(filter);
            filter.connect(analyser);

            // Process audio
            this.processAudio(analyser);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please ensure microphone permissions are granted.');
        }
    }

    processAudio(analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const energyThreshold = 1.5; // Порог для определения удара
        let lastEnergy = 0;
        let energyHistory = [];
        const historyLength = 10;

        const analyze = () => {
            if (!this.isListening) return;

            analyser.getByteTimeDomainData(dataArray);
            
            // Вычисляем RMS (Root Mean Square) энергию сигнала
            let energy = 0;
            for (let i = 0; i < bufferLength; i++) {
                const amplitude = (dataArray[i] - 128) / 128;
                energy += amplitude * amplitude;
            }
            energy = Math.sqrt(energy / bufferLength);

            // Сохраняем историю энергии
            energyHistory.push(energy);
            if (energyHistory.length > historyLength) {
                energyHistory.shift();
            }

            // Вычисляем среднюю энергию
            const averageEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;

            // Определяем удар, если энергия превышает среднюю на определенный порог
            if (energy > averageEnergy * energyThreshold && 
                energy > lastEnergy && 
                Date.now() - this.lastBeatTime > 200) { // Минимальный интервал между ударами
                
                this.beatDetected();
                this.lastBeatTime = Date.now();
            }

            lastEnergy = energy;
            requestAnimationFrame(analyze);
        };

        analyze();
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

    async toggleListening() {
        if (!this.isListening) {
            if (!this.audioContext) {
                await this.initAudio();
            }
            this.isListening = true;
            this.startButton.textContent = 'Stop Listening';
            this.startButton.classList.add('listening');
            this.fixedBPM = null;
            this.beatTimes = [];
        } else {
            this.isListening = false;
            this.startButton.textContent = 'Start Listening';
            this.startButton.classList.remove('listening');
        }
    }

    fixBPM() {
        // Get BPM from either tapped or detected value
        const bpmText = this.tapTimes.length > 0 ? 
            this.tapBpmDisplay.textContent : 
            this.bpmDisplay.textContent;
        this.fixedBPM = parseInt(bpmText.match(/\d+/)[0]);
        this.isListening = false;
        this.startButton.textContent = 'Start Listening';
        this.startButton.classList.remove('listening');
        this.playRhythmButton.disabled = false;
    }

    handleTap() {
        const now = Date.now();
        this.tapTempoButton.classList.add('active');
        
        // Remove active class after 100ms for visual feedback
        setTimeout(() => {
            this.tapTempoButton.classList.remove('active');
        }, 100);

        // Clear taps if more than 2 seconds have passed
        if (now - this.lastTapTime > 2000) {
            this.tapTimes = [];
        }

        this.tapTimes.push(now);
        this.lastTapTime = now;

        // Keep only the last 4 taps
        if (this.tapTimes.length > 4) {
            this.tapTimes.shift();
        }

        this.calculateTapBPM();
    }

    calculateTapBPM() {
        if (this.tapTimes.length < 2) {
            // If no taps yet, keep showing default BPM
            this.tapBpmDisplay.textContent = `Tapped BPM: ${this.fixedBPM}`;
            return;
        }

        const intervals = [];
        for (let i = 1; i < this.tapTimes.length; i++) {
            intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
        }

        const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const bpm = Math.round(60000 / averageInterval);

        if (bpm >= 40 && bpm <= 220) { // Reasonable BPM range
            this.tapBpmDisplay.textContent = `Tapped BPM: ${bpm}`;
            this.bpmDisplay.textContent = `Detected BPM: ${bpm}`;
            this.fixedBPM = bpm;
        }
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
                const subBeatTime = time + (i * (60 / this.fixedBPM) / 4);
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
                this.createSnare(time + (i * 0.25 * (60 / this.fixedBPM)), 0.7 - (i * 0.1));
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
                this.createSnare(time + (i * (60 / this.fixedBPM) / divisions), 0.7);
            }
        } else {
            // Funk pattern with syncopated kicks
            this.createHihat(time, beatNumber === 0); // Hi-hat on every beat
            
            if (beatNumber === 0) {
                this.createKick(time, 1.2);
            } else if (beatNumber === 1) {
                this.createSnare(time, 0.8);
                this.createKick(time + (60 / this.fixedBPM) / 2, 0.9); // "and" of 2
            } else if (beatNumber === 2) {
                this.createKick(time, 1);
            } else {
                this.createSnare(time, 0.9);
                if (!isLastBar) {
                    this.createKick(time + (60 / this.fixedBPM) / 2, 0.9); // "and" of 4
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
                    time + (i * (60 / this.fixedBPM) / divisions) + swingOffset,
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
                this.createHihat(time + (60 / this.fixedBPM) / 3, false);
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
                    lastScheduledTime += 60 / this.fixedBPM;
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