#!/usr/bin/env python3
"""Day 01 / 60 — edit build script.

Inputs (relative to this folder):
  src/video.mov    raw footage, 1280x720 30fps (audio track starts at +0.216s)
  images/1.jpg     group photo for the end card
  fonts/use/       Inter (SemiBold / Medium / Regular)
  models/rnn/sh.rnnn  RNNoise voice model (ffmpeg arnndn)

Output: out/day01_reel_1080x1920.mp4 (9:16, 1080x1920, 30fps, AAC 48k)
"""
import json, os, re, subprocess

FPS = 30
W, H = 1080, 1920
OUT = 'out'
os.makedirs(OUT, exist_ok=True)

def fr(t):  # snap to frame grid
    return round(t * FPS) / FPS

# ---------------------------------------------------------------- EDL
# (name, src_in, src_out, framing, crop_x, audio_src_in, audio_src_out)
# framing: 'wide' = 405x720 full-height 9:16 crop, 'punch' = 352x626 (1.15x),
# 'broll' = video from another source range laid over this segment's audio.
WIDE = (405, 720)
PUNCH = (352, 626)
EDL = [
    # dialogue A-roll / B-roll                                    video crop x
    dict(n='A1', a=(12.20, 15.20), v=(12.20, 15.20), f=WIDE,  x=416),  # Hello everyone, today is day one of my 60 days challenge.
    dict(n='B1', a=(16.55, 18.35), v=(0.20, 2.00),   f=WIDE,  x=600),  # (typing B-roll) In the next 60 days I will try
    dict(n='A2', a=(18.35, 19.98), v=(18.35, 19.98), f=WIDE,  x=432),  # to make $1000
    dict(n='A3', a=(20.47, 21.65), v=(20.47, 21.65), f=PUNCH, x=459),  # by the end of this year.
    dict(n='A4', a=(28.78, 31.55), v=(28.78, 31.55), f=WIDE,  x=438),  # For now, only you four are seeing this video.
    dict(n='A5', a=(34.07, 37.80), v=(34.07, 37.80), f=PUNCH, x=499),  # On January 1st I will make this channel public.
    dict(n='A6', a=(39.52, 41.25), v=(39.52, 41.25), f=WIDE,  x=499),  # That was my idea.
    dict(n='A7', a=(45.85, 47.92), v=(45.85, 47.92), f=PUNCH, x=502),  # Stay tuned for tomorrow's video.
    dict(n='A8', a=(49.25, 51.33), v=(49.25, 51.33), f=WIDE,  x=498),  # See you. Bye.  (wave -> palm covers lens)
]
for s in EDL:
    s['a'] = tuple(fr(t) for t in s['a']); s['v'] = tuple(fr(t) for t in s['v'])
    assert abs((s['a'][1]-s['a'][0]) - (s['v'][1]-s['v'][0])) < 1e-6, s['n']

# output timeline
t = 0.0
for s in EDL:
    s['o'] = t; t += s['a'][1] - s['a'][0]
T_MAIN = t
XF = 0.35                       # crossfade from palm-over-lens into end card
END_LEN = 5.0
T_END = T_MAIN - XF             # end card start on output timeline
TOTAL = T_END + END_LEN

def to_out(src_t):
    """map a source (media) time inside a dialogue segment to output time"""
    for s in EDL:
        a0, a1 = s['a']
        if a0 - 0.06 <= src_t <= a1 + 0.06:          # tolerate frame snapping
            return s['o'] + (min(max(src_t, a0), a1) - a0)
    raise ValueError(src_t)

# ------------------------------------------------------------ captions
# (src_start, src_end, text)  {h}word{/h} = highlighted
CAPS = [
    (12.28, 12.60, 'Hello everyone,'),
    (12.60, 13.50, 'today is {h}Day 1{/h}'),
    (13.50, 15.20, 'of my {h}60-day challenge.{/h}'),
    (16.62, 17.58, 'In the next 60 days'),
    (17.58, 18.58, 'I will try to make'),
    (18.58, 19.98, '{h}$1,000{/h}'),
    (20.50, 21.65, 'by the end of this year.'),
    (28.88, 29.62, 'For now,'),
    (29.62, 30.36, 'only {h}you four{/h}'),
    (30.36, 31.55, 'are seeing this video.'),
    (34.15, 35.20, 'On {h}January 1st,{/h}'),
    (35.20, 36.45, 'I will make this channel'),
    (36.88, 37.80, '{h}public.{/h}'),
    (39.60, 41.25, 'That was my idea.'),
    (45.93, 46.48, 'Stay tuned for'),
    (46.48, 47.92, "{h}tomorrow's{/h} video."),
    (49.36, 50.40, 'See you. Bye.'),
]
ACCENT = '&H7AD2FF&'   # #FFD27A soft gold (ASS is BGR)

