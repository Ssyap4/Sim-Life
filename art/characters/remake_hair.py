"""Volume-swept strands, with modes sculpted in the same topology."""

from math import cos, pi, sin

import numpy as np
from mathutils import Vector

from mesh import Mesh, bell, profile, ramp, rgb, solid, skin, steps
from remake_portrait import HEAD, WHITE, bake, bezier_path


def hair_atlas(sculpt, folder):
    w,h=1024,768
    u,v=np.meshgrid((np.arange(w)+.5)/w,(np.arange(h)+.5)/h)
    f=sculpt.woman
    shadow=np.array(rgb('655247' if f else '4a3b30'))
    amber=np.array(rgb('b99d7d' if f else '4e3f33'))
    shine=np.array(rgb('e0c49f' if f else '73604e'))
    broad=(.5+.5*np.sin(2*pi*(u*3.1+.034*np.sin(v*8)+.020*np.sin(u*45.))))**1.35
    fibril=.5+.5*np.sin(2*pi*(u*95.5+.052*np.sin(v*12+u*20)+.027*np.sin(v*22)))
    variable=((.18 if f else .32)*broad+.14*fibril+.025*np.sin(u*189+v*7)+.022*np.sin(u*417-v*4))
    root=np.clip((v-.12)/(.58 if f else .32),0,1)**.78
    color=shadow+(amber-shadow)*np.clip(.10+.78*root+.12*variable,0,1)[...,None]
    color+=(shine-shadow)*np.clip(variable*(.22+.44*root),0,1)[...,None]
    return bake(sculpt.character+'-hair',color,folder)


def style_point(p,t,mode,front):
    x,y,z=p
    tip=ramp(.44,1,t)
    mid=ramp(.08,.37,t)*(1-ramp(.69,.97,t))
    if mode=='DailyStyle':
        return Vector((x*(1+.035*mid),y+.019*tip,z+(.017*sin(6.2*t+x*61))*(.4*mid+tip)))
    if mode=='EveningStyle':
        tuck=tip*.72+mid*.40
        return Vector((x*(1-(.16 if front else .12)*tuck),y+.081*tip+(.019 if front else .008)*mid,
                        z-(.079 if front else .038)*tip+.012*sin(11.0*t)*mid))
    return Vector(p)


def lock(hair, sculpt, controls, width, thickness, channel, frames=33, sides=17, front=False, sky=False):
    raw=list(bezier_path(controls,frames))
    modes=('Basis','DailyStyle','EveningStyle') if sculpt.woman else ('Basis',)
    for mode in modes:
        points=[style_point(p,t,mode,front) for p,t in zip(raw,steps(frames))]
        rows=[]
        for i,t in enumerate(steps(frames)):
            p=points[i]
            tangent=(points[min(frames-1,i+1)]-points[max(0,i-1)]).normalized()
            orient=Vector((0,1,0)) if sky else Vector((0,0,1 if front else -1))
            across=tangent.cross(orient).normalized()
            outward=across.cross(tangent).normalized()
            if sculpt.woman:
                span=(.60+.40*sin(pi*t)**.55)*(1-ramp(.66,1.0,t)*.98)
            else:
                span=(.43+.57*sin(pi*t)**.50)*(1-ramp(.75,1,t)*.99)
            row=[]
            for u in steps(sides):
                angle=u*2*pi
                ribs=1+(.028 if sculpt.woman else .078)*cos(angle*5+.21*sin(t*5+channel))+(.012 if sculpt.woman else .037)*cos(angle*8-t*3)
                q=p+across*(width*sin(angle)*span*ribs)+outward*(thickness*cos(angle)*span*ribs)
                weight=skin('Head','Hair',ramp(.28,1.00,t)*.80) if sculpt.woman else HEAD
                uv=(u*.89+.11*(.5+.5*sin(channel*1.7)),.12+.85*t)
                row.append((sculpt.xyz(*q),WHITE,weight,uv))
            rows.append(row)
        if mode=='Basis':
            index=hair.grid(rows)
        else:
            hair.deformation(mode,index,[p for row in rows for p,*rest in row])


