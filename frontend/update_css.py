import re
import json

with open("generated_screen.html", "r") as f:
    html = f.read()

config_match = re.search(r'tailwind\.config\s*=\s*({.*?})\s*</script>', html, flags=re.DOTALL)
if config_match:
    # Use simple extraction because JSON parsing might fail on raw JS object
    js_obj_str = config_match.group(1)
    
    # We want to extract the colors dict and others and convert to CSS vars
    colors = re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', js_obj_str)
    
    # filter for hex codes or rgb
    css_vars = []
    for k, v in colors:
        if k in ['DEFAULT', 'lg', 'xl', 'full', 'unit', 'stack-gap', 'card-padding', 'gutter', 'container-margin']:
            continue
        if v.startswith('#') or 'rgba' in v or k.endswith('px'):
            if 'px' not in v and k not in ['lineHeight']:
                css_vars.append(f"  --color-{k}: {v};")

    # Spacing
    spacing = re.findall(r'"([^"]+)"\s*:\s*"([0-9]+px)"', js_obj_str)
    for k, v in spacing:
        if k != 'lineHeight' and k != 'fontSize':
            css_vars.append(f"  --spacing-{k}: {v};")
            
    # Fonts are harder, let's just add font families to global css if needed, but tailwind v4 handles fonts via CSS vars if configured.
    
    with open("src/app/globals.css", "r") as f:
        existing_css = f.read()
        
    theme_block = "\n".join(css_vars)
    # Insert inside @theme
    new_css = existing_css.replace("@theme {", "@theme {\n" + theme_block)
    
    with open("src/app/globals.css", "w") as f:
        f.write(new_css)
        print("Updated globals.css")
