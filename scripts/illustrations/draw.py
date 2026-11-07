"""The pen behind scripts/illustrations: Catmull-Rom centrelines turned into filled, slightly
uneven ink outlines, and rough paper shapes. Coordinates are on a 1000x1000 canvas."""
import math,random,json,sys
def cr(pts,closed=False,step=6):
    P=list(pts); n=len(P); out=[]
    idx=range(n) if closed else range(n-1)
    for i in idx:
        p0=P[(i-1)%n] if (closed or i>0) else P[i]
        p1=P[i]; p2=P[(i+1)%n]
        p3=P[(i+2)%n] if (closed or i+2<n) else p2
        d=math.dist(p1,p2); m=max(2,int(d/step))
        for j in range(m):
            t=j/m;t2=t*t;t3=t2*t
            f=lambda a,b,c,e:.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-e)*t2+(-a+3*b-3*c+e)*t3)
            out.append((f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])))
    if not closed: out.append(P[-1])
    return out
class N:
    """smooth 1d noise"""
    def __init__(s,r,scale):
        s.v=[r.uniform(-1,1) for _ in range(4096)]; s.sc=scale
    def __call__(s,x):
        x=x/s.sc; i=int(math.floor(x)); f=x-i; f=f*f*(3-2*f)
        return s.v[i%4096]*(1-f)+s.v[(i+1)%4096]*f
