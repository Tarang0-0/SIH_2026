import re
import json

with open("real_home_f771.html", "r") as f:
    html = f.read()

config_match = re.search(r'tailwind\.config\s*=\s*({.*?})\s*</script>', html, flags=re.DOTALL)
if config_match:
    js_obj_str = config_match.group(1)
    colors = re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', js_obj_str)
    
    css_vars = []
    for k, v in colors:
        if k in ['DEFAULT', 'lg', 'xl', 'full', 'unit', 'stack-gap', 'card-padding', 'gutter', 'container-margin']:
            continue
        if v.startswith('#') or 'rgba' in v or k.endswith('px'):
            if 'px' not in v and k not in ['lineHeight']:
                css_vars.append(f"  --color-{k}: {v};")

    spacing = re.findall(r'"([^"]+)"\s*:\s*"([0-9]+px)"', js_obj_str)
    for k, v in spacing:
        if k != 'lineHeight' and k != 'fontSize':
            css_vars.append(f"  --spacing-{k}: {v};")
            
    with open("src/app/globals.css", "r") as f:
        existing_css = f.read()
        
    theme_block = "\n".join(css_vars)
    # Remove old theme variables to avoid clutter, or just append inside @theme
    # But since it's tailwind 4, let's just append inside @theme
    new_css = existing_css.replace("@theme {", "@theme {\n" + theme_block)
    
    with open("src/app/globals.css", "w") as f:
        f.write(new_css)
        print("Updated globals.css")
