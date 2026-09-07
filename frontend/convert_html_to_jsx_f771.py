import re

def html_to_jsx(html):
    jsx = html.replace('class="', 'className="')
    
    # Handlers for inline style if any (Tailwind 4 uses arbitrary values mostly, but just in case)
    jsx = re.sub(r'style="([^"]+)"', lambda m: 'style={{' + ', '.join([f'"{k.strip()}": "{v.strip()}"' for k, v in [p.split(':') for p in m.group(1).split(';') if ':' in p]]) + '}}', jsx)
    
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
    jsx = jsx.replace('fill-rule="', 'fillRule="')
    jsx = jsx.replace('clip-rule="', 'clipRule="')
    jsx = jsx.replace('stroke-linecap="', 'strokeLinecap="')
    jsx = jsx.replace('stroke-linejoin="', 'strokeLinejoin="')

    # Convert HTML comments to JSX comments
    jsx = re.sub(r'<!--(.*?)-->', r'{/*\1*/}', jsx, flags=re.DOTALL)
    
    # Remove closing tags for self-closing elements
    for t in ['path', 'img', 'input', 'br', 'hr']:
        jsx = jsx.replace(f'</{t}>', '')
    
    # Self-close specific tags
    self_closing_tags = ['input', 'img', 'br', 'hr', 'path']
    for tag in self_closing_tags:
        jsx = re.sub(r'<(%s\b[^>]*)>' % tag, lambda m: '<' + m.group(1).rstrip('/') + ' />', jsx)
        
    # fix inline style mapping to camelCase (basic fix)
    jsx = jsx.replace('"background-image":', '"backgroundImage":')
    jsx = jsx.replace('"background-color":', '"backgroundColor":')
    jsx = jsx.replace('"background-size":', '"backgroundSize":')
    jsx = jsx.replace('"font-size":', '"fontSize":')
    jsx = jsx.replace('"margin-top":', '"marginTop":')
    jsx = jsx.replace('"border-radius":', '"borderRadius":')
    
    return jsx

with open("real_home_f771.html", "r") as f:
    html = f.read()

body_match = re.search(r'<body[^>]*>(.*)</body>', html, flags=re.DOTALL | re.IGNORECASE)
if body_match:
    body_html = body_match.group(1)
else:
    body_html = html

body_html = re.sub(r'<script.*?>.*?</script>', '', body_html, flags=re.DOTALL | re.IGNORECASE)

jsx = html_to_jsx(body_html)
print(jsx)
