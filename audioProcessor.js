class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.isListening = false;
        this.beatCallback = null;
        this.visualizationCallback = null;
        this.energyCallback = null;
        
        // Beat detection properties
        this.lastBeatTime = 0;
        this.beatIntervals = [];
        this.energyThreshold = 0.15;
        this.silenceThreshold = 5000; // 5 seconds of silence
        this.amplitudeThreshold = 0.05; // Minimum amplitude to consider as valid input
        
        // Consistency tracking
        this.consistencyTracker = {
            fixedBPM: null,
            detectedBPMs: [],
            consistentBars: 0,
            maxConsistentBars: 4,
            toleranceRange: 10 // ±10 BPM tolerance
        };

        // Advanced BPM calculation properties
        this.bpmHistory = [];
        const MAX_BPM_HISTORY = 16;
        this.maxBpmHistory = MAX_BPM_HISTORY;
    }

    setCallbacks(beatCallback, visualizationCallback, energyCallback) {
        this.beatCallback = beatCallback;
        this.visualizationCallback = visualizationCallback;
        this.energyCallback = energyCallback;
    }

    async startListening() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            // Create analyzer for visualization
            const visualAnalyser = this.audioContext.createAnalyser();
            visualAnalyser.fftSize = 2048;
            visualAnalyser.smoothingTimeConstant = 0.8;
            source.connect(visualAnalyser);
            
            // Create chain for beat detection
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 100;
            filter.Q.value = 1.0;
            
            const beatAnalyser = this.audioContext.createAnalyser();
            beatAnalyser.fftSize = 2048;
            beatAnalyser.smoothingTimeConstant = 0.4;
            
            source.connect(filter);
            filter.connect(beatAnalyser);
            
            this.isListening = true;
            this.processAudio(visualAnalyser, beatAnalyser);
            
            return true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            return false;
        }
    }

    stopListening() {
        this.isListening = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    checkConsistency(detectedBPM) {
        const { fixedBPM, toleranceRange, detectedBPMs, maxConsistentBars } = this.consistencyTracker;

        if (!fixedBPM) return false;

        // Check if detected BPM is within tolerance range
        const isWithinTolerance = Math.abs(detectedBPM - fixedBPM) <= toleranceRange;

        // Update detected BPMs history
        this.consistencyTracker.detectedBPMs.push(detectedBPM);
        if (this.consistencyTracker.detectedBPMs.length > maxConsistentBars) {
            this.consistencyTracker.detectedBPMs.shift();
        }

        // Check consistency of all recent BPM detections
        const allConsistent = this.consistencyTracker.detectedBPMs.every(
            bpm => Math.abs(bpm - fixedBPM) <= toleranceRange
        );

        if (allConsistent) {
            this.consistencyTracker.consistentBars++;
        } else {
            this.consistencyTracker.consistentBars = 0;
        }

        // Return true if consistent for 4 bars
        return this.consistencyTracker.consistentBars >= maxConsistentBars;
    }

    setFixedBPM(bpm) {
        this.consistencyTracker.fixedBPM = bpm;
        this.consistencyTracker.detectedBPMs = [];
        this.consistencyTracker.consistentBars = 0;
    }

    calculateBPM() {
        if (this.beatIntervals.length < 4) return null;

        // Remove extreme outliers using interquartile range (IQR) method
        const sortedIntervals = [...this.beatIntervals].sort((a, b) => a - b);
        const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
        const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Filter intervals within IQR
        const filteredIntervals = sortedIntervals.filter(
            interval => interval >= lowerBound && interval <= upperBound
        );

        // Calculate average interval
        const averageInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
        
        // Convert to BPM
        const bpm = Math.round(60000 / averageInterval);
        
        // Validate BPM range and add to history
        if (bpm >= 40 && bpm <= 240) {
            this.bpmHistory.push(bpm);
            
            // Maintain fixed-size history
            if (this.bpmHistory.length > this.maxBpmHistory) {
                this.bpmHistory.shift();
            }

            return this.calculateWeightedAverageBPM();
        }

        return null;
    }

    calculateWeightedAverageBPM() {
        if (this.bpmHistory.length === 0) return null;

        // Exponential weighted moving average
        // More recent BPM values have higher weight
        const weights = this.bpmHistory.map((_, index) => 
            Math.pow(1.5, index - this.bpmHistory.length + 1)
        );

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const weightedAverage = this.bpmHistory.reduce((sum, bpm, index) => 
            sum + bpm * weights[index], 0
        ) / totalWeight;

        return Math.round(weightedAverage);
    }

    processAudio(visualAnalyser, beatAnalyser) {
        const visualBufferLength = visualAnalyser.frequencyBinCount;
        const beatBufferLength = beatAnalyser.frequencyBinCount;
        const visualDataArray = new Uint8Array(visualBufferLength);
        const beatDataArray = new Uint8Array(beatBufferLength);
        
        let peakDetected = false;
        let lastPeakEnergy = 0;
        let energyHistory = [];
        const historyLength = 10;

        const analyze = () => {
            if (!this.isListening) return;

            // Get visualization data
            visualAnalyser.getByteTimeDomainData(visualDataArray);
            if (this.visualizationCallback) {
                this.visualizationCallback(visualDataArray);
            }
            
            // Get beat detection data
            beatAnalyser.getByteTimeDomainData(beatDataArray);
            
            // Calculate RMS energy
            let energy = 0;
            for (let i = 0; i < beatBufferLength; i++) {
                const amplitude = (beatDataArray[i] - 128) / 128;
                energy += amplitude * amplitude;
            }
            energy = Math.sqrt(energy / beatBufferLength);

            // Ignore low amplitude input
            if (energy < this.amplitudeThreshold) {
                requestAnimationFrame(analyze);
                return;
            }

            // Update energy history
            energyHistory.push(energy);
            if (energyHistory.length > historyLength) {
                energyHistory.shift();
            }

            // Calculate average energy
            const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
            
            // Peak detection with adaptive threshold
            const currentTime = Date.now();
            const timeSinceLastPeak = currentTime - this.lastPeakTime;

            if (energy > avgEnergy * this.energyThreshold && 
                energy > lastPeakEnergy && 
                timeSinceLastPeak > 200) {  // Minimum interval between beats
                
                // Detect beat
                if (this.beatCallback) {
                    this.beatCallback();
                }

                // Calculate beat interval
                if (this.lastBeatTime > 0) {
                    const interval = currentTime - this.lastBeatTime;
                    
                    // Store beat intervals (max 16)
                    this.beatIntervals.push(interval);
                    if (this.beatIntervals.length > 16) {
                        this.beatIntervals.shift();
                    }
                }

                this.lastBeatTime = currentTime;
                this.lastPeakTime = currentTime;
                lastPeakEnergy = energy;
                peakDetected = true;
            }

            // Energy callback
            if (this.energyCallback) {
                this.energyCallback(energy);
            }

            // Check for silence
            if (!peakDetected && currentTime - this.lastPeakTime > this.silenceThreshold) {
                // Reset beat detection if no beats for 5 seconds
                this.beatIntervals = [];
                this.lastBeatTime = 0;
                this.bpmHistory = [];
            }

            // Schedule next analysis frame
            requestAnimationFrame(analyze);
        };

        // Start analysis
        analyze();
    }
}
