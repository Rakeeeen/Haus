"""Firmus's hand-drawn illustrations, in the spirit of Anthropic's: an ink line about 23/1000
thick with a hand's tremor, over a flat paper shape set a little off it. A hand only where a
person is part of the act. Run build.py after changing anything here."""
import math
from draw import Pen

def row(origin,ang,lengths,w,valley=.42,fan=0.0,spread=1.0):
    """One continuous stroke over a row of fingers. Returns spline control points."""
    pts=[]; perp=ang+math.pi/2
    for i,l in enumerate(lengths):
        a=ang+fan*(i-(len(lengths)-1)/2)
        bx=origin[0]+math.cos(perp)*i*w*spread; by=origin[1]+math.sin(perp)*i*w*spread
        ca,sa=math.cos(a),math.sin(a); nx,ny=-sa,ca; h=w*.5*.92
        P=lambda u,v:(bx+ca*u+nx*v,by+sa*u+ny*v)
        if i==0: pts.append(P(l*valley*.6,-h))
        pts+= [P(l*.72,-h*1.02),P(l-h*.45,-h*.72),P(l,0),P(l-h*.45,h*.72),P(l*.72,h*1.02)]
        pts.append(P(l*valley,h*1.03))
    return pts
def disc(c,r,n=10,sq=1):
    return [(c[0]+r*math.cos(i/n*6.283),c[1]+r*sq*math.sin(i/n*6.283)) for i in range(n)]
def water():
    p=Pen(11,w=23)
    p.blob([(330,300),(760,262),(720,930),(372,948)],rough=10,corner=.08)
    p.line([(262,212),(400,218),(560,208),(708,214)])
    p.line([(276,214),(304,470),(330,720),(358,902)])
    p.line([(696,216),(678,470),(652,720),(622,898)])
    p.line([(356,902),(490,912),(624,898)])
    p.line([(300,420),(380,396),(470,428),(560,398),(684,420)],w=20)
    # the drop, about to land
    p.blob([(500,18),(574,120),(560,184),(500,204),(440,180),(432,120)],rough=3,corner=.3)
    p.line([(488,10),(424,94),(420,146),(460,180),(516,180),(548,136),(530,76),(488,10)],w=22)
    p.line([(446,136),(468,158)],w=18)
    return p
def focus():
    p=Pen(23)
    p.blob(disc((558,392),262,14),rough=8,corner=.32)
    p.circle((510,360),232,228)
    p.line([(484,98),(488,132),(536,130),(540,96)])
    p.line([(452,92),(512,84),(574,92)],w=30)
    p.line([(678,172),(726,124)],w=30)
    for a in range(0,360,30):
        t=math.radians(a); r1,r2=(190,206) if a%90 else (168,206)
        p.line([(510+r1*math.sin(t),360-r1*math.cos(t)),(510+r2*math.sin(t),360-r2*math.cos(t))],w=18)
    p.line([(510,366),(513,240),(512,196)],w=22)
    p.line([(508,362),(598,420)],w=26)
    p.circle((510,362),14,w=18)
    h=row((310,850),-math.pi/2,[186,226,232,190],84,valley=.25,fan=.05)
    p.line([(254,990),(262,900)]+h+[(668,902),(700,990)])
    p.line([(668,812),(748,744),(812,640),(800,566),(764,566),(712,650)])
    return p
def finance():
    p=Pen(37)
    p.blob(disc((540,270),168,14),rough=7,corner=.32)
    p.blob([(250,590),(840,568),(868,950),(276,966)],rough=10,corner=.08)
    p.circle((500,232),160,164)
    p.circle((500,232),102,106,w=18)
    # falling marks
    p.line([(250,110),(254,190)],w=20); p.line([(170,170),(172,214)],w=20); p.line([(748,120),(746,196)],w=20)
    for x,y,w_ in [(180,812,590),(226,700,560),(168,588,590)]:
        p.line([(x+34,y),(x+w_/2,y-6),(x+w_-30,y+2),(x+w_,y+50),(x+w_-30,y+98),(x+w_/2,y+104),(x+34,y+96),(x,y+50)],closed=True)
    for x in (300,400,500,600): p.line([(x,620),(x+2,660)],w=18)
    return p

ILLUSTRATIONS = {'water': water, 'focus': focus, 'finance': finance}


# ── Small icons ──────────────────────────────────────────────────────────────────────
# The same hand at icon size (20 and 36 px): a thick line, no hands, no small detail. Each
# returns its still parts per seed, so the build can make a few slightly different redraws
# for the line boil, and the parts that move are drawn on their own, at rest.
ICON_W = 74

def water_icon(seed):
    p = Pen(seed, w=ICON_W, wob=1.6)
    p.line([(210, 90), (500, 84), (790, 92)])
    p.line([(226, 96), (270, 500), (320, 900)])
    p.line([(774, 100), (730, 500), (680, 896)])
    p.line([(318, 902), (500, 912), (684, 900)])
    return p

# The glass's inside: the water fills this, set a little off the glass like the paper shapes.
WATER_INSIDE = [(262, 136), (740, 140), (664, 866), (338, 866)]

def focus_icon(seed):
    p = Pen(seed, w=ICON_W, wob=1.6)
    p.blob(disc((560, 590), 350, 12), rough=12, corner=.32)
    p.circle((480, 540), 340, 336)
    p.line([(400, 96), (480, 84), (566, 96)])
    p.circle((480, 540), 36, w=50)
    return p

def focus_hand(seed=3):
    p = Pen(seed, w=66, wob=1.2)
    p.line([(480, 540), (482, 420), (480, 300)])
    return p

def finance_icon(seed):
    p = Pen(seed, w=ICON_W, wob=1.6)
    for x, y, w_ in [(120, 800, 720), (170, 640, 680)]:
        p.line([(x+50, y), (x+w_/2, y-8), (x+w_-46, y+4), (x+w_, y+62), (x+w_-46, y+120), (x+w_/2, y+126), (x+50, y+118), (x, y+62)], closed=True)
    return p

def finance_coin(seed):
    p = Pen(seed, w=ICON_W, wob=1.6)
    p.blob(disc((560, 330), 250, 12), rough=11, corner=.32)
    p.circle((500, 290), 220, 224)
    return p

def time_icon(seed):
    p = Pen(seed, w=ICON_W, wob=1.6)
    p.blob(disc((560, 560), 400, 12), rough=12, corner=.32)
    p.circle((500, 500), 400, 396)
    for a in range(0, 360, 90):
        t = math.radians(a)
        p.line([(500 + 300 * math.sin(t), 500 - 300 * math.cos(t)), (500 + 352 * math.sin(t), 500 - 352 * math.cos(t))], w=56)
    p.circle((500, 500), 30, w=46)
    return p

def time_hour(seed=5):
    p = Pen(seed, w=70, wob=1.2)
    p.line([(500, 500), (502, 380), (500, 290)])
    return p

def time_minute(seed=6):
    p = Pen(seed, w=56, wob=1.2)
    p.line([(500, 500), (498, 330), (500, 180)])
    return p

ICONS = {
    'water': {'still': water_icon, 'parts': {}},
    'focus': {'still': focus_icon, 'parts': {'hand': focus_hand}},
    'finance': {'still': finance_icon, 'parts': {'coin': finance_coin}},
    'time': {'still': time_icon, 'parts': {'hour': time_hour, 'minute': time_minute}},
}
BOIL_SEEDS = (5, 9, 13)
