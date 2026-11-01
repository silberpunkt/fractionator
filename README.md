# The Infinial-Fractionator

Heave in a run of serial signal, and it reports the repeats it noticed. Named by User1, after the White Knight, who would have built it upside down.

**[Try it in your browser →](https://silberpunkt.github.io/fractionator/)** Everything runs in the page; nothing is sent anywhere.

```
  22/7 = 3.142857 142857 142857 142857 142857 142857 …
           └─┬──┘ └─┬──┘ └─┬──┘
             the same six, forever
  BIG BELL: the whole signal is one piece, over and over. A period.
  In the picture: stripes, all the way across.
```

**Two bells.** The big bell rings if the whole signal is one piece repeated: a period. The small bell rings for every stretch that comes round again. A rational number rings the big bell almost at once; an irrational one never does, and never stops ringing the small one.

```
python fractionator.py --fraction 22/7 --digits 300 --png frac.png
python fractionator.py --sqrt 2 --digits 20000 --png sqrt2.png
python fractionator.py "|!||||.||..|.|||||||.|.|.....|.|.|.||.|||.||.||" --min 4
python fractionator.py --file story.txt --words --png story.png
```

Each small bell gives the stretch, how long it is, every place it comes round, and how far apart.

**The picture** (`--png`) is a recurrence plot. Across and down are both time; a mark is lit where the stretch at one moment comes round again at another. A repeat draws a diagonal line; a period draws stripes all the way across. The commonest little stretches (the words everyone uses, the digit pairs that turn up everywhere) are left out, so what shows is what is notable.

- `frac.png`: 22/7, all stripes. One piece, 142857, forever.
- `sqrt2.png`: the square root of 2, dust. Small recurrences everywhere, no period anywhere.
- `wringing.png`: User1's conversation with Ask Brave, read word by word. The marks gather near the end, where the summing-up repeats what was found earlier.

The command-line machine is plain Python 3 (the picture needs Pillow); the page is the same machine in one HTML file. MIT licence; see [LICENSE](LICENSE).
