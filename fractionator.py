# fractionator.py -- the Infinial-Fractionator: heave in a run of serial signal, and it reports the repeats it noticed.
# (User1 named it, 31 x 2026: "heaving miles of simple serial signal into it, perhaps remains of some irrational
#  fraction, it would obligingly output the repeats it had noticed." Built upside down, after the White Knight.)
#
# Two bells. The big bell rings if the whole signal is one piece repeated (a period: 22/7 goes 142857 142857 ...).
# The small bell rings for every stretch that comes round again. An irrational number never rings the big bell,
# and never stops ringing the small one.
#
#   python fractionator.py "|!||||.||..|.|||"          a signal given on the line, mark by mark
#   python fractionator.py --file story.txt --words      a file, read word by word
#   python fractionator.py --sqrt 2 --digits 20000       the digits of a square root
#   python fractionator.py --fraction 22/7 --digits 60   the digits of a fraction
#   add --png plot.png for the picture: a recurrence plot, x and y both time, a mark wherever the two moments agree.
#   Repeats show as diagonal lines; a period shows as stripes all the way across.
import argparse, math, sys
from math import isqrt
from fractions import Fraction

sys.set_int_max_str_digits(0) if hasattr(sys, 'set_int_max_str_digits') else None


def sqrt_digits(n, digits):
    s = str(isqrt(n * 10 ** (2 * digits)))
    whole = len(str(isqrt(n)))
    return s[whole:whole + digits]