def ass_time(x):
    x = max(0, x); h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def styled(txt, shadow=False):
    if shadow:
        return txt.replace('{h}', '').replace('{/h}', '')
    return txt.replace('{h}', '{\\c' + ACCENT + '}').replace('{/h}', '{\\c&HFFFFFF&}')

ass = [
    '[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}',
    'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    # captions: Inter SemiBold, no stroke; a blurred dark copy underneath gives a soft shadow
    'Style: Cap,Inter SemiBold,66,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-0.5,0,1,0,0,2,110,110,500,1',
    'Style: CapSh,Inter SemiBold,66,&H78000000,&H78000000,&H00000000,&H00000000,0,0,0,0,100,100,-0.5,0,1,0,0,2,110,110,496,1',
    'Style: Label,Inter Medium,34,&H00B4B4B4,&H00B4B4B4,&H00000000,&H00000000,0,0,0,0,100,100,7,0,1,0,0,8,80,80,0,1',
    'Style: Title,Inter SemiBold,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-0.5,0,1,0,0,8,80,80,0,1',
    'Style: Sub,Inter,40,&H00A8A8A8,&H00A8A8A8,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,80,80,0,1',
    '', '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
]
cap_rows = []
for s0, s1, txt in CAPS:
    o0, o1 = to_out(s0), to_out(s1)
    cap_rows.append((round(o0, 3), round(o1, 3), txt))
    ass.append(f'Dialogue: 0,{ass_time(o0)},{ass_time(o1)},CapSh,,0,0,0,,{{\\blur9\\fad(70,50)}}{styled(txt, True)}')
    ass.append(f'Dialogue: 1,{ass_time(o0)},{ass_time(o1)},Cap,,0,0,0,,{{\\fad(70,50)}}{styled(txt)}')

# end card text (photo occupies y 560..1280)
Tc = T_END
def ev(style, a, b, y, txt, fad=(250, 250)):
    ass.append(f'Dialogue: 0,{ass_time(Tc+a)},{ass_time(Tc+b)},{style},,0,0,0,,{{\\pos({W//2},{y})\\an8\\fad({fad[0]},{fad[1]})}}{txt}')
ev('Label', 0.45, END_LEN, 470, 'DAY 01 / 60', (300, 0))
ev('Title', 0.60, 2.55, 1350, 'Audience: 4')
ev('Sub',   0.95, 2.55, 1450, 'the other four in this photo')
ev('Title', 2.75, END_LEN, 1350, 'See you tomorrow.', (300, 0))
ev('Sub',   3.10, END_LEN, 1450, 'Day 02 of 60', (300, 0))
open(f'{OUT}/captions.ass', 'w').write('\n'.join(ass) + '\n')

# ---------------------------------------------------------------- audio
SR = 48000
def run(cmd):
    print('+', ' '.join(cmd)[:160], '...' if len(' '.join(cmd)) > 160 else '')
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-1500:]); raise SystemExit(1)

# 1) dialogue: cut + 12ms fades at every edit; A8 fades out before camera-handling noise
parts = []
for i, s in enumerate(EDL):
    a0, a1 = s['a']; d = a1 - a0
    fo_st, fo_d = (d - 0.012, 0.012)
    if s['n'] == 'A8':
        fo_st, fo_d = (50.30 - a0, 0.30)
    parts.append(f"[0:a]atrim={a0}:{a1},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={fo_st:.3f}:d={fo_d:.3f}[d{i}]")
fc = ';'.join(parts) + ';' + ''.join(f'[d{i}]' for i in range(len(EDL))) + f'concat=n={len(EDL)}:v=0:a=1,aresample={SR},pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1[d]'
run(['ffmpeg', '-v', 'error', '-y', '-i', 'src/video.mov', '-filter_complex', fc, '-map', '[d]', '-c:a', 'pcm_s24le', f'{OUT}/dlg_raw.wav'])

VOICE = ("highpass=f=75,arnndn=m=models/rnn/sh.rnnn:mix=0.85,"
         "equalizer=f=220:t=q:w=1.2:g=-2.0,equalizer=f=3400:t=q:w=1.0:g=2.0,equalizer=f=9000:t=h:w=0.7:g=1.0,"
         "acompressor=threshold=-30dB:ratio=3:attack=6:release=120:makeup=4")
