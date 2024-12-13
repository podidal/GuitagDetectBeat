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
        
        const energyThreshold = 1.5;
        let lastEnergy = 0;
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

            // Update energy history
            energyHistory.push(energy);
            if (energyHistory.length > historyLength) {
                energyHistory.shift();
            }

            // Calculate average energy
            const averageEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;

            // Send energy data to callback
            if (this.energyCallback) {
                this.energyCallback(energy);
            }

            // Detect beat
            if (energy > averageEnergy * energyThreshold && 
                energy > lastEnergy && 
                Date.now() - this.lastBeatTime > 200) {
                
                if (this.beatCallback) {
                    this.beatCallback();
                }
                this.lastBeatTime = Date.now();
            }

            lastEnergy = energy;
            requestAnimationFrame(analyze);
        };

        analyze();
    }
}
