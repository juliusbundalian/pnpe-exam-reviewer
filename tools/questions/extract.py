"""Read-only registered PDF extraction; no OCR, normalization or answer inference."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def validated_output(raw):
    output = Path(raw).resolve()
    allowed = ROOT / "evidence"
    if allowed.is_symlink() or not output.is_relative_to(allowed) or output == allowed:
        raise ValueError("Unsafe output: use a child directory under repository evidence/")
    return output


def write_generated(path, content):
    if path.is_symlink():
        raise ValueError("Unsafe output: generated file is a symlink")
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f"Refusing to overwrite differing evidence: {path.name}")
    else:
        with path.open("xb") as stream:
            stream.write(content)


def extract(input_path, output):
    registry = json.loads((ROOT / "data/source-manifest.json").read_text())
    source = next((entry for entry in registry if entry["filename"] == input_path.name), None)
    if source is None:
        raise ValueError("Unknown reference filename")
    raw = input_path.read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    if checksum != source["sha256"]:
        raise ValueError("Source checksum mismatch")
    import pymupdf
    if pymupdf.VersionBind != "1.28.2":
        raise ValueError("Install pinned PyMuPDF==1.28.2")
    directory = output / source["sourceId"]
    images = directory / "images"
    if directory.is_symlink() or images.is_symlink():
        raise ValueError("Unsafe output: source or image directory is a symlink")
    with pymupdf.open(stream=raw, filetype="pdf") as document:
        if len(document) != source["expectedPageCount"]:
            raise ValueError("Source page count mismatch")
        records = []
        image_bytes = {}
        for index, page in enumerate(document):
            record = {"page": index + 1, "text": page.get_text("text", sort=True),
                      "blocks": page.get_text("blocks"),
                      "links": [link["uri"] for link in page.get_links() if "uri" in link],
                      "imageRefs": [], "imagePlacements": []}
            for image in page.get_images(full=True):
                xref = image[0]
                extracted = document.extract_image(xref)
                content = extracted["image"]
                name = hashlib.sha256(content).hexdigest() + "." + extracted["ext"]
                reference = "images/" + name
                image_bytes[name] = content
                record["imageRefs"].append(reference)
                for rectangle in page.get_image_rects(xref):
                    record["imagePlacements"].append({"imageRef": reference, "xref": xref, "bbox": list(rectangle)})
            records.append(record)
        evidence = {"sourceId": source["sourceId"], "sha256": checksum,
                    "pageCount": len(document), "pages": records}
    images.mkdir(parents=True, exist_ok=True)
    for name, content in image_bytes.items():
        write_generated(images / name, content)
    write_generated(directory / "document.json", (json.dumps(evidence, ensure_ascii=False, indent=2) + "\n").encode())
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        output = validated_output(args.output)
        evidence = extract(args.input, output)
        print(json.dumps({"sourceId": evidence["sourceId"], "pages": evidence["pageCount"],
                          "imagePlacements": sum(len(page["imagePlacements"]) for page in evidence["pages"])}))
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + "\n")


if __name__ == "__main__":
    main()
