import json
import re

with open("new_design.html", "r") as f:
    content = f.read()

# Extract the big json config
start = content.find('tailwind.config = {')
json_match = re.search(r'"extend":\s*(\{.*\})\s*\},', content, re.DOTALL)
if json_match:
    try:
        # Hacky fix: the json might not be perfect if there are trailing commas or unquoted keys, but tailwind script usually has clean json.
        extend_str = json_match.group(1)
        # Fix any JS specific things to valid JSON if needed
        # It's already valid JSON in the string
        extend_data = json.loads(extend_str)
        
        with open("theme.css", "w") as out:
            out.write("@theme {\n")
            if "colors" in extend_data:
                for k, v in extend_data["colors"].items():
                    out.write(f"  --color-{k}: {v};\n")
            if "spacing" in extend_data:
                for k, v in extend_data["spacing"].items():
                    out.write(f"  --spacing-{k}: {v};\n")
            if "fontFamily" in extend_data:
                for k, v in extend_data["fontFamily"].items():
                    out.write(f"  --font-{k}: {v[0]}, sans-serif;\n")
            if "fontSize" in extend_data:
                for k, v in extend_data["fontSize"].items():
                    out.write(f"  --text-{k}: {v[0]};\n")
                    if len(v) > 1 and isinstance(v[1], dict):
                        if "lineHeight" in v[1]:
                            out.write(f"  --text-{k}--line-height: {v[1]['lineHeight']};\n")
                        if "fontWeight" in v[1]:
                            out.write(f"  --text-{k}--font-weight: {v[1]['fontWeight']};\n")
                        if "letterSpacing" in v[1]:
                            out.write(f"  --text-{k}--letter-spacing: {v[1]['letterSpacing']};\n")
            out.write("}\n")
        print("Success")
    except Exception as e:
        print("Failed to parse JSON:", e)
