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

let request = VNClassifyImageRequest()
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("vision fail: \(error)\n", stderr)
  exit(1)
}
guard let results = request.results as? [VNClassificationObservation] else { exit(0) }
for o in results.prefix(12) {
  print(String(format: "%.3f", o.confidence), o.identifier)
}
