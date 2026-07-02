import Foundation
import Speech

// Ensures on-device speech transcription model assets are installed for a locale.
// Usage: swift speechassets_helper.swift <bcp47-locale>
// Exit codes: 0 installed (already or after download), 1 download failed,
// 2 bad usage, 3 unsupported locale, 4 OS too old.

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardError.write(Data("usage: speechassets_helper.swift <locale>\n".utf8))
    exit(2)
}
let localeID = CommandLine.arguments[1]

Task {
    guard #available(macOS 26, *) else {
        print("SpeechTranscriber requires macOS 26 or later")
        exit(4)
    }
    do {
        let locale = Locale(identifier: localeID)
        let supported = await SpeechTranscriber.supportedLocales
        guard supported.contains(where: { $0.identifier(.bcp47) == locale.identifier(.bcp47) }) else {
            let ids = supported.map { $0.identifier(.bcp47) }.sorted().joined(separator: ", ")
            print("locale \(localeID) is not supported by SpeechTranscriber; supported: \(ids)")
            exit(3)
        }

        let installed = await SpeechTranscriber.installedLocales
        if installed.contains(where: { $0.identifier(.bcp47) == locale.identifier(.bcp47) }) {
            print("assets for \(localeID) already installed")
            exit(0)
        }

        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [],
            attributeOptions: []
        )
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            print("downloading speech model assets for \(localeID)...")
            try await request.downloadAndInstall()
        }
        print("assets for \(localeID) installed")
        exit(0)
    } catch {
        print("asset installation for \(localeID) failed: \(error)")
        exit(1)
    }
}

dispatchMain()
