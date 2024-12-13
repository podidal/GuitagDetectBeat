class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.isListening = false;
        this.visualizationCallback = null;
        this.energyCallback = null;
        
        // Advanced audio analysis properties
        this.audioBuffer = [];
        this.bufferSize = 100; // Store last 100 samples
        this.silenceThreshold = 0.05; // Amplitude threshold to ignore noise
        this.bpmHistory = [];
        this.bpmHistorySize = 16; // Rolling average for BPM
        this.consistencyWindow = 4; // 4 bars consistency check
        this.bpmTolerance = 10; // ±10 BPM tolerance
    }

    setCallbacks(visualizationCallback, energyCallback) {
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
            
            this.isListening = true;
            this.processAudio(visualAnalyser);
            
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

    calculateBPM() {
        if (this.bpmHistory.length < 4) return null;

        // Calculate rolling average BPM
        const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
        const middleBPMs = sortedBPMs.slice(
            Math.floor(sortedBPMs.length * 0.2), 
            Math.floor(sortedBPMs.length * 0.8)
        );

        const avgBPM = middleBPMs.reduce((a, b) => a + b, 0) / middleBPMs.length;
        return Math.round(avgBPM);
    }

    isConsistentBPM(fixedBPM) {
        if (this.bpmHistory.length < this.consistencyWindow) return false;

        // Check if recent BPMs are within tolerance
        return this.bpmHistory.every(bpm => 
            Math.abs(bpm - fixedBPM) <= this.bpmTolerance
        );
    }

    processAudio(visualAnalyser) {
        const visualBufferLength = visualAnalyser.frequencyBinCount;
        const visualDataArray = new Uint8Array(visualBufferLength);
        
        const analyze = () => {
            if (!this.isListening) return;

            // Get visualization data
            visualAnalyser.getByteTimeDomainData(visualDataArray);
            if (this.visualizationCallback) {
                this.visualizationCallback(visualDataArray);
            }

            // Calculate RMS energy
            let energy = 0;
            for (let i = 0; i < visualBufferLength; i++) {
                const amplitude = (visualDataArray[i] - 128) / 128;
                energy += amplitude * amplitude;
            }
            energy = Math.sqrt(energy / visualBufferLength);

            // Ignore low-energy signals (noise/silence)
            if (energy > this.silenceThreshold) {
                // Estimate BPM (simplified method)
                const estimatedBPM = this.estimateBPMFromBuffer(visualDataArray);
                
                if (estimatedBPM) {
                    // Update BPM history
                    this.bpmHistory.push(estimatedBPM);
                    if (this.bpmHistory.length > this.bpmHistorySize) {
                        this.bpmHistory.shift();
                    }
                }
            }

            // Energy callback
            if (this.energyCallback) {
                this.energyCallback(energy);
            }

            // Schedule next analysis frame
            requestAnimationFrame(analyze);
        };

        // Start analysis
        analyze();
    }

    estimateBPMFromBuffer(dataArray) {
        // Simplified BPM estimation based on zero-crossings
        let zeroCrossings = 0;
        for (let i = 1; i < dataArray.length; i++) {
            if ((dataArray[i-1] < 128 && dataArray[i] >= 128) || 
                (dataArray[i-1] > 128 && dataArray[i] <= 128)) {
                zeroCrossings++;
            }
        }

        // Convert zero-crossings to rough BPM estimate
        const sampleRate = 44100; // Typical sample rate
        const secondsPerMinute = 60;
        const bpm = (zeroCrossings * sampleRate * secondsPerMinute) / (dataArray.length * 2);

        // Validate BPM range
        return (bpm >= 40 && bpm <= 240) ? Math.round(bpm) : null;
    }
}
