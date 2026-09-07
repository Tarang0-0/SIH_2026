import re, json

with open("new_design.html", "r") as f:
    html = f.read()

# Extract json
m = re.search(r'"extend":\s*({.*})\s*},', html, re.DOTALL)
if m:
    data = json.loads(m.group(1))
    
    with open("theme.css", "w") as f:
        f.write("@theme {\n")
        for k, v in data.get("colors", {}).items():
            f.write(f"  --color-{k}: {v};\n")
        for k, v in data.get("spacing", {}).items():
            f.write(f"  --spacing-{k}: {v};\n")
        for k, v in data.get("fontFamily", {}).items():
            f.write(f"  --font-{k}: {v[0]}, sans-serif;\n")
        for k, v in data.get("fontSize", {}).items():
            f.write(f"  --text-{k}: {v[0]};\n")
            if len(v) > 1:
                opts = v[1]
                if "lineHeight" in opts:
                    f.write(f"  --text-{k}--line-height: {opts['lineHeight']};\n")
                if "fontWeight" in opts:
                    f.write(f"  --text-{k}--font-weight: {opts['fontWeight']};\n")
                if "letterSpacing" in opts:
                    f.write(f"  --text-{k}--letter-spacing: {opts['letterSpacing']};\n")
        f.write("}\n")
        print("Success")
