"""Sculpted 0.45 resident faces. Coordinates below are in the game's Y-up bind pose."""

from math import asin, atan2, cos, exp, pi, sin, sqrt

import bpy
import numpy as np
from mathutils import Vector

from mesh import Mesh, bell, blend, profile, ramp, rgb, solid, spline, steps

HEAD = solid('Head')
WHITE = (1, 1, 1)
BOTTOM, TOP = -.173, .177

# Center of each vertical section, two radii and jaw silhouette are authored
# separately for the two portraits. Lower jaw, orbital and temporal anatomy
# is then sculpted into those continuous sections.
ALINA = [
    (BOTTOM,.007,.018,.032),(-.162,.042,.048,.035),(-.145,.063,.072,.021),
    (-.130,.082,.084,.014),(-.101,.098,.101,.009),(-.068,.118,.115,.001),
    (-.037,.132,.129,-.008),(-.003,.132,.133,-.009),(.035,.132,.137,-.011),
    (.075,.126,.138,-.014),(.111,.116,.128,-.019),(.139,.094,.108,-.025),
    (.160,.067,.078,-.030),(.173,.034,.042,-.035),(TOP,.002,.005,-.037),
]
VLAD = [
    (BOTTOM,.011,.019,.036),(-.162,.050,.056,.038),(-.145,.077,.077,.020),
    (-.125,.088,.094,.005),(-.096,.103,.108,-.001),(-.062,.115,.119,-.009),
    (-.030,.126,.130,-.015),(.006,.125,.131,-.014),(.040,.127,.131,-.015),
    (.075,.124,.132,-.015),(.109,.116,.125,-.020),(.138,.098,.106,-.027),
    (.160,.072,.081,-.031),(.173,.032,.045,-.035),(TOP,.002,.006,-.036),
]


def rgbmix(color, keep, factor):
    return blend(color, keep, max(0, min(1, factor)))


def bake(name, pixels, directory):
    h, w = pixels.shape[:2]
    image = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3] = np.clip(pixels,0,1)
    image.pixels.foreach_set(rgba.ravel())
    image.update()
    image.file_format = 'PNG'
    image.filepath_raw = str(directory / (name+'.png'))
    image.save()
    image.pack()
    return image


def bezier_path(controls, count):
    """Catmull-Rom interpolation with duplicated end conditions for swept locks."""
    values = [Vector(p) for p in controls]
    for t in steps(count):
        f = t*(len(values)-1)
        i = min(int(f),len(values)-2)
        u = f-i
        a,b,c,d = [values[j] for j in (max(0,i-1),i,i+1,min(i+2,len(values)-1))]
        yield (2*b+(c-a)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)*.5


