from pathlib import Path
import fitz

pdf_path = Path("attached_assets/EMMERCTY_LOGO_EDITED_1789388587864.pdf")
output_dir = Path(".agents/outputs/school-logo-pdf")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
print(f"pages={document.page_count}")
print(f"metadata={document.metadata}")

for page_number, page in enumerate(document, start=1):
    print(f"\n--- page {page_number} size={page.rect} ---")
    print(page.get_text("text"))
    images = page.get_images(full=True)
    print(f"embedded_images={len(images)}")
    for image_number, image in enumerate(images, start=1):
        xref = image[0]
        extracted = document.extract_image(xref)
        extension = extracted["ext"]
        image_path = output_dir / f"page-{page_number}-image-{image_number}.{extension}"
        image_path.write_bytes(extracted["image"])
        print(f"image={image_path} size={extracted['width']}x{extracted['height']}")

    rendered = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    rendered_path = output_dir / f"page-{page_number}.png"
    rendered.save(rendered_path)
    print(f"rendered={rendered_path} size={rendered.width}x{rendered.height}")