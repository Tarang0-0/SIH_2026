import re

with open("src/app/page.tsx", "r") as f:
    content = f.read()

# Replace initial state of heroData
content = re.sub(
    r'const \[heroData, setHeroData\] = useState\(\{(.*?)\}\);',
    r'const [heroData, setHeroData] = useState<any>(null);',
    content,
    flags=re.DOTALL
)

# Handle null heroData in JSX
content = re.sub(
    r'\{heroData\.([a-zA-Z0-9_]+)\}',
    r'{heroData ? heroData.\1 : "Loading..."}',
    content
)
# Special case for progress_pct style
content = re.sub(
    r'style=\{\{ width: `\$\{heroData \? heroData.progress_pct : "Loading\.\.\."\}%` \}\}',
    r'style={{ width: `${heroData?.progress_pct || 0}%` }}',
    content
)


with open("src/app/page.tsx", "w") as f:
    f.write(content)

print("Fixed hardcoded data.")