class Sculpt:
    def __init__(self, character, height, eye_x):
        self.character=character
        self.woman=character=='alina'
        self.height=height
        self.eye_x=eye_x
        self.sections=ALINA if self.woman else VLAD
        self.base=rgb('e6a685' if self.woman else 'd7997a')
        self.eye_width=.038 if self.woman else .033
        self.eye_radius=.0398 if self.woman else .0360
        self.eye_center=.094 if self.woman else .091
        self.mouth=-.103 if self.woman else -.110
        self.mouth_width=.042 if self.woman else .047

    def xyz(self,x,y,z):
        return x,y+self.height,z

    def lip(self,x):
        q=np.clip(x/self.mouth_width,-1,1)
        shape=np.maximum(0,1-q*q)**.73
        arch=(.010 if self.woman else .0048)*q*q+.0013*q
        top=(.0086 if self.woman else .0063)+.0030*np.exp(-((abs(q)-.27)/.15)**2)
        bottom=.0162 if self.woman else .010
        return self.mouth+arch, shape, top, bottom

    def relief(self,x,y):
        f=self.woman
        side=abs(x)
        cheek=(.017 if f else .015)*bell((side-.086)/.044)*bell((y+.043)/.033)
        under=(-.008 if f else -.015)*bell((side-.090)/.031)*bell((y+.092)/.031)
        chin=.018*bell(x/.052)*bell((y+.141)/.026)
        y0=-.050 if f else -.059
        bridge=(.027 if f else .044)*bell(x/(.017 if f else .023))*bell((y+.022)/.050)
        tip=(.033 if f else .030)*bell(x/(.018 if f else .019))*bell((y-y0)/.015)
        alae=(.015 if f else .021)*bell((side-(.016 if f else .019))/.009)*bell((y-y0+.008)/.011)
        nostril=-.010*bell((side-.016)/.005)*bell((y-y0+.012)/.005)
        cranial=(.009 if f else .017)*bell((side-.058)/.052)*bell((y-.036)/.024)
        socket=-.016*bell((side-self.eye_x)/.039)*bell((y-.004)/.021)
        cushion=.015*bell((side-self.eye_x)/.031)*bell((y+.026)/.019)
        philtrum=-.0032*bell(x/.0058)*bell((y+.083)/.016)
        muzzle=.018*bell(x/.057)*bell((y-self.mouth)/.032)
        line,span,upper,lower=self.lip(x)
        dy=y-line
        scale=max(.0002,span*(upper if dy>=0 else lower))
        lip=span*((.008 if f else .005)*bell((dy/scale-.48)*1.55)
             +(.011 if f else .007)*bell((dy/scale+.43)*1.52)-.0034*bell(dy/.0017))
        return cheek+under+chin+bridge+tip+alae+nostril+cranial+socket+cushion+philtrum+muzzle+lip

    def depth(self,x,y):
        rx, rz, mid=profile(self.sections,y)
        theta=asin(max(-1,min(1,x/rx)))
        front=cos(theta)
        return mid+rz*(front**.79)+self.relief(x,y)*front

    def face_uv(self,x,y):
        rx=profile(self.sections,y)[0]
        a=asin(max(-1,min(1,x/rx)))
        return .5+a/(2*pi), .27+.71*(y-BOTTOM)/(TOP-BOTTOM)

    def pigment(self,directory):
        size=1024
        axis=(np.arange(size)+.5)/size
        u,v=np.meshgrid(axis,axis)
        y=BOTTOM+(TOP-BOTTOM)*np.clip((v-.27)/.71,0,1)
        a=(u-.5)*2*pi
        rad=np.array([profile(self.sections,q)[0] for q in y[:,0]])
        x=np.sin(a)*rad[:,None]
        side=np.abs(x)
        front=np.maximum(0,np.cos(a))
        skin_color=np.broadcast_to(self.base,(size,size,3)).copy()
        def shade(color,strength):
            skin_color[:]+=(np.array(rgb(color))-skin_color)*np.clip(strength,0,1)[...,None]
        def g(x):
            return np.exp(-x*x)
        f=self.woman
        shade('df8e7e' if f else 'bc7b69',front*g((y+.049)/.040)*g((side-.088)/.038)*(.38 if f else .21))
        shade('f9d6b0',front*g((y-.050)/.081)*g(x/.082)*.17)
        shade('f9c29b',front*g((y+.127)/.040)*g(x/.065)*.18)
        shade('bd8673',g((y+.130)/.051)*(1-front**.74)*.41)
        shade('c28571',front*g((side-.058)/.031)*g((y-.019)/.032)*.29)
        shade('f0a184',front*g((y+.048)/.030)*g(x/.025)*.24)
        shade('6e362c',front*g((side-(.016 if f else .018))/.0051)*g((y+(.062 if f else .071))/.0045)*.49)
        shade('ac695d',front*g((y-self.mouth+.024)/.009)*g(x/.036)*.27)
        seam,span,up,lo=self.lip(x)
        d=y-seam
        width=np.maximum(.00001,np.where(d>0,up,lo)*span)
        inside=np.clip((1-np.abs(d/width))*7,0,1)*np.clip((1-side/self.mouth_width)*15,0,1)*front
        shade('b5574b' if f else 'b4776b',inside*.91)
        shade('642f30' if f else '744441',inside*g(d/.0015)*.78)
        shade('ed9a7e' if f else 'e4aa91',inside*g((d+.007)/.004)*.34)
        shade('ffd2b1',inside*g((d+.006)/.0024)*g((x+.018)/.020)*.14)
        eyebrow=np.clip((side-.023)/.083,0,1)
        arch=(.040 if f else .031)+(.019 if f else .013)*np.sin(pi*eyebrow*.94)-(.011 if f else .005)*eyebrow
        width=((.0083 if f else .0102)*(1-eyebrow)**.39*np.clip(eyebrow/.094,0,1)+.0001)
        brows=np.clip((1-abs(y-arch)/width)*4,0,1)*np.clip((1-eyebrow)*15,0,1)*front
        shade('634028' if f else '644331',brows*(.82+.15*np.cos(y*1010+x*840)))
        if not f:
            # A bare-skinned low fade. Fine pepper grain stops at the temple.
            around=np.clip((.86-front)/.66,0,1)
            threshold=.059-.081*around
            fade=np.clip((y-threshold)/.082,0,1)**1.6*around
            shade('795744',fade*.93)
            shade('654b39',fade*(.33+.30*np.sin(u*798+np.sin(v*432))**2))
        grain=np.sin(u*791+np.cos(v*659))*np.cos(v*810+u*107)
        skin_color+=grain[...,None]*(.0037 if f else .0053)
        skin_color[(v<.19)&(u<.19)]=rgb('30201b' if f else '574034')
        return bake(self.character+'-complexion',skin_color,directory)

    def build_face(self,folder):
        face=Mesh('Portrait and eyelids','Complexion',.68,self.pigment(folder))
        rows=[]
        socket_bottom,socket_top=-.054,.064
        yset=sorted(set([socket_bottom,socket_top]+[BOTTOM+(TOP-BOTTOM)*q for q in steps(67)] +
                        [self.mouth+p for p in (-.019,-.016,-.013,-.010,-.008,-.006,-.004,-.002,0,.002,.004,.006,.008,.010,.012)]))
        for y in yset:
            rx,rz,mid=profile(self.sections,y)
            row=[]
            for t in steps(93):
                a=(t-.5)*2*pi
                x=rx*sin(a)
                c=cos(a)
                z=mid+rz*(c**.79 if c>=0 else c)+self.relief(x,y)*max(0,c)
                row.append((self.xyz(x,y,z),WHITE,HEAD,(t,.27+.71*(y-BOTTOM)/(TOP-BOTTOM))))
            rows.append(row)
        start=face.grid(rows)
        # Separate seam vertices carry unwrapped UVs; share lighting normals later.
        last=len(rows[0])
        below,above=yset.index(socket_bottom),yset.index(socket_top)
        middle=(last-1)//2
        windows=[(middle-18,middle-1),(middle+1,middle+18)]
        face.faces=[quad for ri in range(len(rows)-1) for ci in range(last-1)
                    if not(below<=ri<above and any(lo<=ci<hi for lo,hi in windows))
                    for quad in [face.faces[ri*(last-1)+ci]]]
        face.faces += [tuple(start+j for j in reversed(range(last-1))),
                       tuple(start+(len(rows)-1)*last+j for j in range(last-1))]
        smile=[]
        for row in rows:
            for (x,y,z),_,_,(u,v) in row:
                y-=self.height
                f=max(0,cos((u-.5)*2*pi))
                corner=bell((abs(x)-self.mouth_width*.81)/.026)*bell((y-self.mouth)/.034)
                cheek=bell((abs(x)-.092)/.035)*bell((y+.056)/.034)
                smile.append(self.xyz(x+f*.004*corner*(1 if x>=0 else -1),y+f*(.013*corner+.0037*cheek),z+f*.004*cheek))
        face.deformation('Smile',start,smile)
        eyes=Mesh('Eyes','Eyes',.23)
        skin=Mesh('Sculpted exposed skin','Skin and trim',.79)
        for (side,suffix),(lo,hi) in zip([(-1,'L'),(1,'R')],windows):
            border=[(below,i) for i in range(lo,hi)]+[(i,hi) for i in range(below,above)] +                    [(above,i) for i in range(hi,lo,-1)]+[(i,lo) for i in range(above,below,-1)]
            self.eye(face,eyes,side,suffix,[r*last+c for r,c in border])
            self.ear(skin,side)
        return face, eyes, skin

    def eye(self,face,eyes,side,suffix,border):
        f=self.woman
        cx=self.eye_x*side
        radius=self.eye_radius
        width=self.eye_width
        eye_bone=solid('Eye'+suffix)
        def opening(t,upper):
            arch=max(0,sin(pi*t))**.75
            x=cx+side*(2*t-1)*width
            baseline=(t-.5)*(.012 if f else .0052)-.002
            return x,baseline+arch*((.0214 if f else .0128) if upper else (-.0121 if f else -.0087))

        def globe(x,y):
            return self.eye_center+sqrt(max(.00006,radius*radius-(x-cx)**2-y*y))

        # Only the part of the sphere between the eyelids is sclera. Keeping
        # the aperture in the topology avoids exposed white on the cheek.
        rows=[]
        for v in steps(15):
            row=[]
            for u in steps(49):
                x,lo=opening(u,False)
                _,hi=opening(u,True)
                y=lo+(hi-lo)*v
                tint=rgbmix(rgb('e7e3d6'),rgb('d6a69a'),.30*abs(2*u-1)**5+.09*abs(2*v-1)**3)
                row.append((self.xyz(x,y,globe(x,y)),tint,HEAD,(u,v)))
            rows.append(row)
        eyes.grid(rows,flip=side<0)
        iris=.0187 if f else .0137
        iris_col=rgb('31668e' if f else '455638')
        iris_light=rgb('609fbd' if f else '677a48')
        ring=rgb('184153' if f else '273724')
        pupils=rgb('121721')
        rings=[]
        for t in steps(15):
            t=max(.001,t)
            row=[]
            for u in steps(64):
                a=u*2*pi
                x=iris*t*sin(a); y=iris*t*cos(a)
                depth=self.eye_center+sqrt(radius*radius-x*x-y*y)+.0007
                streak=.20+.41*(.5+.5*sin(a*29+t*16)*cos(a*9-t*3))
                iris_color=rgbmix(iris_col,iris_light,streak)
                inner=ramp(.31,.39,t)
                outer=ramp(.75,.99,t)
                color=rgbmix(rgbmix(pupils,iris_color,inner),ring,outer*.84)
                for gx,gy,strength,size in [(-.31,.36,.90,.15),(.34,-.28,.40,.072)]:
                    glint=bell((x/iris-gx)/size)*bell((y/iris-gy)/size)*strength
                    color=rgbmix(color,rgb('f9f5ee'),glint)
                row.append((self.xyz(cx+x,y,depth),color,eye_bone,(u,t)))
            rings.append(row)
        eyes.grid(rings,closed=True)

        # Retopology: with the socket quads removed, bridge the aperture
        # to the real head vertices. This shares surface normals at the brow
        # and cheek and gives the eyelid a continuous volume when it closes.
        previous=None
        rings=[]
        rim=[]
        lid_points=face.keys.setdefault('CloseLids',{})
        for q in steps(11):
            ring=[]
            for boundary in border:
                bx, by, bz=face.points[boundary]
                by-=self.height
                a=atan2(by/.059,(bx-cx)/.057)
                t=(1+side*cos(a))*.5
                ix,iy=opening(t,sin(a)>=0)
                iz=globe(ix,iy)+.0013
                x,y=ix+(bx-ix)*q,iy+(by-iy)*q
                dx,dy=bx-ix,by-iy
                in_slope=(self.depth(ix+.16*dx,iy+.16*dy)-self.depth(ix,iy))*2.2
                out_slope=(bz-self.depth(bx-.05*dx,by-.05*dy))*20
                # Hermite tangents blend into the existing skull instead of
                # adding a raised eye patch with its own lighting normals.
                z=spline(iz,bz,max(-.022,min(.022,in_slope)),max(-.037,min(.037,out_slope)),q)
                if q==1:
                    index=boundary
                else:
                    index=len(face.points)
                    face.points.append(self.xyz(x,y,z))
                    face.uvs.append(self.face_uv(x,y))
                    face.colors.append((1,1,1,1))
                    face.weights.append(HEAD)
                    mid=opening(t,False)[1]+(.006 if f else .004)*sin(pi*t)**.75
                    y2=y+(mid-iy)*(1-q)**2.32
                    z2=max(z,globe(x,y2)+.0018*(1-q)) if q<.43 else z
                    lid_points[index]=self.xyz(x,y2,z2)
                    if q==0:
                        rim.append(((x,y,z),(x,y2,z2),t,sin(a)>=0))
                ring.append(index)
            if previous:
                n=len(ring)
                face.faces.extend((ring[i],ring[(i+1)%n],previous[(i+1)%n],previous[i]) for i in range(n))
            previous=ring
            rings.append(ring)
        # Relax only interior ring depths. Aperture, skull seam and UVs stay
        # anchored, preserving the exact eyeball and eyelash contact.
        for _ in range(4):
            change={}
            for row in range(1,len(rings)-1):
                for col,index in enumerate(rings[row]):
                    n=len(rings[row])
                    neighbors=(rings[row-1][col],rings[row+1][col],rings[row][(col-1)%n],rings[row][(col+1)%n])
                    mean=sum(face.points[j][2] for j in neighbors)*.25
                    change[index]=(mean-face.points[index][2])*.36
            for index,delta in change.items():
                x,y,z=face.points[index]
                face.points[index]=(x,y,z+delta)
                x,y,z=lid_points[index]
                lid_points[index]=(x,y,z+delta)

        # The upper lash line has a separate pigment island in the same
        # mesh and follows the very same lid positions as the skin.
        lash=sorted([e for e in rim if e[3]],key=lambda e:e[2])
        lash_rows=[]
        pose=[]
        for v in steps(4):
            row=[]
            for (x,y,z),(x2,y2,z2),u,_ in lash:
                thickness=(.0037 if f else .0022)*sin(pi*u)**.68*(.56+u*.44)
                add=(v-.31)*thickness
                row.append((self.xyz(x,y+add,z+.0011),WHITE,HEAD,(.075,.085)))
                pose.append(self.xyz(x2,y2+add,z2+.0012))
            lash_rows.append(row)
        start=face.grid(lash_rows,flip=side<0)
        face.deformation('CloseLids',start,pose)
        if f:
            for j in range(4):
                u=.75+j*.053
                (x,y,z),(_,y2,z2),_,_=min(lash,key=lambda row:abs(row[2]-u))
                length=.009+j*.0017
                before=[];after=[]
                for t in steps(8):
                    xx=x+side*length*t*.68
                    yy=y+length*t**.9
                    zz=z+.003*t+.0012
                    size=.0011*(1-t)+.00012
                    before.append([(self.xyz(xx-d*size,yy,zz),WHITE,HEAD,(.075,.085)) for d in (-1,1)])
                    after.extend([self.xyz(xx-d*size,yy+y2-y,zz+z2-z) for d in (-1,1)])
                start=face.grid(before,flip=side>0)
                face.deformation('CloseLids',start,after)

    def ear(self,skin,side):
        f=self.woman
        cx=.121 if f else .123
        cy=-.045 if f else -.047
        height=.043 if f else .051
        center_z=.006 if f else .007
        rows=[]
        for t in steps(12):
            p=max(.013,t)
            row=[]
            for u in steps(46):
                a=u*2*pi
                x=side*(cx+p*.026*sin(a)+.010*cos(a)*p)
                y=cy+height*cos(a)*p
                z=center_z+.019*sin(2.42*p)+.013*p*sin(a)+.010*p**5
                color=rgbmix(self.base,rgb('a26351'),.62*bell((p-.32)/.25)+.15*abs(sin(a)))
                row.append((self.xyz(x,y,z),color,HEAD,(u,t)))
            rows.append(row)
        skin.grid(rows,flip=(side<0))
        # Continuous helix and a small raised tragus.
        path=[]
        for t in steps(26):
            a=-.26+t*5.18
            p=.86
            x=side*(cx+p*.026*sin(a)+.010*cos(a)*p)
            y=cy+height*cos(a)*p
            z=center_z+.019*sin(2.42*p)+.013*p*sin(a)+.010*p**5+.001
            path.append((self.xyz(x,y,z),.0025+.0036*sin(pi*t)**.7))
        skin.cord(path,rgbmix(self.base,rgb('d9987f'),.29),HEAD,sides=7)