# two-pass loudness normalisation of the dialogue to -16 LUFS
m = subprocess.run(['ffmpeg', '-hide_banner', '-i', f'{OUT}/dlg_raw.wav', '-af', VOICE + ',loudnorm=I=-14:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True).stderr
ln = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', m, re.S).group(0))
run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/dlg_raw.wav', '-af',
     VOICE + f",loudnorm=I=-14:TP=-2:LRA=7:linear=true:measured_I={ln['input_i']}:measured_TP={ln['input_tp']}:measured_LRA={ln['input_lra']}:measured_thresh={ln['input_thresh']}:offset={ln['target_offset']}",
     '-ar', str(SR), '-c:a', 'pcm_s24le', f'{OUT}/dlg.wav'])

# 2) no music (song removed at client request): dialogue only, padded under the end card
run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/dlg.wav', '-af',
     f"apad=whole_dur={TOTAL},atrim=0:{TOTAL},alimiter=limit=0.89:attack=3:release=60:level=false",
     '-ar', str(SR), '-c:a', 'pcm_s24le', f'{OUT}/mix.wav'])

# ---------------------------------------------------------------- video
GRADE = ("colorbalance=rm=-0.03:bm=0.04:rh=-0.01:bh=0.03:rs=-0.01:bs=0.01,"
         "curves=master='0/0.012 0.08/0.06 0.25/0.245 0.5/0.535 0.75/0.785 0.9/0.895 1/0.955',"
         "eq=saturation=0.97,vibrance=intensity=0.05")
vparts = []
for i, s in enumerate(EDL):
    v0, v1 = s['v']; cw, ch = s['f']
    vparts.append(f"[0:v]trim={v0}:{v1},setpts=PTS-STARTPTS,hqdn3d=1.5:1.5:3:3,crop={cw}:{ch}:{s['x']}:0,{GRADE},"
                  f"scale={W}:{H}:flags=lanczos,setsar=1,fps={FPS}[v{i}]")
n = len(EDL)
vf = ';'.join(vparts) + ';' + ''.join(f'[v{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0,cas=strength=0.45,format=yuv420p,settb=1/{FPS},fps={FPS}[main];'
# end card: dark canvas, graded group photo with a slow push-in
ZN = int(END_LEN * FPS)
vf += (f"[1:v]scale=4320:-1,zoompan=z='1+0.045*on/{ZN}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x720:fps={FPS},"
       f"{GRADE},eq=contrast=1.02,setsar=1[ph];"
       f"color=c=0x0B0B0C:s={W}x{H}:r={FPS}:d={END_LEN}[bg];"
       f"[bg][ph]overlay=0:560:shortest=1,fade=t=out:st={END_LEN-0.9}:d=0.9,format=yuv420p,setsar=1,settb=1/{FPS},fps={FPS}[end];"
       f"[main][end]xfade=transition=fade:duration={XF}:offset={T_MAIN-XF:.4f},"
       f"subtitles={OUT}/captions.ass:fontsdir=fonts/use[vout]")
run(['ffmpeg', '-v', 'error', '-y', '-i', 'src/video.mov', '-loop', '1', '-framerate', str(FPS), '-t', f'{END_LEN}', '-i', 'images/1.jpg',
     '-i', f'{OUT}/mix.wav', '-filter_complex', vf, '-map', '[vout]', '-map', '2:a',
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', str(FPS),
     '-c:a', 'aac', '-b:a', '320k', '-ar', str(SR), '-shortest', '-movflags', '+faststart',
     f'{OUT}/day01_reel_1080x1920.mp4'])

json.dump(dict(edl=EDL, captions=cap_rows, t_main=T_MAIN, t_end=T_END, total=TOTAL,
               music=None), open(f'{OUT}/edl.json', 'w'), indent=1)
print(f'main {T_MAIN:.2f}s  end card @ {T_END:.2f}s  total {TOTAL:.2f}s')

def srt_t(x):
    ms = int(round(x * 1000))
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
with open(f'{OUT}/captions.srt', 'w') as f:
    for i, (a, b, txt) in enumerate(cap_rows, 1):
        f.write(f"{i}\n{srt_t(a)} --> {srt_t(b)}\n{txt.replace('{h}', '').replace('{/h}', '')}\n\n")