def scalp(hair, sculpt):
    f=sculpt.woman
    rows=[]
    for t in steps(24):
        row=[]
        for u in steps(70):
            a=(u-.5)*2*pi
            front=max(0,cos(a))
            cut=.155-.264*ramp(.55,1.38,abs(a+.15))+.013*sin(a)*front
            y=cut+(.176-cut)*t
            rx,rz,z0=profile(sculpt.sections,y)
            ceil=sin(pi*t*.91)**.60
            x=sin(a)*(rx+(.010 if f else .0018)+(.008 if f else .003)*ceil)
            y+=(.006+.019*t) if f else (.001+.016*t)
            z=z0+cos(a)*(rz+(.009+.012*ceil if f else .0019+.006*ceil))
            row.append((sculpt.xyz(x,y,z),WHITE,HEAD,(u,.16+.73*t)))
        rows.append(row)
    hair.grid(rows)


def alina_locks(hair, sculpt):
    # Broad overlapping front waves, each made from a closed volume with
    # longitudinal edges. The asymmetry is in the centerlines, not the color.
    primary=[
        ([(.024,.163,.036),(-.029,.173,.089),(-.082,.114,.137),(-.127,.053,.144),(-.154,-.026,.116),
          (-.133,-.118,.097),(-.153,-.213,.091),(-.158,-.300,.116),(-.119,-.366,.138),(-.075,-.374,.129)],.041,.027),
        ([(-.021,.167,-.004),(-.073,.150,.056),(-.123,.099,.077),(-.155,.029,.095),(-.168,-.064,.089),
          (-.152,-.147,.064),(-.181,-.239,.051),(-.174,-.339,.089),(-.112,-.396,.115)],.042,.022),
        ([(-.036,.161,-.025),(-.107,.126,.014),(-.143,.059,.053),(-.160,-.032,.062),(-.164,-.127,.041),
          (-.183,-.220,.023),(-.173,-.321,.050),(-.129,-.372,.083)],.044,.026),
        ([(.013,.155,.029),(.058,.148,.070),(.090,.097,.104),(.127,.030,.106),(.147,-.036,.095),
          (.139,-.113,.070),(.151,-.185,.073),(.159,-.248,.098),(.123,-.334,.123)],.035,.028),
        ([(.020,.171,.006),(.071,.152,.040),(.123,.102,.064),(.151,.015,.088),(.169,-.058,.074),
          (.157,-.133,.023),(.182,-.228,.028),(.162,-.337,.084),(.139,-.358,.106)],.045,.026),
        ([(.022,.173,-.035),(.095,.145,.003),(.150,.073,.034),(.166,.001,.052),(.177,-.101,.029),
          (.165,-.188,-.014),(.190,-.272,.017),(.166,-.345,.058)],.045,.031),
        ([(-.028,.168,.052),(-.068,.142,.104),(-.094,.084,.133),(-.141,.025,.141),(-.145,-.069,.131),
          (-.125,-.119,.118),(-.155,-.217,.124),(-.150,-.298,.141),(-.097,-.363,.151)],.018,.011),
        ([(.020,.158,.057),(.064,.126,.104),(.097,.063,.131),(.134,.006,.124),(.150,-.070,.103),
          (.143,-.127,.087),(.162,-.221,.108),(.132,-.300,.117)],.014,.011),
    ]
    for i,(curve,w,d) in enumerate(primary):
        lock(hair,sculpt,[(x*.98 if y<.03 else x,y*.91 if y<-.10 else y,z-.019 if y<.07 else z) for x,y,z in curve],w*1.10,d*.45,i,frames=42,sides=17 if i<6 else 12,front=True)
    # A continuous swept rear curtain, rather than a row of separate tubes.
    # Two thin surfaces join at the tips and side edges. Morphs share topology.
    frames,across=35,69
    sections=[(-.36,.145,.116,-.008),(-.28,.169,.145,-.009),(-.18,.167,.153,-.014),(-.08,.157,.157,-.012),(.02,.150,.151,-.012),(.10,.130,.135,-.015),(.16,.080,.087,-.029)]
    starts=[]
    for inner in (False,True):
        for mode in ('Basis','DailyStyle','EveningStyle'):
            rows=[]
            for t in steps(frames):
                row=[]
                for u in steps(across):
                    a=.82+(2*pi-1.64)*u
                    tip=ramp(.72,1,t)
                    y=.16-.50*t+tip*(.012*cos(a*8)+.014*abs(cos(a)))
                    rx,rz,mid=profile(sections,y)
                    wave=(.004*cos(a*9+5*t)+.002*cos(a*17-6*t))*sin(pi*t)**.5
                    inset=.012 if inner else 0
                    x=sin(a)*(rx+wave-inset)+.010*sin(7*t)*sin(a)*sin(pi*t)
                    z=mid+cos(a)*(rz+wave-inset)+.012*sin(8*t)*sin(pi*t)
                    q=style_point((x,y,z),t,mode,False)
                    row.append((sculpt.xyz(*q),WHITE,skin('Head','Hair',ramp(.28,1,t)*.80),(u,.12+.85*t)))
                rows.append(row)
            if mode=='Basis':
                start=hair.grid(rows,flip=not inner);starts.append(start)
            else:
                hair.deformation(mode,start,[p for row in rows for p,*rest in row])
    a,b=starts
    for j in range(across-1):
        i=(frames-1)*across+j;hair.faces.append((a+i,a+i+1,b+i+1,b+i))
    for r in range(frames-1):
        for j in (0,across-1):
            i=r*across+j;hair.faces.append((a+i,b+i,b+i+across,a+i+across))


