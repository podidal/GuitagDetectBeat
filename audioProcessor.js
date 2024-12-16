class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.isListening = false;
        this.beatCallback = null;
        this.visualizationCallback = null;
        this.energyCallback = null;
        this.lastBeatTime = 0;
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

    processAudio(visualAnalyser, beatAnalyser) {
        const visualBufferLength = visualAnalyser.frequencyBinCount;
        const beatBufferLength = beatAnalyser.frequencyBinCount;
        const visualDataArray = new Uint8Array(visualBufferLength);
        const beatDataArray = new Uint8Array(beatBufferLength);
        
        const energyThreshold = 2.0; // Increased sensitivity
        const minTimeBetweenBeats = 300; // Minimum time between beats (ms)
        const maxTimeBetweenBeats = 2000; // Maximum time between beats (ms)
        
        let lastEnergy = 0;
        let energyHistory = [];
        const historyLength = 15; // Increased history length
        
        // Beat detection parameters
        let beatConfidence = 0;
        const confidenceThreshold = 3; // Require multiple signals to confirm a beat
        let expectedBeatInterval = 0;
        let lastBeatTimestamp = 0;

        const analyze = () => {
            if (!this.isListening) return;

            // Get visualization data
            visualAnalyser.getByteTimeDomainData(visualDataArray);
            if (this.visualizationCallback) {
                this.visualizationCallback(visualDataArray);
            }
            
            // Get beat detection data
            beatAnalyser.getByteTimeDomainData(beatDataArray);
            
            // Calculate RMS energy with more robust method
            let energy = 0;
            let peakAmplitude = 0;
            for (let i = 0; i < beatBufferLength; i++) {
                const amplitude = Math.abs((beatDataArray[i] - 128) / 128);
                energy += amplitude * amplitude;
                peakAmplitude = Math.max(peakAmplitude, amplitude);
            }
            energy = Math.sqrt(energy / beatBufferLength);

            // Update energy history
            energyHistory.push(energy);
            if (energyHistory.length > historyLength) {
                energyHistory.shift();
            }

            // Calculate energy statistics
            const averageEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
            const energyVariance = energyHistory.reduce((a, b) => a + Math.pow(b - averageEnergy, 2), 0) / energyHistory.length;

            // Send energy data to callback
            if (this.energyCallback) {
                this.energyCallback(energy);
            }

            // Advanced beat detection
            const currentTime = Date.now();
            const timeSinceLastBeat = currentTime - this.lastBeatTime;

            // Check for potential beat conditions
            const isEnergySignificant = energy > averageEnergy * energyThreshold;
            const isEnergyIncreasing = energy > lastEnergy;
            const isTimingValid = timeSinceLastBeat > minTimeBetweenBeats && 
                                  timeSinceLastBeat < maxTimeBetweenBeats;

            // Adaptive beat confidence
            if (isEnergySignificant && isEnergyIncreasing) {
                beatConfidence++;
            } else {
                beatConfidence = Math.max(0, beatConfidence - 1);
            }

            // Confirm beat with confidence and timing
            if (beatConfidence >= confidenceThreshold && isTimingValid) {
                if (this.beatCallback) {
                    this.beatCallback();
                }
                
                // Update beat interval for future prediction
                if (lastBeatTimestamp > 0) {
                    expectedBeatInterval = currentTime - lastBeatTimestamp;
                }
                
                lastBeatTimestamp = currentTime;
                this.lastBeatTime = currentTime;
                beatConfidence = 0; // Reset confidence
            }

            lastEnergy = energy;
            requestAnimationFrame(analyze);
        };

        analyze();
    }
}
