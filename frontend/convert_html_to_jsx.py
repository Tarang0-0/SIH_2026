import re

def html_to_jsx(html):
    # Replace class= with className=
    jsx = html.replace('class="', 'className="')
    
    # Handle style attribute manually
    # For now, let's just remove the specific problematic inline styles or fix them
    jsx = re.sub(r'style="font-variation-settings:\s*\'FILL\'\s*1;"', 'style={{ fontVariationSettings: "\\\'FILL\\\' 1" }}', jsx)
    jsx = re.sub(r'style="background-image:\s*url\(\'(.*?)\'\);"', r'style={{ backgroundImage: "url(\'\1\')" }}', jsx)
    jsx = re.sub(r'style="background-image:\s*radial-gradient\(#fff 1px, transparent 1px\);\s*background-size:\s*40px 40px;"', 'style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}', jsx)
    jsx = re.sub(r'style="font-size:\s*36px;"', 'style={{ fontSize: "36px" }}', jsx)
    
    # Replace tabindex= with tabIndex=
    jsx = jsx.replace('tabindex="', 'tabIndex="')
    jsx = jsx.replace('datetime="', 'dateTime="')
    jsx = jsx.replace('autocomplete="', 'autoComplete="')
    jsx = jsx.replace('autofocus', 'autoFocus')
    jsx = jsx.replace('readonly', 'readOnly')
    jsx = jsx.replace('maxlength="', 'maxLength="')
    jsx = jsx.replace('minlength="', 'minLength="')
    jsx = jsx.replace('stroke-width="', 'strokeWidth="')
    jsx = jsx.replace('stroke-dasharray="', 'strokeDasharray="')
    jsx = jsx.replace('viewbox="', 'viewBox="')
    
    # Convert HTML comments to JSX comments
    jsx = re.sub(r'<!--(.*?)-->', r'{/*\1*/}', jsx, flags=re.DOTALL)
    
    # Remove closing tags for self-closing elements that we're going to fix
    jsx = jsx.replace('</path>', '')
    jsx = jsx.replace('</img>', '')
    jsx = jsx.replace('</input>', '')
    
    # Self-close specific tags
    self_closing_tags = ['input', 'img', 'br', 'hr', 'path']
    for tag in self_closing_tags:
        jsx = re.sub(r'<(%s\b[^>]*)>' % tag, lambda m: '<' + m.group(1).rstrip('/') + ' />', jsx)
        
    return jsx

with open("generated_screen.html", "r") as f:
    html = f.read()

body_match = re.search(r'<body[^>]*>(.*)</body>', html, flags=re.DOTALL | re.IGNORECASE)
if body_match:
    body_html = body_match.group(1)
else:
    body_html = html

body_html = re.sub(r'<script.*?>.*?</script>', '', body_html, flags=re.DOTALL | re.IGNORECASE)

jsx = html_to_jsx(body_html)
print(jsx)