def fraction_digits(fr, digits):
    r, out = fr.numerator % fr.denominator, []
    for _ in range(digits):
        r *= 10
        out.append(str(r // fr.denominator))
        r %= fr.denominator
    return ''.join(out)


def period(seq):
    """the shortest p such that the whole signal is its first p marks repeated (the big bell), or None"""
    n = len(seq)
    for p in range(1, n // 2 + 1):
        if all(seq[i] == seq[i - p] for i in range(p, n)):
            return p
    return None


def repeats(seq, minlen, top):
    """the longest stretches that occur at least twice: (length, first position, next position), longest first.
    A suffix array over the signal; neighbours in sorted order share their longest common beginnings."""
    n = len(seq)
    key = (lambda i: seq[i:i + 256]) if isinstance(seq, str) else (lambda i: tuple(seq[i:i + 256]))
    sa = sorted(range(n), key=key)
    found = []
    for a, b in zip(sa, sa[1:]):
        k = 0
        while a + k < n and b + k < n and seq[a + k] == seq[b + k]:
            k += 1
        if k >= minlen:
            found.append((k, min(a, b), max(a, b)))
    found.sort(key=lambda t: (-t[0], t[1]))
    out, texts = [], []
    for k, a, b in found:                       # a stretch inside one already reported is only its echo: skip it
        piece = seq[a:a + k]
        if any(contains(t, piece) for t in texts):
            continue
        texts.append(piece)
        out.append((k, occurrences(seq, piece)))
        if len(out) >= top:
            break
    return out


def contains(big, small):
    if isinstance(big, str):
        return small in big
    m = len(small)
    return any(big[i:i + m] == small for i in range(len(big) - m + 1))


def occurrences(seq, piece):
    """every place the piece comes round, overlaps allowed"""
    m, out = len(piece), []
    if isinstance(seq, str):
        i = seq.find(piece)
        while i >= 0:
            out.append(i)
            i = seq.find(piece, i + 1)
        return out
    first = piece[0]
    return [i for i in range(len(seq) - m + 1) if seq[i] == first and seq[i:i + m] == piece]


def show(seq, a, k, words):
    s = seq[a:a + k]
    return ' '.join(s) if words else ''.join(s)


def plot_png(seq, path, size=900, window=3, crowd=60):
    """recurrence plot: x and y are both time; a pixel is lit where the stretch of `window` marks at x comes round
    again at y. Repeats draw diagonal lines, a period draws stripes. Stretches that come round more than `crowd`
    times (the commonest little words, the same digit pair) are left out, so the picture shows what is notable."""
    from PIL import Image
    n = len(seq)
    step = max(1, -(-n // size))                # one pixel per mark, or per `step` marks when the signal is long
    m = -(-n // step)
    where = {}
    for i in range(n - window + 1):
        where.setdefault(tuple(seq[i:i + window]), []).append(i)
    im = Image.new('RGB', (m, m), (11, 13, 16))
    px = im.load()
    for i in range(m):
        px[i, i] = (58, 63, 71)                 # the diagonal: every moment agrees with itself
    for at in where.values():
        if len(at) < 2 or len(at) > crowd:
            continue
        for a in at:
            for b in at:
                if a != b:
                    px[a // step, b // step] = (232, 179, 75)
    scale = max(1, size // m)
    im = im.resize((m * scale, m * scale), Image.NEAREST)
    im.save(path)
    return step


def main():
    ap = argparse.ArgumentParser(description='The Infinial-Fractionator: report the repeats in a run of signal.')
    ap.add_argument('signal', nargs='?', help='the signal itself, mark by mark')
    ap.add_argument('--file', help='read the signal from a file')
    ap.add_argument('--words', action='store_true', help='read words, not characters')
    ap.add_argument('--sqrt', type=int, help='use the digits of the square root of this number')
    ap.add_argument('--fraction', help='use the digits of a fraction, e.g. 22/7')
    ap.add_argument('--digits', type=int, default=10000, help='how many digits (default 10000)')
    ap.add_argument('--min', type=int, default=0, help='shortest repeat worth a bell (default: chosen by length)')
    ap.add_argument('--top', type=int, default=12, help='how many repeats to report (default 12)')
    ap.add_argument('--png', help='also draw the recurrence plot to this file')
    ap.add_argument('--window', type=int, default=0, help='plot: how many marks must agree (default: chosen)')
    o = ap.parse_args()

    if o.sqrt is not None:
        seq, name = sqrt_digits(o.sqrt, o.digits), 'the first %d digits of the square root of %d' % (o.digits, o.sqrt)
    elif o.fraction:
        fr = Fraction(o.fraction)
        seq, name = fraction_digits(fr, o.digits), 'the first %d digits of %s' % (o.digits, o.fraction)
    elif o.file:
        text = open(o.file, encoding='utf-8', errors='replace').read()
        seq, name = (text.split() if o.words else text), o.file
    elif o.signal is not None:
        seq, name = (o.signal.split() if o.words else o.signal), 'the signal given'
    else:
        ap.error('give a signal, --file, --sqrt or --fraction')
    unit = 'words' if o.words else 'marks'
    n = len(seq)
    if n < 2:
        print('Too short to repeat anything.')
        return
    minlen = o.min or (3 if o.words else max(2, round(2 * math.log10(n)) - 2))

    print('The Infinial-Fractionator, reading %s: %d %s, %d different.' % (name, n, unit, len(set(seq))))
    p = period(seq)
    if p:
        print('BIG BELL: the whole signal is its first %d %s, over and over: %s' % (p, unit, show(seq, 0, p, o.words)))
    else:
        print('No big bell: the signal never settles into a period.')
    reps = repeats(seq, minlen, o.top)
    if not reps:
        print('No small bells: nothing of %d %s or more comes round again.' % (minlen, unit))
    else:
        print('Small bells (%d %s or more that come round again), longest first:' % (minlen, unit))
        for k, at in reps:
            where = ', '.join(str(i + 1) for i in at[:6]) + (', ...' if len(at) > 6 else '')
            gaps = sorted(set(b - a for a, b in zip(at, at[1:])))
            print('  %4d %s, %d times, at %s (%s apart):' % (k, unit, len(at), where, ', '.join(map(str, gaps[:4])) + (' ...' if len(gaps) > 4 else '')))
            print('        ' + show(seq, at[0], min(k, 60), o.words) + (' ...' if k > 60 else ''))
    if o.png:
        w = o.window or (3 if o.words else max(3, minlen - 1))
        step = plot_png(seq, o.png, window=w)
        print('Drawn: %s (each pixel %d %s; a mark where %d in a row agree).' % (o.png, step, unit, w))


if __name__ == '__main__':
    main()
