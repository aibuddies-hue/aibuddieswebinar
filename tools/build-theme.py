# -*- coding: utf-8 -*-
"""
Builds theme-claude.css from style.css.

The stylesheet carries 70-odd blue values written out literally rather than
through a token, so redefining the tokens alone re-skins only part of the page.
This walks every rule, and wherever one of those literals appears it emits a
copy of that rule scoped to .theme-claude with the warm equivalent. Rules with
no blue in them are not copied, so the file stays small and the paid page is
untouched.

Re-run from the repo root after editing style.css:\n    python3 tools/build-theme.py
"""
import io, re, sys

SRC = "style.css"
OUT = "theme-claude.css"

# Longest first, so "rgba(0, 198, 255" is never half-matched.
MAP = [
    # brand blues -> clay
    ("rgba(127, 216, 255", "rgba(240, 180, 154"),
    ("rgba(0, 198, 255",   "rgba(224, 138, 98"),
    ("rgba(0, 168, 255",   "rgba(212, 117, 80"),
    ("rgba(0, 114, 255",   "rgba(200, 96, 63"),
    ("rgba(37, 99, 235",   "rgba(184, 88, 58"),
    ("#7fd8ff", "#f0b49a"),
    ("#00c6ff", "#e08a62"),
    ("#0072ff", "#c8603f"),
    # blue-tinted page grounds -> warm cream
    ("rgba(248, 250, 252", "rgba(250, 249, 245"),
    ("rgba(242, 244, 246", "rgba(243, 241, 234"),
    ("#f8fafc", "#faf9f5"),
    ("#f4f7fa", "#faf9f5"),
    ("#f2f4f6", "#f3f1ea"),
    ("#eaeef3", "#f3f1ea"),
    ("#e4e9f0", "#ede9df"),
    ("#e0e6ed", "#ece7dc"),
    # cool greys and inks -> warm ones
    ("rgba(15, 23, 42", "rgba(32, 30, 27"),
    ("#070d18", "#15120f"),
    ("#0b1220", "#1c1a17"),
    ("#131c2e", "#272420"),
    ("#334155", "#4a443b"),
    ("#33425a", "#4e473d"),
    ("#57657a", "#6b6459"),
    ("#8ea3bf", "#a89d8d"),
    ("#d3dced", "#e2dbcd"),
    ("#dbe5f2", "#e9e2d6"),
    ("rgba(9, 15, 26",  "rgba(24, 21, 18"),
    ("rgba(7, 13, 24",  "rgba(20, 18, 16"),
    ("#0f172a", "#201e1b"),
    ("#1e293b", "#2b2926"),
    ("#0a1a33", "#241f1a"),
    ("#4a5769", "#6b6459"),
    ("#b8c6da", "#cfc6b8"),
    ("#9fb2cc", "#bdb2a2"),
    ("#cbd7e8", "#ded5c8"),
    ("#cbd5e1", "#d8d1c6"),
    ("#94a3b8", "#a39a8c"),
    ("#64748b", "#6b6459"),
]

def remap(text):
    for old, new in MAP:
        text = re.sub(re.escape(old), new, text, flags=re.I)
    return text

def has_blue(text):
    low = text.lower()
    return any(old.lower() in low for old, _ in MAP)

def scope(selector):
    """
    Scope a selector to the theme WITHOUT changing its specificity.

    :where() counts as zero, so a copied rule keeps exactly the weight its
    original had and the cascade behaves as before — it simply comes later
    and so replaces its own original. Plain ".theme-claude " would add a
    class, letting an early rule outrank a later one that was meant to beat
    it; that is how the hero headline ended up unreadable.
    """
    parts = [p.strip() for p in selector.split(",") if p.strip()]
    out = []
    for p in parts:
        if ".theme-claude" in p:
            out.append(p)                       # already ours
        elif p in (":root", "html"):
            out.append("body:where(.theme-claude)")
        elif p == "body":
            out.append("body:where(.theme-claude)")
        elif p.startswith("body"):
            out.append("body:where(.theme-claude)" + p[4:])
        else:
            out.append(":where(.theme-claude) " + p)
    return ", ".join(out)

def split_rules(css):
    """Yield (at_rule_or_None, selector, body) for every rule, one level of nesting."""
    i, n = 0, len(css)
    while i < n:
        brace = css.find("{", i)
        if brace == -1:
            break
        head = css[i:brace].strip()
        # find the matching close brace
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{": depth += 1
            elif css[j] == "}": depth -= 1
            j += 1
        body = css[brace + 1:j - 1]
        head = re.sub(r"/\*.*?\*/", "", head, flags=re.S).strip()
        if head.startswith("@"):
            if head.startswith("@media") or head.startswith("@supports"):
                for _, sel, b in split_rules(body):
                    yield head, sel, b
            # @keyframes and @font-face are handled separately
        elif head:
            yield None, head, body
        i = j

def main():
    css = io.open(SRC, encoding="utf-8").read()

    # Our own hand-written theme block must not be re-scoped.
    marker = "/* --------------------------------------------------\n * Claude theme"
    cut = css.find(marker)
    source = css[:cut] if cut != -1 else css

    chunks, count = [], 0
    current_at = None
    for at, sel, body in split_rules(source):
        if not has_blue(body):
            continue
        rule = "%s {%s}" % (scope(sel), remap(body))
        if at != current_at:
            if current_at:
                chunks.append("}\n")
            if at:
                chunks.append("\n%s {\n" % at)
            current_at = at
        chunks.append(("  " if at else "") + rule + "\n")
        count += 1
    if current_at:
        chunks.append("}\n")

    # One keyframe animates a blue glow; it needs its own warm copy.
    kf = re.search(r"@keyframes\s+pulseGlow\s*\{", css)
    extra = ""
    if kf:
        i, depth = kf.end(), 1
        while depth and i < len(css):
            if css[i] == "{": depth += 1
            elif css[i] == "}": depth -= 1
            i += 1
        block = css[kf.start():i]
        extra = ("\n/* The glow keyframe names its colours inline, so the theme\n"
                 "   gets its own copy and the elements using it are re-pointed. */\n"
                 + remap(block).replace("pulseGlow", "pulseGlowClaude", 1)
                 + "\n.theme-claude .pulse-glow { animation-name: pulseGlowClaude; }\n")

    header = ("/* GENERATED by buildtheme.py from style.css — do not edit by hand.\n"
              " *\n"
              " * Only the rules that wrote a blue out literally instead of using a\n"
              " * token are copied here, with the warm equivalent and scoped to\n"
              " * .theme-claude. Re-run the script after changing style.css.\n"
              " */\n")

    io.open(OUT, "w", encoding="utf-8").write(header + "".join(chunks) + extra)
    print("rules copied:", count)

main()
