import AVFoundation
import Foundation
import Speech

struct SpeechEvent: Encodable {
    let type: String
    let value: Double?
    let text: String?
}

func emit(_ event: SpeechEvent) {
    let encoder = JSONEncoder()
    guard let data = try? encoder.encode(event) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

enum DictationError: LocalizedError {
    case recognizerUnavailable
    case speechPermissionDenied
    case microphonePermissionDenied
    case transcriptionFailed(String)

    var errorDescription: String? {
        switch self {
        case .recognizerUnavailable:
            return "Speech recognizer is unavailable on this Mac"
        case .speechPermissionDenied:
            return "Speech recognition permission was denied"
        case .microphonePermissionDenied:
            return "Microphone permission was denied"
        case let .transcriptionFailed(message):
            return message
        }
    }
}

final class DictationSession {
    private let audioEngine = AVAudioEngine()
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private let recognizer = SFSpeechRecognizer()
    private var task: SFSpeechRecognitionTask?
    private let semaphore = DispatchSemaphore(value: 0)
    private var outcome: Result<String, Error>?
    private var transcript = ""
    private var lastLevelEmit = CFAbsoluteTimeGetCurrent()

    func run() throws -> String {
        try requestPermissions()
        try startRecognition()

        let timeout = DispatchQueue.global(qos: .userInitiated)
        timeout.asyncAfter(deadline: .now() + 8) { [weak self] in
            self?.finishIfNeeded()
        }

        semaphore.wait()
        stopRecognition()

        switch outcome {
        case let .success(text):
            return text
        case let .failure(error):
            throw error
        case .none:
            throw DictationError.transcriptionFailed("Speech transcription ended unexpectedly")
        }
    }

    private func requestPermissions() throws {
        let speechStatus = DispatchSemaphore(value: 0)
        var speechAuth = SFSpeechRecognizerAuthorizationStatus.notDetermined

        SFSpeechRecognizer.requestAuthorization { status in
            speechAuth = status
            speechStatus.signal()
        }

        speechStatus.wait()
        guard speechAuth == .authorized else {
            throw DictationError.speechPermissionDenied
        }

        let micStatus = DispatchSemaphore(value: 0)
        var micGranted = false

        AVCaptureDevice.requestAccess(for: .audio) { granted in
            micGranted = granted
            micStatus.signal()
        }

        micStatus.wait()
        guard micGranted else {
            throw DictationError.microphonePermissionDenied
        }
    }

    private func startRecognition() throws {
        guard let recognizer, recognizer.isAvailable else {
            throw DictationError.recognizerUnavailable
        }

        request.shouldReportPartialResults = true
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.emitLevel(from: buffer)
            self?.request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            if let result {
                self.transcript = result.bestTranscription.formattedString
                if result.isFinal {
                    self.complete(.success(self.transcript))
                    return
                }
            }

            if let error {
                if !self.transcript.isEmpty {
                    self.complete(.success(self.transcript))
                } else {
                    self.complete(.failure(DictationError.transcriptionFailed(error.localizedDescription)))
                }
            }
        }
    }

    private func emitLevel(from buffer: AVAudioPCMBuffer) {
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastLevelEmit < 0.05 {
            return
        }

        lastLevelEmit = now

        guard let samples = buffer.floatChannelData?[0] else {
            return
        }

        let frameCount = Int(buffer.frameLength)
        if frameCount == 0 {
            return
        }

        var sum: Float = 0
        for index in 0 ..< frameCount {
            let sample = samples[index]
            sum += sample * sample
        }

        let rms = sqrt(sum / Float(frameCount))
        let normalized = min(max(Double(rms) * 12.0, 0), 1)
        emit(SpeechEvent(type: "level", value: normalized, text: nil))
    }

    private func finishIfNeeded() {
        if !transcript.isEmpty {
            complete(.success(transcript))
        } else {
            complete(.failure(DictationError.transcriptionFailed("No speech was detected within the recording window")))
        }
    }

    private func complete(_ result: Result<String, Error>) {
        guard outcome == nil else { return }
        outcome = result
        semaphore.signal()
    }

    private func stopRecognition() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request.endAudio()
        task?.cancel()
        task = nil
    }
}

do {
    let session = DictationSession()
    let text = try session.run()
    emit(SpeechEvent(type: "result", value: nil, text: text))
} catch {
    let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    FileHandle.standardError.write(Data(message.utf8))
    exit(1)
}
