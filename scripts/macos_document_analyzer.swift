#!/usr/bin/env swift

import AppKit
import Foundation
import PDFKit
import Vision

struct RecognizedLine: Codable {
    let text: String
    let confidence: Float
    let alternatives: [String]
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct AnalyzedPage: Codable {
    let index: Int
    let width: Double
    let height: Double
    let image: String
    let lines: [RecognizedLine]
    let primaryLineCount: Int
    let secondaryLineCount: Int
}

struct AnalysisResult: Codable {
    let engine: String
    let generatedAt: String
    let pages: [AnalyzedPage]
}

enum AnalyzerError: Error, LocalizedError {
    case usage
    case unreadableInput
    case unsupportedInput
    case renderFailed(Int)
    case imageWriteFailed(Int)

    var errorDescription: String? {
        switch self {
        case .usage:
            return "usage: macos_document_analyzer INPUT OUTPUT_DIRECTORY OUTPUT_JSON"
        case .unreadableInput:
            return "Не удалось прочитать исходный документ"
        case .unsupportedInput:
            return "Поддерживаются PDF, PNG, JPEG, WEBP, TIFF, HEIC и BMP"
        case .renderFailed(let page):
            return "Не удалось отрендерить страницу \(page + 1)"
        case .imageWriteFailed(let page):
            return "Не удалось сохранить изображение страницы \(page + 1)"
        }
    }
}

func normalizedImage(from source: NSImage, maximumWidth: CGFloat = 1800) throws -> CGImage {
    var proposed = CGRect(origin: .zero, size: source.size)
    guard let original = source.cgImage(forProposedRect: &proposed, context: nil, hints: nil) else {
        throw AnalyzerError.unreadableInput
    }
    let originalWidth = CGFloat(original.width)
    let originalHeight = CGFloat(original.height)
    let scale = min(1, maximumWidth / max(1, originalWidth))
    let targetWidth = max(1, Int((originalWidth * scale).rounded()))
    let targetHeight = max(1, Int((originalHeight * scale).rounded()))
    guard let context = CGContext(
        data: nil,
        width: targetWidth,
        height: targetHeight,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { throw AnalyzerError.unreadableInput }
    context.interpolationQuality = .high
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    context.draw(original, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    guard let image = context.makeImage() else { throw AnalyzerError.unreadableInput }
    return image
}

func render(page: PDFPage, index: Int, maximumWidth: CGFloat = 1800) throws -> CGImage {
    let bounds = page.bounds(for: .mediaBox)
    let scale = min(3, maximumWidth / max(1, bounds.width))
    let width = max(1, Int((bounds.width * scale).rounded()))
    let height = max(1, Int((bounds.height * scale).rounded()))
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { throw AnalyzerError.renderFailed(index) }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    guard let image = context.makeImage() else { throw AnalyzerError.renderFailed(index) }
    return image
}

func writePNG(_ image: CGImage, to url: URL, pageIndex: Int) throws {
    let representation = NSBitmapImageRep(cgImage: image)
    guard let data = representation.representation(using: .png, properties: [:]) else {
        throw AnalyzerError.imageWriteFailed(pageIndex)
    }
    try data.write(to: url, options: .atomic)
}

func recognizePass(_ image: CGImage, languageCorrection: Bool, minimumTextHeight: Float) throws -> [RecognizedLine] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = languageCorrection
    request.minimumTextHeight = minimumTextHeight
    if #available(macOS 13.0, *) {
        request.automaticallyDetectsLanguage = true
    }
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    try handler.perform([request])
    let imageWidth = Double(image.width)
    let imageHeight = Double(image.height)
    return (request.results ?? []).compactMap { observation in
        let candidates = observation.topCandidates(3)
        guard let candidate = candidates.first else { return nil }
        let box = observation.boundingBox
        return RecognizedLine(
            text: candidate.string,
            confidence: candidate.confidence,
            alternatives: candidates.dropFirst().map(\.string).filter { $0 != candidate.string },
            x: Double(box.minX) * imageWidth,
            y: (1 - Double(box.maxY)) * imageHeight,
            width: Double(box.width) * imageWidth,
            height: Double(box.height) * imageHeight
        )
    }.sorted { left, right in
        if abs(left.y - right.y) > max(4, min(left.height, right.height) * 0.45) {
            return left.y < right.y
        }
        return left.x < right.x
    }
}

func intersectionRatio(_ left: RecognizedLine, _ right: RecognizedLine) -> Double {
    let intersectionWidth = max(0, min(left.x + left.width, right.x + right.width) - max(left.x, right.x))
    let intersectionHeight = max(0, min(left.y + left.height, right.y + right.height) - max(left.y, right.y))
    let smallerArea = min(left.width * left.height, right.width * right.height)
    return smallerArea > 0 ? intersectionWidth * intersectionHeight / smallerArea : 0
}

func mergeRecognitionPasses(primary: [RecognizedLine], secondary: [RecognizedLine]) -> [RecognizedLine] {
    var merged = primary
    for candidate in secondary {
        if let index = merged.indices.max(by: {
            intersectionRatio(merged[$0], candidate) < intersectionRatio(merged[$1], candidate)
        }), intersectionRatio(merged[index], candidate) >= 0.42 {
            let current = merged[index]
            let alternativeTexts = ([current.text] + current.alternatives + [candidate.text] + candidate.alternatives)
                .reduce(into: [String]()) { result, text in
                    if !result.contains(text) { result.append(text) }
                }
            merged[index] = RecognizedLine(
                text: current.text,
                confidence: max(current.confidence, candidate.confidence),
                alternatives: Array(alternativeTexts.dropFirst().prefix(4)),
                x: current.x,
                y: current.y,
                width: current.width,
                height: current.height
            )
        } else {
            merged.append(candidate)
        }
    }
    return merged.sorted { left, right in
        if abs(left.y - right.y) > max(4, min(left.height, right.height) * 0.45) {
            return left.y < right.y
        }
        return left.x < right.x
    }
}

func analyze(inputURL: URL, outputDirectory: URL) throws -> [AnalyzedPage] {
    let extensionName = inputURL.pathExtension.lowercased()
    let fileManager = FileManager.default
    try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    var images: [CGImage] = []

    if extensionName == "pdf" {
        guard let document = PDFDocument(url: inputURL) else { throw AnalyzerError.unreadableInput }
        for index in 0..<document.pageCount {
            guard let page = document.page(at: index) else { throw AnalyzerError.renderFailed(index) }
            images.append(try render(page: page, index: index))
        }
    } else if ["png", "jpg", "jpeg", "webp", "tif", "tiff", "heic", "bmp"].contains(extensionName) {
        guard let image = NSImage(contentsOf: inputURL) else { throw AnalyzerError.unreadableInput }
        images.append(try normalizedImage(from: image))
    } else {
        throw AnalyzerError.unsupportedInput
    }

    return try images.enumerated().map { index, image in
        let filename = String(format: "page-%03d.png", index + 1)
        try writePNG(image, to: outputDirectory.appendingPathComponent(filename), pageIndex: index)
        let primary = try recognizePass(image, languageCorrection: true, minimumTextHeight: 0.005)
        let secondary = try recognizePass(image, languageCorrection: false, minimumTextHeight: 0.0025)
        return AnalyzedPage(
            index: index,
            width: Double(image.width),
            height: Double(image.height),
            image: filename,
            lines: mergeRecognitionPasses(primary: primary, secondary: secondary),
            primaryLineCount: primary.count,
            secondaryLineCount: secondary.count
        )
    }
}

do {
    guard CommandLine.arguments.count == 4 else { throw AnalyzerError.usage }
    let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
    let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
    let outputJSON = URL(fileURLWithPath: CommandLine.arguments[3])
    let pages = try analyze(inputURL: inputURL, outputDirectory: outputDirectory)
    let formatter = ISO8601DateFormatter()
    let result = AnalysisResult(engine: "macOS Vision (2-pass)", generatedAt: formatter.string(from: Date()), pages: pages)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(result).write(to: outputJSON, options: .atomic)
    print("{\"pages\":\(pages.count),\"lines\":\(pages.reduce(0) { $0 + $1.lines.count })}")
} catch {
    FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
    exit(1)
}
