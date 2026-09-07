import re

with open("new_design.html", "r") as f:
    html = f.read()

# Extract body inner HTML
body_match = re.search(r'<body[^>]*>(.*)</body>', html, re.DOTALL | re.IGNORECASE)
if not body_match:
    print("Body not found")
    exit(1)

body_content = body_match.group(1)

# Remove script tags
body_content = re.sub(r'<script.*?</script>', '', body_content, flags=re.DOTALL)

# Convert class to className
body_content = re.sub(r'\bclass=', 'className=', body_content)

# Convert style="..." to style={{...}}
def style_repl(match):
    style_str = match.group(1)
    # Simple parse for style="font-variation-settings: 'FILL' 0;"
    if "font-variation-settings" in style_str:
        return 'style={{ fontVariationSettings: "\\\'FILL\\\' 0" }}' if "'FILL' 0" in style_str else 'style={{ fontVariationSettings: "\\\'FILL\\\' 1" }}'
    if "background-image" in style_str:
        url = re.search(r"url\('([^']+)'\)", style_str)
        if url:
            return f"style={{ {{ backgroundImage: 'url(\"{url.group(1)}\")' }} }}"
    return f"style={{{{ /* {style_str} */ }}}}"

body_content = re.sub(r'style="([^"]*)"', style_repl, body_content)

# Fix self closing tags
body_content = re.sub(r'<br>', '<br />', body_content)
body_content = re.sub(r'<input([^>]*[^/])>', r'<input\1 />', body_content)
body_content = re.sub(r'<img([^>]*[^/])>', r'<img\1 />', body_content)
body_content = re.sub(r'<hr([^>]*[^/])>', r'<hr\1 />', body_content)

# Fix comments
body_content = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', body_content, flags=re.DOTALL)

with open("page_jsx.txt", "w") as f:
    f.write(body_content)
print("Conversion done.")