# How far, in canvas units, a simplified outline may stray. 0.45 is invisible at full size;
# icons a few dozen pixels across can take much more.
EPS = 0.45
def rdp(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; dx,dy=b[0]-a[0],b[1]-a[1]; m=math.hypot(dx,dy) or 1
    best,bi=0,0
    for i in range(1,len(pts)-1):
        d=abs((pts[i][0]-a[0])*dy-(pts[i][1]-a[1])*dx)/m
        if d>best: best,bi=d,i
    if best<=eps: return [a,b]
    return rdp(pts[:bi+1],eps)[:-1]+rdp(pts[bi:],eps)
def path_from(poly):
    # smooth closed polygon -> cubic path; simplified, so curves stay clean and the file stays small
    h=len(poly)//2
    pts=rdp(poly[:h+1],EPS)[:-1]+rdp(poly[h:]+[poly[0]],EPS)[:-1]
    n=len(pts); d=f'M{pts[0][0]:.0f} {pts[0][1]:.0f}'
    for i in range(n):
        p0,p1,p2,p3=pts[i-1],pts[i],pts[(i+1)%n],pts[(i+2)%n]
        c1=(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6)
        d+=f'C{c1[0]:.0f} {c1[1]:.0f} {c2[0]:.0f} {c2[1]:.0f} {p2[0]:.0f} {p2[1]:.0f}'
    return d+'Z'
class Pen:
    def __init__(s,seed=1,w=23,wob=1.0):
        s.r=random.Random(seed); s.w=w; s.wob=wob; s.ink=[]; s.paper=[]
    def line(s,pts,closed=False,w=None,raw=False,taper=.72):
        w=w or s.w; r=s.r
        c=pts if raw else cr(pts,closed)
        wn=N(r,170); en=N(r,60); ln=N(r,230); en2=N(r,60)
        # hand tremor on the centreline
        L=0; q=[]; prev=c[0]
        for p in c:
            L+=math.dist(p,prev); prev=p; q.append((p,L))
        tot=max(L,1)
        def nrm(i):
            a=c[max(0,i-2)]; b=c[min(len(c)-1,i+2)]
            dx,dy=b[0]-a[0],b[1]-a[1]; m=math.hypot(dx,dy) or 1
            return -dy/m,dx/m
        Lf=[];Rt=[]
        for i,(p,l) in enumerate(q):
            nx,ny=nrm(i); u=l/tot
            trem=ln(l)*2.6*s.wob
            cx,cy=p[0]+nx*trem,p[1]+ny*trem
            ends=1 if closed else min(1,taper+(1-taper)*min(l,tot-l)/60)
            hw=w/2*ends*(1+.15*wn(l))
            Lf.append((cx+nx*(hw+en(l)*.45*s.wob),cy+ny*(hw+en(l)*.45*s.wob)))
            Rt.append((cx-nx*(hw+en2(l)*.45*s.wob),cy-ny*(hw+en2(l)*.45*s.wob)))
        if closed:
            s.ink.append(path_from(Lf)+path_from(Rt[::-1])); return
        # a stroke that turns tighter than its own width: round it with a dab at each point
        # instead of letting the inner edge fold over and bite a nick out of the line.
        def cap(a,b):
            mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2; rad=math.dist(a,b)/2
            a0=math.atan2(a[1]-my,a[0]-mx); out=[]
            for k in range(1,7):
                t=a0-math.pi*k/7
                out.append((mx+math.cos(t)*rad,my+math.sin(t)*rad))
            return out
        poly=Lf+cap(Lf[-1],Rt[-1])+Rt[::-1]+cap(Rt[0],Lf[0])
        s.ink.append(path_from(poly))
        for i in range(2,len(c)-2,2):
            a,b,d=c[i-2],c[i],c[i+2]
            t=math.atan2(d[1]-b[1],d[0]-b[0])-math.atan2(b[1]-a[1],b[0]-a[0])
            t=abs((t+math.pi)%(2*math.pi)-math.pi)
            if t>.32:
                hw=math.dist(Lf[i],Rt[i])/2
                s.ink.append(path_from([(c[i][0]+hw*math.cos(k/10*6.283),c[i][1]+hw*math.sin(k/10*6.283)) for k in range(10)]))
    def blob(s,pts,rough=7,corner=.12):
        r=s.r; n=len(pts); out=[]
        # rounded-off corners then long-wave wobble
        for i in range(n):
            a=pts[i-1];b=pts[i];c=pts[(i+1)%n]
            for t,(u,v) in ((corner,(b,a)),(corner,(b,c))):
                pass
            s1=(b[0]+(a[0]-b[0])*corner,b[1]+(a[1]-b[1])*corner)
            s2=(b[0]+(c[0]-b[0])*corner,b[1]+(c[1]-b[1])*corner)
            out+= [s1,((s1[0]+2*b[0]+s2[0])/4,(s1[1]+2*b[1]+s2[1])/4),s2]
        dense=[]
        for i in range(len(out)):
            a=out[i];b=out[(i+1)%len(out)]
            m=max(1,int(math.dist(a,b)/14))
            dense+=[(a[0]+(b[0]-a[0])*j/m,a[1]+(b[1]-a[1])*j/m) for j in range(m)]
        nz=N(r,70); nz2=N(r,70); res=[]
        l=0
        for p in dense:
            l+=14; res.append((p[0]+nz(l)*rough,p[1]+nz2(l)*rough))
        s.paper.append(path_from(res))
    def circle(s,c,rx,ry=None,**k):
        ry=ry or rx
        s.line([(c[0]+rx*math.cos(a/14*2*math.pi),c[1]+ry*math.sin(a/14*2*math.pi)) for a in range(14)],closed=True,**k)
    def finger(s,base,ang,length,width,bend=0,**k):
        """an open U: out one side, round the tip, back the other."""
        ca,sa=math.cos(ang),math.sin(ang); nx,ny=-sa,ca
        h=width/2; b=bend
        def P(u,v): return (base[0]+ca*u+nx*v,base[1]+sa*u+ny*v)
        pts=[P(0,-h),P(length*.55,-h+b*.4),P(length-h*.7,-h*.9+b),P(length,b),P(length-h*.7,h*.9+b),P(length*.55,h+b*.4),P(0,h)]
        s.line(pts,**k)
    def layer(s):
        s.done=getattr(s,'done',[])+[(s.paper,s.ink)]; s.paper=[]; s.ink=[]
    def body(s,ink,paper):
        out=''
        for pa,ik in getattr(s,'done',[])+[(s.paper,s.ink)]:
            out+=f'<g fill="{paper}">'+''.join(f'<path d="{d}"/>' for d in pa)+f'</g><g fill="{ink}" >'+''.join(f'<path d="{d}"/>' for d in ik)+'</g>'
        return out
    def svg(s,ink='#141413',paper='#FAF9F5'):
        return f'<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">'+s.body(ink,paper)+'</svg>'