def vlad_crown(sculpt, angle, progress):
    front=max(0,cos(angle))
    side=sin(angle)
    hairline=.100+.018*front+.010*sin(2*angle+.35)*front+.0015*sin(angle*19)
    y=hairline+(.176-hairline)*progress
    rx,rz,mid=profile(sculpt.sections,y)
    t=ramp(0,.30,progress)
    taper=sin(pi*progress)**.40
    thickness=.0014+(.0046+.0034*front)*taper*t
    ridges=.0012*cos(angle*48+progress*12+.65*sin(angle*3+progress*4))*t*taper
    x=side*(rx+thickness+ridges)-.015*taper*front*progress
    y+=.002+(.010+.050*front*(.70-.30*side))*taper*progress
    z=mid+cos(angle)*(rz+thickness+ridges)+.010*taper*front
    return x,y,z


def vlad_locks(hair, sculpt):
    # The silhouette is one close-fitting crown. Continuous furrows rise
    # from the blend at the temple, with small raised locks on the front.
    rows=[]
    for t in steps(41):
        row=[]
        for u in steps(112):
            angle=(u-.5)*2*pi
            color_uv=(u,.10+.82*t)
            row.append((sculpt.xyz(*vlad_crown(sculpt,angle,t)),WHITE,HEAD,color_uv))
        rows.append(row)
    hair.grid(rows)
    for i in range(12):
        beginning=-.80+i*.134
        co=[]
        for u in steps(7):
            theta=beginning-.34*u*u-.20*u
            x,y,z=vlad_crown(sculpt,theta,.12+.73*u)
            co.append((x,y+.0009+.0013*sin(pi*u),z+.0014*sin(pi*u)))
        lock(hair,sculpt,co,.0062,.0014,i,frames=24,sides=10,sky=True)


def build_hair(sculpt, folder):
    hair=Mesh('Sculpted hairstyle','Hair pigment',.58,hair_atlas(sculpt,folder))
    if sculpt.woman:
        scalp(hair,sculpt)
        alina_locks(hair,sculpt)
    else:
        vlad_locks(hair,sculpt)
    return hair
