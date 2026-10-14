import AppKit
import Vision
import Foundation

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fputs("load fail\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("ocr fail: \(error)\n", stderr)
  exit(1)
}
let w = CGFloat(cgImage.width)
let h = CGFloat(cgImage.height)
for obs in request.results ?? [] {
  guard let top = obs.topCandidates(1).first else { continue }
  let text = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
  guard let n = Int(text), n > 0, n < 100 else { continue }
  let box = obs.boundingBox
  let cx = (box.minX + box.maxX) / 2 * w
  let cy = (1 - (box.minY + box.maxY) / 2) * h
  print(n, Int(cx), Int(cy), top.confidence)
}
