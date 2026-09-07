const fs = require('fs');
const html = fs.readFileSync('new_design.html', 'utf8');
const match = html.match(/extend:\s*(\{[\s\S]*?\})\s*\},/);
if (match) {
    // evaluate the string to an object
    const extend = eval('(' + match[1] + ')');
    let css = '@theme {\n';
    if (extend.colors) {
        for (const [k, v] of Object.entries(extend.colors)) {
            css += `  --color-${k}: ${v};\n`;
        }
    }
    if (extend.spacing) {
        for (const [k, v] of Object.entries(extend.spacing)) {
            css += `  --spacing-${k}: ${v};\n`;
        }
    }
    if (extend.fontFamily) {
        for (const [k, v] of Object.entries(extend.fontFamily)) {
            css += `  --font-${k}: ${v[0]}, sans-serif;\n`;
        }
    }
    if (extend.fontSize) {
        for (const [k, v] of Object.entries(extend.fontSize)) {
            css += `  --text-${k}: ${v[0]};\n`;
            if (v[1]) {
                if (v[1].lineHeight) css += `  --text-${k}--line-height: ${v[1].lineHeight};\n`;
                if (v[1].fontWeight) css += `  --text-${k}--font-weight: ${v[1].fontWeight};\n`;
                if (v[1].letterSpacing) css += `  --text-${k}--letter-spacing: ${v[1].letterSpacing};\n`;
            }
        }
    }
    css += '}\n';
    fs.appendFileSync('src/app/globals.css', css);
    console.log("Success");
} else {
    console.log("No match");
}
