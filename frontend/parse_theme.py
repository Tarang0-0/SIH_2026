import json

with open("new_design.html", "r") as f:
    content = f.read()

start = content.find('tailwind.config = {')
if start == -1:
    print("Not found")
    exit(1)

# Hacky extract JSON
start = content.find('extend: {', start) + 9
end = content.find('},', content.find('fontSize:', start) + 20)

# We will just write a simpler approach: extract the specific colors, fonts, spacing, borderRadius using regex
import re

color_match = re.search(r'"colors":\s*(\{.*?\})', content, re.DOTALL)
if color_match:
    colors = json.loads(color_match.group(1).replace('\'', '"'))
    print("@theme {")
    for k, v in colors.items():
        print(f"  --color-{k}: {v};")
    
    print("\n  /* Spacing */")
    spacing = re.search(r'"spacing":\s*(\{.*?\})', content, re.DOTALL)
    if spacing:
        sp = json.loads(spacing.group(1))
        for k, v in sp.items():
            print(f"  --spacing-{k}: {v};")

    print("\n  /* Fonts */")
    fonts = re.search(r'"fontFamily":\s*(\{.*?\})', content, re.DOTALL)
    if fonts:
        fs = json.loads(fonts.group(1))
        for k, v in fs.items():
            print(f"  --font-{k}: {v[0]}, sans-serif;")
            
    print("\n  /* Font Sizes */")
    fsizes = re.search(r'"fontSize":\s*(\{.*?\})', content, re.DOTALL)
    if fsizes:
        fs = json.loads(fsizes.group(1))
        for k, v in fs.items():
            print(f"  --text-{k}: {v[0]};")
            print(f"  --text-{k}--line-height: {v[1]['lineHeight']};")
            print(f"  --text-{k}--font-weight: {v[1]['fontWeight']};")
            if 'letterSpacing' in v[1]:
                print(f"  --text-{k}--letter-spacing: {v[1]['letterSpacing']};")
    print("}")
